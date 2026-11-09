import { describe, it, expect } from 'vitest';
import { withAuthz } from '../../src/authz/index.js';
import { createMockV2Event } from '../helpers/mockEvents.js';

describe('withAuthz.ts - Wrapper HOF para Lambdas', () => {
  it('[CA-03.2] sin claims o sin sub -> responde HTTP 401 con formato uniforme', async () => {
    const wrappedHandler = withAuthz(
      { roles: ['DONANTE'], scopes: ['api/donations.write'] },
      async () => ({ statusCode: 200, body: JSON.stringify({ ok: true }) })
    );

    const eventSinJwt = createMockV2Event({ omitJwt: true, requestId: 'req-401-test' });
    const response = await wrappedHandler(eventSinJwt);

    expect(response.statusCode).toBe(401);
    expect(response.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(response.body);
    expect(body.code).toBe('UNAUTHORIZED');
    expect(body.requestId).toBe('req-401-test');
    expect(body.stack).toBeUndefined();
    expect(body.claims).toBeUndefined();
  });

  it('scope insuficiente -> responde HTTP 403 FORBIDDEN', async () => {
    const wrappedHandler = withAuthz(
      { roles: ['DONANTE'], scopes: ['api/donations.write'] },
      async () => ({ statusCode: 200, body: JSON.stringify({ ok: true }) })
    );

    const eventScopeInvalido = createMockV2Event({
      sub: 'sub-user-1',
      groups: '[DONANTE]',
      scopes: ['api/other.scope'],
      requestId: 'req-scope-fail'
    });

    const response = await wrappedHandler(eventScopeInvalido);
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.requestId).toBe('req-scope-fail');
  });

  it('[T03][CA-04.1] DONANTE intenta acción de GESTOR -> responde HTTP 403', async () => {
    const createProjectHandler = withAuthz(
      { roles: ['GESTOR'], scopes: ['api/projects.write'] },
      async () => ({ statusCode: 201, body: JSON.stringify({ created: true }) })
    );

    const eventDonante = createMockV2Event({
      sub: 'sub-donante-100',
      groups: '[DONANTE]',
      scopes: ['api/projects.write'], // Supongamos que obtuvo el scope por client_id
      requestId: 'req-t03'
    });

    const response = await createProjectHandler(eventDonante);
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.requestId).toBe('req-t03');
  });

  it('[T12][CA-04.2] GESTOR intenta GET /v1/donations/me -> responde HTTP 403', async () => {
    const meHandler = withAuthz(
      { roles: ['DONANTE'], scopes: ['api/donations.read'] },
      async () => ({ statusCode: 200, body: JSON.stringify([]) })
    );

    const eventGestor = createMockV2Event({
      sub: 'sub-gestor-200',
      groups: '[GESTOR]',
      scopes: ['api/donations.read'],
      requestId: 'req-t12'
    });

    const response = await meHandler(eventGestor);
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.requestId).toBe('req-t12');
  });

  it('[CA-04.3][CA-05.3] body con donorSub y groups falsos: el handler recibe solo el sub verificado', async () => {
    let capturedDonorSub = '';

    const createDonationHandler = withAuthz(
      { roles: ['DONANTE'], scopes: ['api/donations.write'] },
      async (_event, principal) => {
        capturedDonorSub = principal.sub;
        return { statusCode: 201, body: JSON.stringify({ donationId: 'don-new' }) };
      }
    );

    const eventInyectado = createMockV2Event({
      sub: 'legitimate-sub-456',
      groups: '[DONANTE]',
      scopes: ['api/donations.write'],
      body: {
        donorSub: 'spoofed-attacker-sub-999',
        groups: ['GESTOR']
      }
    });

    const response = await createDonationHandler(eventInyectado);
    expect(response.statusCode).toBe(201);
    expect(capturedDonorSub).toBe('legitimate-sub-456');
  });

  it('La respuesta de error nunca incluye stack, tokens ni claims (Fail-closed & Sanitize)', async () => {
    const errorThrowingHandler = withAuthz(
      { roles: ['DONANTE'] },
      async () => {
        throw new Error('Database connection failed with sensitive DB_PASSWORD=xyz');
      }
    );

    const event = createMockV2Event({
      sub: 'sub-donante',
      groups: '[DONANTE]',
      requestId: 'req-err-leak'
    });

    const response = await errorThrowingHandler(event);
    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body);
    expect(body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.message).toBe('Error interno del servidor');
    expect(body.requestId).toBe('req-err-leak');
    expect(response.body).not.toContain('DB_PASSWORD');
    expect(response.body).not.toContain('stack');
  });

  it('Camino feliz por cada rol: DONANTE, GESTOR y AUDITOR', async () => {
    const donanteAction = withAuthz(
      { roles: ['DONANTE'], scopes: ['api/donations.write'] },
      async () => ({ statusCode: 201, body: JSON.stringify({ role: 'DONANTE' }) })
    );
    const gestorAction = withAuthz(
      { roles: ['GESTOR'], scopes: ['api/projects.write'] },
      async () => ({ statusCode: 201, body: JSON.stringify({ role: 'GESTOR' }) })
    );
    const auditorAction = withAuthz(
      { roles: ['AUDITOR'], scopes: ['api/audit.read'] },
      async () => ({ statusCode: 200, body: JSON.stringify({ role: 'AUDITOR' }) })
    );

    const resDonante = await donanteAction(
      createMockV2Event({ sub: 'd1', groups: '[DONANTE]', scopes: ['api/donations.write'] })
    );
    const resGestor = await gestorAction(
      createMockV2Event({ sub: 'g1', groups: '[GESTOR]', scopes: ['api/projects.write'] })
    );
    const resAuditor = await auditorAction(
      createMockV2Event({ sub: 'a1', groups: '[AUDITOR]', scopes: ['api/audit.read'] })
    );

    expect(resDonante.statusCode).toBe(201);
    expect(resGestor.statusCode).toBe(201);
    expect(resAuditor.statusCode).toBe(200);
  });
});
