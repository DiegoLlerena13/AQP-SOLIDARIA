import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockV2Event } from '../helpers/mockEvents.js';

// Hoist variables needed inside vi.mock
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn()
}));

vi.mock('@aws-sdk/client-dynamodb', () => {
  return {
    DynamoDBClient: vi.fn().mockImplementation(function () {
      return {};
    })
  };
});

vi.mock('@aws-sdk/lib-dynamodb', () => {
  return {
    DynamoDBDocumentClient: {
      from: vi.fn(() => ({
        send: mockSend
      }))
    },
    GetCommand: vi.fn().mockImplementation(function (this: any, params: any) {
      Object.assign(this, params);
    }),
    PutCommand: vi.fn().mockImplementation(function (this: any, params: any) {
      Object.assign(this, params);
    }),
    UpdateCommand: vi.fn().mockImplementation(function (this: any, params: any) {
      Object.assign(this, params);
    }),
    QueryCommand: vi.fn().mockImplementation(function (this: any, params: any) {
      Object.assign(this, params);
    }),
    TransactWriteCommand: vi.fn().mockImplementation(function (this: any, params: any) {
      Object.assign(this, params);
    })
  };
});

// Importar handlers envueltos con withAuthz
import { handler as simulateHandler } from '../../src/donations/simulate.js';
import { handler as createDonationHandler } from '../../src/donations/create.js';
import { handler as myDonationsHandler } from '../../src/donations/me.js';
import { handler as createProjectHandler } from '../../src/projects/create.js';
import { handler as publishProjectHandler } from '../../src/projects/publish.js';

describe('Integración de Handlers con withAuthz, RBAC, Ownership y BOLA', () => {
  beforeEach(() => {
    mockSend.mockReset();
    process.env.DONATIONS_TABLE = 'aqp-solidaria-donations';
    process.env.PROJECTS_TABLE = 'aqp-solidaria-projects';
    process.env.IDEMPOTENCY_TABLE = 'aqp-solidaria-idempotency';
    process.env.APP_ENV = 'academic';
  });

  describe('POST /v1/donations/{donationId}/simulate (SimulateDonation)', () => {
    it('permite a un donante simular su propia donación (Ownership exitoso)', async () => {
      // Donación existente que pertenece al donante autenticado
      mockSend.mockResolvedValueOnce({
        Item: {
          donationId: 'don-own-123',
          projectId: 'proj-456',
          amountCents: 5000,
          donorSub: 'donor-alice-sub',
          status: 'PENDIENTE_SIMULACION'
        }
      });
      // Respuesta de TransactWriteCommand exitosa
      mockSend.mockResolvedValueOnce({});

      const event = createMockV2Event({
        method: 'POST',
        path: '/v1/donations/don-own-123/simulate',
        routeKey: 'POST /v1/donations/{donationId}/simulate',
        stage: 'academic',
        sub: 'donor-alice-sub',
        groups: ['DONANTE'],
        scopes: ['api/donations.write'],
        body: { action: 'CONFIRM' }
      });
      (event as any).pathParameters = { donationId: 'don-own-123' };

      const response = await simulateHandler(event as any);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('CONFIRMADA_SIMULADA');
      expect(body.message).toBe('Simulación académica: no se ha realizado ningún cobro');
    });

    it('[T09][CA-07.2] BOLA: donante intenta simular donación de otro usuario -> responde 404 NOT_FOUND y oculta datos', async () => {
      // Donación ajena perteneciente a Bob
      mockSend.mockResolvedValueOnce({
        Item: {
          donationId: 'don-bob-999',
          projectId: 'proj-456',
          amountCents: 90000,
          donorSub: 'donor-bob-sub', // Pertenece a Bob
          status: 'PENDIENTE_SIMULACION'
        }
      });

      // Atacante Alice intenta simular la donación de Bob
      const eventAtacante = createMockV2Event({
        method: 'POST',
        path: '/v1/donations/don-bob-999/simulate',
        routeKey: 'POST /v1/donations/{donationId}/simulate',
        stage: 'academic',
        sub: 'donor-alice-sub', // Alice es la identidad autenticada
        groups: ['DONANTE'],
        scopes: ['api/donations.write'],
        body: { action: 'CONFIRM' }
      });
      (eventAtacante as any).pathParameters = { donationId: 'don-bob-999' };

      const response = await simulateHandler(eventAtacante as any);

      // Verificación BOLA: Debe responder 404 NOT_FOUND, NUNCA 200 ni 403
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('NOT_FOUND');
      expect(body.message).toBe('Recurso no encontrado');
      expect(response.body).not.toContain('donor-bob-sub');
      expect(response.body).not.toContain('90000');
    });

    it('GESTOR intentando invocar simulación -> denegado con 403 FORBIDDEN por RBAC', async () => {
      const eventGestor = createMockV2Event({
        method: 'POST',
        path: '/v1/donations/don-123/simulate',
        routeKey: 'POST /v1/donations/{donationId}/simulate',
        stage: 'academic',
        sub: 'gestor-sub-001',
        groups: ['GESTOR'],
        scopes: ['api/donations.write'],
        body: { action: 'CONFIRM' }
      });
      (eventGestor as any).pathParameters = { donationId: 'don-123' };

      const response = await simulateHandler(eventGestor as any);

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /v1/donations (CreateDonation)', () => {
    it('[CA-04.3][CA-05.3] el donorSub siempre se extrae del Principal, ignorando body manipulado', async () => {
      mockSend.mockResolvedValueOnce({});

      const event = createMockV2Event({
        method: 'POST',
        path: '/v1/donations',
        routeKey: 'POST /v1/donations',
        stage: 'academic',
        sub: 'donor-alice-real-sub',
        groups: ['DONANTE'],
        scopes: ['api/donations.write'],
        headers: {
          'idempotency-key': '123e4567-e89b-12d3-a456-426614174000'
        },
        body: {
          projectId: 'proj-001',
          amountCents: 5000,
          donorSub: 'fake-injected-sub' // Intento de inyección
        }
      });

      const response = await createDonationHandler(event as any);

      expect(response.statusCode).toBe(201);

      // Comprobar llamada a TransactWriteCommand
      expect(mockSend).toHaveBeenCalledTimes(1);
      const transactCall = mockSend.mock.calls[0][0];
      const items = transactCall.TransactItems;
      const donationPut = items.find((item: any) => item.Put?.TableName === process.env.DONATIONS_TABLE);

      expect(donationPut).toBeDefined();
      expect(donationPut.Put.Item.donorSub).toBe('donor-alice-real-sub'); // Proveniente del claim verificado
    });
  });

  describe('GET /v1/donations/me (GetMyDonations)', () => {
    it('consulta exclusivamente con el donorSub del token autenticado', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            donationId: 'd-1',
            projectId: 'p-1',
            amountCents: 2000,
            currency: 'PEN',
            status: 'CONFIRMADA_SIMULADA',
            createdAt: '2026-11-11T12:00:00Z',
            updatedAt: '2026-11-11T12:00:00Z'
          }
        ]
      });

      const event = createMockV2Event({
        method: 'GET',
        path: '/v1/donations/me',
        routeKey: 'GET /v1/donations/me',
        stage: 'academic',
        sub: 'donor-charlie-sub',
        groups: ['DONANTE'],
        scopes: ['api/donations.read']
      });

      const response = await myDonationsHandler(event as any);

      expect(response.statusCode).toBe(200);
      const queryCall = mockSend.mock.calls[0][0];
      expect(queryCall.ExpressionAttributeValues[':sub']).toBe('donor-charlie-sub');
    });

    it('[T12][CA-04.2] GESTOR intentando consultar /v1/donations/me es rechazado con 403', async () => {
      const event = createMockV2Event({
        method: 'GET',
        path: '/v1/donations/me',
        routeKey: 'GET /v1/donations/me',
        stage: 'academic',
        sub: 'gestor-user-1',
        groups: ['GESTOR'],
        scopes: ['api/donations.read']
      });

      const response = await myDonationsHandler(event as any);

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /v1/projects (CreateProject) y PATCH /v1/projects/{projectId}/publish', () => {
    it('GESTOR puede crear proyectos y se asigna createdBy con su sub', async () => {
      mockSend.mockResolvedValueOnce({});

      const event = createMockV2Event({
        method: 'POST',
        path: '/v1/projects',
        routeKey: 'POST /v1/projects',
        stage: 'academic',
        sub: 'gestor-uuid-777',
        groups: ['GESTOR'],
        scopes: ['api/projects.write'],
        body: {
          name: 'Comedor Solidario Paucarpata',
          description: 'Raciones de alimentos para familias vulnerables',
          goalAmountCents: 500000
        }
      });

      const response = await createProjectHandler(event as any);

      expect(response.statusCode).toBe(201);
      const putCall = mockSend.mock.calls[0][0];
      expect(putCall.Item.createdBy).toBe('gestor-uuid-777');
      expect(putCall.Item.status).toBe('BORRADOR');
    });

    it('GESTOR puede publicar proyectos', async () => {
      mockSend.mockResolvedValueOnce({});

      const event = createMockV2Event({
        method: 'PATCH',
        path: '/v1/projects/proj-123/publish',
        routeKey: 'PATCH /v1/projects/{projectId}/publish',
        stage: 'academic',
        sub: 'gestor-uuid-777',
        groups: ['GESTOR'],
        scopes: ['api/projects.write']
      });
      (event as any).pathParameters = { projectId: 'proj-123' };

      const response = await publishProjectHandler(event as any);

      expect(response.statusCode).toBe(200);
    });

    it('DONANTE intentando crear o publicar proyectos -> responde 403 FORBIDDEN (T03, CA-04.1)', async () => {
      const eventDonante = createMockV2Event({
        method: 'POST',
        path: '/v1/projects',
        routeKey: 'POST /v1/projects',
        stage: 'academic',
        sub: 'donante-sub-1',
        groups: ['DONANTE'],
        scopes: ['api/projects.write'],
        body: { name: 'P', description: 'D', goalAmountCents: 1000 }
      });

      const response = await createProjectHandler(eventDonante as any);
      expect(response.statusCode).toBe(403);
    });
  });
});
