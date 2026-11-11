import { describe, it, expect, vi } from 'vitest';
import { withAuthz } from '../../src/authz/withAuthz.js';
import { assertOwner } from '../../src/authz/ownership.js';
import { createMockV2Event } from '../helpers/mockEvents.js';

describe('withAuthz.ts - Wrapper HOF para Lambdas', () => {
  const dummyHandler = vi.fn(async (_event, principal) => {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Success', donorSub: principal.sub })
    };
  });

  it('[CA-03.2] sin claims o sin sub -> responde HTTP 401 con formato uniforme', async () => {
    const wrapped = withAuthz(dummyHandler);
    const eventSinClaims = createMockV2Event({
      omitJwt: true,
      requestId: 'req-401-test'
    });

    const response = await wrapped(eventSinClaims);

    expect(response.statusCode).toBe(401);
    expect(response.headers?.['Content-Type'] || response.headers?.['content-type']).toBe('application/json');

    const body = JSON.parse(response.body);
    expect(body.code).toBe('UNAUTHORIZED');
    expect(body.requestId).toBe('req-401-test');
    expect(body.message).toBeDefined();
  });

  it('scope insuficiente -> responde HTTP 403 FORBIDDEN', async () => {
    const wrapped = withAuthz(
      { scopes: ['api/donations.write'] },
      dummyHandler
    );

    const eventScopeInsuficiente = createMockV2Event({
      sub: 'user-sub-123',
      groups: ['DONANTE'],
      scopes: ['api/donations.read'], // Solo tiene read, requiere write
      requestId: 'req-scope-fail'
    });

    const response = await wrapped(eventScopeInsuficiente);

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.message).toContain('scope requerido');
  });

  it('[T03][CA-04.1] DONANTE intenta acción de GESTOR -> responde HTTP 403', async () => {
    const wrapped = withAuthz(
      { roles: ['GESTOR'], scopes: ['api/projects.write'] },
      dummyHandler
    );

    const eventDonante = createMockV2Event({
      sub: 'donor-user-123',
      groups: ['DONANTE'], // Rol inválido para esta operación
      scopes: ['api/projects.write'],
      path: '/v1/projects',
      method: 'POST',
      requestId: 'req-t03'
    });

    const response = await wrapped(eventDonante);

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.message).toContain('GESTOR');
  });

  it('[T12][CA-04.2] GESTOR intenta GET /v1/donations/me -> responde HTTP 403', async () => {
    const wrapped = withAuthz(
      { roles: ['DONANTE'], scopes: ['api/donations.read'] },
      dummyHandler
    );

    const eventGestor = createMockV2Event({
      sub: 'gestor-user-456',
      groups: ['GESTOR'],
      scopes: ['api/donations.read'],
      path: '/v1/donations/me',
      method: 'GET',
      requestId: 'req-t12'
    });

    const response = await wrapped(eventGestor);

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.message).toContain('DONANTE');
  });

  it('Solicitud válida con rol y scopes correctos -> delega en el handler y entrega Principal', async () => {
    dummyHandler.mockClear();

    const wrapped = withAuthz(dummyHandler);

    const eventValido = createMockV2Event({
      sub: 'donor-sub-789',
      groups: '[DONANTE]',
      scopes: ['api/donations.write'],
      path: '/v1/donations',
      method: 'POST',
      requestId: 'req-success-123'
    });

    const response = await wrapped(eventValido);

    expect(response.statusCode).toBe(200);
    expect(dummyHandler).toHaveBeenCalledTimes(1);

    const [receivedEvent, receivedPrincipal] = dummyHandler.mock.calls[0];
    expect(receivedEvent).toBe(eventValido);
    expect(receivedPrincipal.sub).toBe('donor-sub-789');
    expect(receivedPrincipal.groups).toEqual(['DONANTE']);
    expect(receivedPrincipal.scopes).toContain('api/donations.write');
  });

  it('La respuesta de error nunca incluye stack, tokens ni claims (Fail-closed & Sanitize)', async () => {
    const handlerExplota = vi.fn(async () => {
      throw new Error('Database password was supersecret_db_pass! at Object.<anonymous>');
    });

    const wrapped = withAuthz(handlerExplota);

    const event = createMockV2Event({
      sub: 'donor-sub-123',
      groups: ['DONANTE'],
      scopes: ['api/donations.write'],
      path: '/v1/donations',
      method: 'POST',
      requestId: 'req-err-leak'
    });

    const response = await wrapped(event);

    expect(response.statusCode).toBe(500);
    const rawBody = response.body;

    // No debe fugar el stack ni datos internos
    expect(rawBody).not.toContain('supersecret_db_pass');
    expect(rawBody).not.toContain('Object.<anonymous>');
    expect(rawBody).not.toContain('stack');

    const parsed = JSON.parse(rawBody);
    expect(parsed.code).toBe('INTERNAL_SERVER_ERROR');
    expect(parsed.message).toBe('Error interno del servidor');
    expect(parsed.requestId).toBe('req-err-leak');
  });

  describe('Integración con ENDPOINT_POLICIES en tiempo de ejecución', () => {
    it('Ruta no listada en ENDPOINT_POLICIES -> responde 403 FORBIDDEN (Fail-closed)', async () => {
      const wrapped = withAuthz(dummyHandler);
      const eventRutaNoListada = createMockV2Event({
        method: 'DELETE',
        path: '/v1/projects/123',
        routeKey: 'DELETE /v1/projects/123',
        sub: 'gestor-sub-1',
        groups: ['GESTOR'],
        requestId: 'req-unlisted'
      });

      const response = await wrapped(eventRutaNoListada);

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('FORBIDDEN');
      expect(body.message).toContain('ruta no autorizada por política');
    });

    it('Ruta listada aplica sus scopes y roles sin necesidad de opciones explícitas: withAuthz(handler)', async () => {
      const wrappedInferencia = withAuthz(async (_event, principal) => ({
        statusCode: 201,
        body: JSON.stringify({ donor: principal.sub })
      }));

      // Invocación válida para POST /v1/donations
      const eventValido = createMockV2Event({
        method: 'POST',
        path: '/v1/donations',
        routeKey: 'POST /v1/donations',
        sub: 'donante-1',
        groups: ['DONANTE'],
        scopes: ['api/donations.write']
      });

      const resValido = await wrappedInferencia(eventValido);
      expect(resValido.statusCode).toBe(201);

      // Invocación inválida: Rol GESTOR intenta POST /v1/donations sin rol DONANTE
      const eventInvalido = createMockV2Event({
        method: 'POST',
        path: '/v1/donations',
        routeKey: 'POST /v1/donations',
        sub: 'gestor-1',
        groups: ['GESTOR'],
        scopes: ['api/donations.write']
      });

      const resInvalido = await wrappedInferencia(eventInvalido);
      expect(resInvalido.statusCode).toBe(403);
      const body = JSON.parse(resInvalido.body);
      expect(body.message).toContain('DONANTE');
    });

    it('Opciones explícitas no pueden relajar la matriz (nunca relajan la política)', async () => {
      // Intento de relajar POST /v1/projects declarando que DONANTE puede entrar
      const handlerRelajado = withAuthz(
        { roles: ['DONANTE'] },
        dummyHandler
      );

      const eventDonante = createMockV2Event({
        method: 'POST',
        path: '/v1/projects',
        routeKey: 'POST /v1/projects',
        sub: 'donante-1',
        groups: ['DONANTE'],
        scopes: ['api/projects.write']
      });

      const response = await handlerRelajado(eventDonante);
      // La matriz exige GESTOR, la opción explícita 'DONANTE' no puede sobreescribir la matriz
      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('GESTOR');
    });

    it('Opciones explícitas pueden agregar requisitos adicionales (defensa en profundidad)', async () => {
      // Exigir scope adicional no contemplado en la matriz
      const handlerConScopeExtra = withAuthz(
        { scopes: ['api/super.scope'] },
        dummyHandler
      );

      const eventSinScopeExtra = createMockV2Event({
        method: 'POST',
        path: '/v1/donations',
        routeKey: 'POST /v1/donations',
        sub: 'donante-1',
        groups: ['DONANTE'],
        scopes: ['api/donations.write']
      });

      const response = await handlerConScopeExtra(eventSinScopeExtra);
      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('api/super.scope');
    });

    it('Ruta pública envuelta en withAuthz -> denegada (403) por configuración errónea', async () => {
      const publicHandler = withAuthz(async () => ({
        statusCode: 200,
        body: JSON.stringify({ projects: [] })
      }));

      const eventPublico = createMockV2Event({
        method: 'GET',
        path: '/v1/projects',
        routeKey: 'GET /v1/projects',
        sub: 'user-1',
        groups: ['DONANTE'],
        scopes: []
      });

      const response = await publicHandler(eventPublico);
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

    it('soporta eventos de API Gateway con prefijo de stage /academic en rawPath', async () => {
      const wrapped = withAuthz(async (_event, principal) => ({
        statusCode: 200,
        body: JSON.stringify({ sub: principal.sub })
      }));

      const eventConPrefijoStage = createMockV2Event({
        method: 'GET',
        path: '/academic/v1/donations/me',
        routeKey: 'GET /v1/donations/me',
        stage: 'academic',
        sub: 'donor-sub-real',
        groups: ['DONANTE'],
        scopes: ['api/donations.read']
      });

      const res = await wrapped(eventConPrefijoStage);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.sub).toBe('donor-sub-real');
    });

    it('[T09][CA-07.2] BOLA: assertOwner invocado dentro del handler retorna 404 NOT_FOUND formateado por withAuthz', async () => {
      const resourceHandler = withAuthz(async (_event, principal) => {
        // Simulando recurso recuperado de base de datos ajeno al usuario
        const recursoAjeno = {
          donationId: 'don-secret-999',
          donorSub: 'otro-donante-sub-555',
          amountCents: 50000
        };

        // Verificación BOLA
        assertOwner(principal, recursoAjeno);

        return {
          statusCode: 200,
          body: JSON.stringify(recursoAjeno)
        };
      });

      const eventAtacante = createMockV2Event({
        method: 'POST',
        path: '/v1/donations/don-secret-999/simulate',
        routeKey: 'POST /v1/donations/{donationId}/simulate',
        stage: 'academic',
        sub: 'atacante-sub-111',
        groups: ['DONANTE'],
        scopes: ['api/donations.write'],
        requestId: 'req-bola-test'
      });

      const res = await resourceHandler(eventAtacante);

      // BOLA mitigada: responde 404 y NUNCA revela información del recurso ni confirma su existencia
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('NOT_FOUND');
      expect(body.message).toBe('Recurso no encontrado');
      expect(body.requestId).toBe('req-bola-test');
      expect(res.body).not.toContain('50000');
      expect(res.body).not.toContain('otro-donante-sub-555');
    });
  });
});
