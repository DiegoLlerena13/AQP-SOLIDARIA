import { describe, it, expect } from 'vitest';
import { withAuthz } from '../../src/authz/index.js';
import { createMockV2Event } from '../helpers/mockEvents.js';

describe('withAuthz.ts - Wrapper HOF para Lambdas', () => {
  it('[CA-03.2] sin claims o sin sub -> responde HTTP 401 con formato uniforme', async () => {
    const wrappedHandler = withAuthz(
      { roles: ['DONANTE'], scopes: ['api/donations.write'] },
      async () => ({ statusCode: 200, body: JSON.stringify({ ok: true }) })
    );

    const eventSinJwt = createMockV2Event({
      method: 'POST',
      path: '/v1/donations',
      omitJwt: true,
      requestId: 'req-401-test'
    });
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
      method: 'POST',
      path: '/v1/donations',
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
      method: 'POST',
      path: '/v1/projects',
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
      method: 'GET',
      path: '/v1/donations/me',
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
      method: 'POST',
      path: '/v1/donations',
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
      method: 'POST',
      path: '/v1/donations',
      sub: 'sub-donante',
      groups: '[DONANTE]',
      scopes: ['api/donations.write'],
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
      createMockV2Event({
        method: 'POST',
        path: '/v1/donations',
        sub: 'd1',
        groups: '[DONANTE]',
        scopes: ['api/donations.write']
      })
    );
    const resGestor = await gestorAction(
      createMockV2Event({
        method: 'POST',
        path: '/v1/projects',
        sub: 'g1',
        groups: '[GESTOR]',
        scopes: ['api/projects.write']
      })
    );
    const resAuditor = await auditorAction(
      createMockV2Event({
        method: 'GET',
        path: '/v1/audit',
        sub: 'a1',
        groups: '[AUDITOR]',
        scopes: ['api/audit.read']
      })
    );

    expect(resDonante.statusCode).toBe(201);
    expect(resGestor.statusCode).toBe(201);
    expect(resAuditor.statusCode).toBe(200);
  });

  describe('Integración con ENDPOINT_POLICIES en tiempo de ejecución (Paso 2 y 3)', () => {
    it('Ruta no listada en ENDPOINT_POLICIES -> responde 403 FORBIDDEN (Fail-closed)', async () => {
      const handler = withAuthz(async () => ({ statusCode: 200, body: 'ok' }));
      const eventNoListado = createMockV2Event({
        method: 'DELETE',
        path: '/v1/projects/123',
        sub: 'sub-gestor',
        groups: '[GESTOR]',
        scopes: ['api/projects.write'],
        requestId: 'req-unlisted'
      });

      const response = await handler(eventNoListado);
      expect(response.statusCode).toBe(403);

      const body = JSON.parse(response.body);
      expect(body.code).toBe('FORBIDDEN');
      expect(body.message).toContain('ruta no autorizada por política');
      expect(body.requestId).toBe('req-unlisted');
    });

    it('Ruta listada aplica sus scopes y roles sin necesidad de opciones explícitas: withAuthz(handler)', async () => {
      let executed = false;
      const handlerInformativo = withAuthz(async (_event, principal) => {
        executed = true;
        return { statusCode: 201, body: JSON.stringify({ donor: principal.sub }) };
      });

      // Petición válida para POST /v1/donations
      const validEvent = createMockV2Event({
        method: 'POST',
        path: '/v1/donations',
        sub: 'sub-donante-abc',
        groups: '[DONANTE]',
        scopes: ['api/donations.write']
      });

      const response = await handlerInformativo(validEvent);
      expect(response.statusCode).toBe(201);
      expect(executed).toBe(true);

      // Misma ruta con rol incorrecto (GESTOR) -> rechazada por la matriz
      const invalidEvent = createMockV2Event({
        method: 'POST',
        path: '/v1/donations',
        sub: 'sub-gestor-abc',
        groups: '[GESTOR]',
        scopes: ['api/donations.write']
      });

      const responseDenegada = await handlerInformativo(invalidEvent);
      expect(responseDenegada.statusCode).toBe(403);
    });

    it('Opciones explícitas no pueden relajar la matriz (nunca relajan la política)', async () => {
      // Intentar relajar POST /v1/projects (que exige GESTOR) diciendo que acepta DONANTE
      const handlerConIntentoDeRelax = withAuthz(
        { roles: ['DONANTE'] },
        async () => ({ statusCode: 201, body: 'creado' })
      );

      const eventDonante = createMockV2Event({
        method: 'POST',
        path: '/v1/projects',
        sub: 'sub-donante',
        groups: '[DONANTE]',
        scopes: ['api/projects.write']
      });

      const response = await handlerConIntentoDeRelax(eventDonante);
      // Falla porque la matriz exige GESTOR y las opciones explícitas no pueden relajar la matriz
      expect(response.statusCode).toBe(403);
    });

    it('Opciones explícitas pueden agregar requisitos adicionales (defensa en profundidad)', async () => {
      // POST /v1/donations exige DONANTE y api/donations.write. Agregamos un scope extra:
      const handlerConScopeExtra = withAuthz(
        { scopes: ['api/special.vip'] },
        async () => ({ statusCode: 201, body: 'ok' })
      );

      // Solo tiene el scope de la matriz, no el extra
      const eventSinExtra = createMockV2Event({
        method: 'POST',
        path: '/v1/donations',
        sub: 'sub-donante',
        groups: '[DONANTE]',
        scopes: ['api/donations.write']
      });

      const resSinExtra = await handlerConScopeExtra(eventSinExtra);
      expect(resSinExtra.statusCode).toBe(403);

      // Tiene ambos scopes
      const eventConExtra = createMockV2Event({
        method: 'POST',
        path: '/v1/donations',
        sub: 'sub-donante',
        groups: '[DONANTE]',
        scopes: ['api/donations.write', 'api/special.vip']
      });

      const resConExtra = await handlerConScopeExtra(eventConExtra);
      expect(resConExtra.statusCode).toBe(201);
    });

    it('Ruta pública envuelta en withAuthz -> denegada (403) por configuración errónea', async () => {
      const publicHandlerEnvuelto = withAuthz(async () => ({ statusCode: 200, body: 'catalogo' }));

      // GET /v1/projects es público en ENDPOINT_POLICIES
      const eventPublico = createMockV2Event({
        method: 'GET',
        path: '/v1/projects',
        sub: 'any-user'
      });

      const response = await publicHandlerEnvuelto(eventPublico);
      expect(response.statusCode).toBe(403);

      const body = JSON.parse(response.body);
      expect(body.code).toBe('FORBIDDEN');
      expect(body.message).toContain('Configuración errónea');
      expect(body.message).toContain('ruta pública');
    });

    it('POST /v1/donations/{donationId}/simulate fuera de stage academic -> denegada (403)', async () => {
      const simulateHandler = withAuthz(async () => ({
        statusCode: 200,
        body: JSON.stringify({ message: 'Simulación exitosa' })
      }));

      // Stage production -> denegado
      const eventProd = createMockV2Event({
        method: 'POST',
        path: '/v1/donations/don-123/simulate',
        routeKey: 'POST /v1/donations/{donationId}/simulate',
        sub: 'sub-donante',
        groups: '[DONANTE]',
        scopes: ['api/donations.write'],
        stage: 'production'
      });

      const resProd = await simulateHandler(eventProd);
      expect(resProd.statusCode).toBe(403);

      const bodyProd = JSON.parse(resProd.body);
      expect(bodyProd.message).toContain('requiere academic');

      // Stage academic -> permitido
      const eventAcademic = createMockV2Event({
        method: 'POST',
        path: '/v1/donations/don-123/simulate',
        routeKey: 'POST /v1/donations/{donationId}/simulate',
        sub: 'sub-donante',
        groups: '[DONANTE]',
        scopes: ['api/donations.write'],
        stage: 'academic'
      });

      const resAcademic = await simulateHandler(eventAcademic);
      expect(resAcademic.statusCode).toBe(200);
    });
  });
});
