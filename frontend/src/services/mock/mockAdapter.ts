import { Project, CreateProjectDto, ProjectStats } from '../../types/project';
import { Donation, CreateDonationDto, SimulateDonationDto } from '../../types/donation';
import { AuditEvent } from '../../types/audit';
import { ApiError } from '../../types/api';
import { initialProjects, initialDonations, initialAuditEvents } from './mockData';
import { tokenStorage } from '../../auth/tokenStorage';

interface IdempotencyEntry {
  payloadHash: string;
  response: Donation;
  expiresAt: number;
}

// Estado mutable en memoria durante la ejecución de la SPA
let projectsState: Project[] = [...initialProjects];
let donationsState: Donation[] = [...initialDonations];
let auditEventsState: AuditEvent[] = [...initialAuditEvents];
const idempotencyMap = new Map<string, IdempotencyEntry>();

function generateRequestId(): string {
  return `req-sim-${Math.random().toString(36).substring(2, 9)}`;
}

export const mockAdapter = {
  reset() {
    projectsState = [...initialProjects];
    donationsState = [...initialDonations];
    auditEventsState = [...initialAuditEvents];
    idempotencyMap.clear();
  },

  async getProjects(): Promise<Project[]> {
    // CA-01.1 y CA-01.2: Solo proyectos PUBLICADOS
    return projectsState.filter((p) => p.status === 'PUBLICADO');
  },

  async getAllProjectsForGestor(): Promise<Project[]> {
    const user = tokenStorage.getUser();
    if (!user || !user.roles.includes('GESTOR')) {
      throw new ApiError(403, {
        code: 'FORBIDDEN',
        message: 'Acceso denegado: solo GESTOR puede ver el catálogo completo de gestión',
        requestId: generateRequestId(),
      });
    }
    return [...projectsState];
  },

  async getProjectById(projectId: string): Promise<Project> {
    const project = projectsState.find((p) => p.projectId === projectId);
    const user = tokenStorage.getUser();
    const isGestor = user && user.roles.includes('GESTOR');

    // CA-02.2: Proyecto inexistente o no publicado devuelve 404 al visitante/donante
    if (!project || (project.status !== 'PUBLICADO' && !isGestor)) {
      throw new ApiError(404, {
        code: 'NOT_FOUND',
        message: `Proyecto ${projectId} no encontrado o no disponible`,
        requestId: generateRequestId(),
      });
    }

    return project;
  },

  async getProjectStats(projectId: string): Promise<ProjectStats> {
    const project = await this.getProjectById(projectId);
    const confirmedDonations = donationsState.filter(
      (d) => d.projectId === projectId && d.status === 'CONFIRMADA_SIMULADA'
    );

    const progressPercentage =
      project.goalAmountCents > 0
        ? Math.min(100, Math.round((project.confirmedAmountCents / project.goalAmountCents) * 100))
        : 0;

    return {
      projectId: project.projectId,
      confirmedAmountCents: project.confirmedAmountCents,
      goalAmountCents: project.goalAmountCents,
      progressPercentage,
      confirmedDonationsCount: confirmedDonations.length,
    };
  },

  async createProject(dto: CreateProjectDto): Promise<Project> {
    const user = tokenStorage.getUser();
    // CA-04.1 y CA-08.1: Solo GESTOR
    if (!user || !user.roles.includes('GESTOR')) {
      throw new ApiError(403, {
        code: 'FORBIDDEN',
        message: 'Acceso denegado: rol GESTOR requerido para crear proyectos',
        requestId: generateRequestId(),
      });
    }

    if (!dto.title || dto.title.trim().length === 0) {
      throw new ApiError(400, {
        code: 'VALIDATION_ERROR',
        message: 'El título del proyecto es obligatorio',
        requestId: generateRequestId(),
      });
    }

    if (!Number.isInteger(dto.goalAmountCents) || dto.goalAmountCents <= 0) {
      throw new ApiError(400, {
        code: 'VALIDATION_ERROR',
        message: 'La meta debe ser un entero positivo en céntimos de PEN',
        requestId: generateRequestId(),
      });
    }

    const newProject: Project = {
      projectId: `proj-${Date.now()}`,
      title: dto.title.trim(),
      description: dto.description.trim(),
      goalAmountCents: dto.goalAmountCents,
      confirmedAmountCents: 0,
      currency: 'PEN',
      status: 'BORRADOR', // Siempre inicia como BORRADOR (CA-08.1)
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    projectsState.push(newProject);

    // Auditoría
    auditEventsState.push({
      eventId: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
      actorRef: `gestor-anon-${user.sub.slice(0, 5)}`,
      action: 'PROJECT_CREATED',
      resourceRef: newProject.projectId,
      outcome: 'SUCCESS',
    });

    return newProject;
  },

  async publishProject(projectId: string): Promise<Project> {
    const user = tokenStorage.getUser();
    if (!user || !user.roles.includes('GESTOR')) {
      throw new ApiError(403, {
        code: 'FORBIDDEN',
        message: 'Acceso denegado: rol GESTOR requerido para publicar proyectos',
        requestId: generateRequestId(),
      });
    }

    const project = projectsState.find((p) => p.projectId === projectId);
    if (!project) {
      throw new ApiError(404, {
        code: 'NOT_FOUND',
        message: 'Proyecto no encontrado para publicar',
        requestId: generateRequestId(),
      });
    }

    // CA-08.2: Publicar uno ya publicado devuelve 409
    if (project.status === 'PUBLICADO') {
      throw new ApiError(409, {
        code: 'CONFLICT',
        message: 'El proyecto ya se encuentra en estado PUBLICADO',
        requestId: generateRequestId(),
      });
    }

    project.status = 'PUBLICADO';
    project.updatedAt = new Date().toISOString();

    auditEventsState.push({
      eventId: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
      actorRef: `gestor-anon-${user.sub.slice(0, 5)}`,
      action: 'PROJECT_PUBLISHED',
      resourceRef: project.projectId,
      outcome: 'SUCCESS',
    });

    return { ...project };
  },

  async createDonation(dto: CreateDonationDto, idempotencyKey?: string): Promise<Donation> {
    const user = tokenStorage.getUser();
    // CA-03.2 y CA-05.1: Solo DONANTE autenticado
    if (!user || !user.roles.includes('DONANTE')) {
      throw new ApiError(401, {
        code: 'UNAUTHORIZED',
        message: 'Debes iniciar sesión con rol DONANTE para registrar una donación',
        requestId: generateRequestId(),
      });
    }

    // CA-05.1 y CA-05.2: Header Idempotency-Key obligatorio
    if (!idempotencyKey) {
      throw new ApiError(400, {
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'La cabecera Idempotency-Key es obligatoria',
        requestId: generateRequestId(),
      });
    }

    // CA-05.1 y CA-05.2: Validaciones de monto (100 a 100000 céntimos = S/ 1.00 a S/ 1,000.00)
    if (
      !Number.isInteger(dto.amountCents) ||
      dto.amountCents < 100 ||
      dto.amountCents > 100000
    ) {
      throw new ApiError(400, {
        code: 'INVALID_AMOUNT',
        message: 'El monto debe ser un entero entre 100 (S/ 1.00) y 100,000 (S/ 1,000.00) céntimos',
        requestId: generateRequestId(),
      });
    }

    // Verificar que el proyecto exista y esté PUBLICADO
    const project = projectsState.find((p) => p.projectId === dto.projectId);
    if (!project) {
      throw new ApiError(404, {
        code: 'PROJECT_NOT_FOUND',
        message: 'El proyecto especificado no existe',
        requestId: generateRequestId(),
      });
    }

    if (project.status !== 'PUBLICADO') {
      throw new ApiError(409, {
        code: 'PROJECT_NOT_PUBLISHED',
        message: 'No se puede donar a un proyecto en estado BORRADOR',
        requestId: generateRequestId(),
      });
    }

    // CA-05.4: Manejo de Idempotencia
    const idempotencyPk = `${user.sub}#createDonation#${idempotencyKey}`;
    const payloadHash = JSON.stringify({ projectId: dto.projectId, amountCents: dto.amountCents });

    const existingEntry = idempotencyMap.get(idempotencyPk);
    if (existingEntry) {
      if (existingEntry.payloadHash === payloadHash) {
        // Reenviar misma clave y misma carga devuelve el mismo resultado
        return existingEntry.response;
      } else {
        // Reutilizar clave con payload distinto devuelve 409
        throw new ApiError(409, {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency-Key reutilizada con parámetros distintos',
          requestId: generateRequestId(),
        });
      }
    }

    // CA-05.1: Se crea en estado PENDIENTE_SIMULACION
    const newDonation: Donation = {
      donationId: `don-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      projectId: project.projectId,
      projectTitle: project.title,
      donorSub: user.sub, // Obtenido del token, no del body (CA-05.3)
      amountCents: dto.amountCents,
      currency: 'PEN',
      status: 'PENDIENTE_SIMULACION',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    donationsState.unshift(newDonation);

    idempotencyMap.set(idempotencyPk, {
      payloadHash,
      response: newDonation,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    return newDonation;
  },

  async simulateDonation(
    donationId: string,
    dto: SimulateDonationDto
  ): Promise<Donation> {
    const user = tokenStorage.getUser();
    if (!user || !user.roles.includes('DONANTE')) {
      throw new ApiError(401, {
        code: 'UNAUTHORIZED',
        message: 'No autorizado',
        requestId: generateRequestId(),
      });
    }

    const donation = donationsState.find((d) => d.donationId === donationId);
    if (!donation) {
      throw new ApiError(404, {
        code: 'NOT_FOUND',
        message: 'Donación no encontrada',
        requestId: generateRequestId(),
      });
    }

    // CA-06.1 y CA-07.2: Solo el propietario puede simular
    if (donation.donorSub !== user.sub) {
      throw new ApiError(403, {
        code: 'FORBIDDEN',
        message: 'No puedes alterar donaciones pertenecientes a otro usuario',
        requestId: generateRequestId(),
      });
    }

    // CA-06.2: Solo transición desde PENDIENTE_SIMULACION
    if (donation.status !== 'PENDIENTE_SIMULACION') {
      throw new ApiError(409, {
        code: 'INVALID_TRANSITION',
        message: `La donación ya se encuentra en estado terminal ${donation.status}`,
        requestId: generateRequestId(),
      });
    }

    if (dto.action === 'CONFIRMAR') {
      donation.status = 'CONFIRMADA_SIMULADA';
      donation.updatedAt = new Date().toISOString();

      // CA-06.2: Incremento atómico en el acumulado del proyecto
      const project = projectsState.find((p) => p.projectId === donation.projectId);
      if (project) {
        project.confirmedAmountCents += donation.amountCents;
        project.updatedAt = new Date().toISOString();
      }
    } else {
      // CA-06.3: Donación rechazada no incrementa cifras agregadas
      donation.status = 'RECHAZADA_SIMULADA';
      donation.updatedAt = new Date().toISOString();
    }

    auditEventsState.push({
      eventId: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
      actorRef: `donor-anon-${user.sub.slice(0, 5)}`,
      action: `DONATION_${dto.action}_SIMULATED`,
      resourceRef: donation.donationId,
      outcome: 'SUCCESS',
    });

    return { ...donation };
  },

  async getMyDonations(): Promise<Donation[]> {
    const user = tokenStorage.getUser();
    // CA-07.1: Historial propio
    if (!user || !user.roles.includes('DONANTE')) {
      throw new ApiError(401, {
        code: 'UNAUTHORIZED',
        message: 'Inicia sesión como DONANTE para consultar tu historial',
        requestId: generateRequestId(),
      });
    }

    return donationsState.filter((d) => d.donorSub === user.sub);
  },

  async getAuditEvents(): Promise<AuditEvent[]> {
    const user = tokenStorage.getUser();
    // CA-10.1: Solo AUDITOR
    if (!user || !user.roles.includes('AUDITOR')) {
      throw new ApiError(403, {
        code: 'FORBIDDEN',
        message: 'Acceso reservado para usuarios con rol AUDITOR',
        requestId: generateRequestId(),
      });
    }

    return [...auditEventsState].reverse();
  },
};

