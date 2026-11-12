import { Project } from '../../types/project';
import { Donation } from '../../types/donation';
import { AuditEvent } from '../../types/audit';

export const initialProjects: Project[] = [
  {
    projectId: 'proj-arequipa-001',
    title: 'Comedores Populares Cerro Colorado',
    description: 'Abastecimiento de víveres no perecibles, balones de gas y utensilios de cocina para 12 comedores populares en el cono norte de Arequipa.',
    goalAmountCents: 1500000, // S/ 15,000.00
    confirmedAmountCents: 620000, // S/ 6,200.00
    currency: 'PEN',
    status: 'PUBLICADO',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-05T14:30:00.000Z',
  },
  {
    projectId: 'proj-arequipa-002',
    title: 'Kits Escolares Rurales Yanahuara',
    description: 'Entrega de mochilas equipadas con cuadernos, textos pedagógicos y materiales de dibujo para 350 niños de zonas rurales y asentamientos humanos.',
    goalAmountCents: 850000, // S/ 8,500.00
    confirmedAmountCents: 410000, // S/ 4,100.00
    currency: 'PEN',
    status: 'PUBLICADO',
    createdAt: '2026-11-02T11:15:00.000Z',
    updatedAt: '2026-11-06T09:20:00.000Z',
  },
  {
    projectId: 'proj-arequipa-003',
    title: 'Salud Preventiva y Despistaje Paucarpata',
    description: 'Campañas médicas comunitarias con despistaje de anemia infantil, atención pediátrica y entrega de suplementos multivitamínicos.',
    goalAmountCents: 1200000, // S/ 12,000.00
    confirmedAmountCents: 980000, // S/ 9,800.00
    currency: 'PEN',
    status: 'PUBLICADO',
    createdAt: '2026-11-03T16:00:00.000Z',
    updatedAt: '2026-11-07T18:00:00.000Z',
  },
  {
    projectId: 'proj-arequipa-004-draft',
    title: 'Abrigo para las Alturas de Caylloma (Borrador)',
    description: 'Proyecto piloto de entrega de frazadas térmicas y ropa abrigadora para comunidades altoandinas afectadas por heladas.',
    goalAmountCents: 2000000, // S/ 20,000.00
    confirmedAmountCents: 0,
    currency: 'PEN',
    status: 'BORRADOR', // Un Borrador no debe aparecer en catálogo público (CA-01.2)
    createdAt: '2026-11-07T20:00:00.000Z',
    updatedAt: '2026-11-07T20:00:00.000Z',
  },
];

export const initialDonations: Donation[] = [
  {
    donationId: 'don-demo-001',
    projectId: 'proj-arequipa-001',
    projectTitle: 'Comedores Populares Cerro Colorado',
    donorSub: 'donor-sub-12345',
    amountCents: 5000, // S/ 50.00
    currency: 'PEN',
    status: 'CONFIRMADA_SIMULADA',
    createdAt: '2026-11-06T12:00:00.000Z',
    updatedAt: '2026-11-06T12:05:00.000Z',
  },
  {
    donationId: 'don-demo-002',
    projectId: 'proj-arequipa-002',
    projectTitle: 'Kits Escolares Rurales Yanahuara',
    donorSub: 'donor-sub-12345',
    amountCents: 10000, // S/ 100.00
    currency: 'PEN',
    status: 'PENDIENTE_SIMULACION',
    createdAt: '2026-11-07T14:20:00.000Z',
    updatedAt: '2026-11-07T14:20:00.000Z',
  },
];

export const initialAuditEvents: AuditEvent[] = [
  {
    eventId: 'evt-aud-001',
    timestamp: '2026-11-01T10:00:00.000Z',
    requestId: 'req-sys-001',
    actorRef: 'gestor-anon-67890',
    action: 'PROJECT_CREATED',
    resourceRef: 'proj-arequipa-001',
    outcome: 'SUCCESS',
  },
  {
    eventId: 'evt-aud-002',
    timestamp: '2026-11-01T10:30:00.000Z',
    requestId: 'req-sys-002',
    actorRef: 'gestor-anon-67890',
    action: 'PROJECT_PUBLISHED',
    resourceRef: 'proj-arequipa-001',
    outcome: 'SUCCESS',
  },
  {
    eventId: 'evt-aud-003',
    timestamp: '2026-11-06T12:05:00.000Z',
    requestId: 'req-sys-003',
    actorRef: 'donor-anon-12345',
    action: 'DONATION_CONFIRMED_SIMULATED',
    resourceRef: 'don-demo-001',
    outcome: 'SUCCESS',
  },
];

