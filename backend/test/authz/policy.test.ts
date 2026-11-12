import { describe, it, expect } from 'vitest';
import {
  assertRoutePolicy,
  findPolicy,
  matchesPath,
  normalizePath,
  AuthzError,
  type Principal
} from '../../src/authz/index.js';

describe('policy.ts - Matriz declarativa y Fail-Closed', () => {
  const donante: Principal = {
    sub: 'sub-donante',
    groups: ['DONANTE'],
    scopes: ['api/donations.write', 'api/donations.read'],
    requestId: 'req-1'
  };

  const gestor: Principal = {
    sub: 'sub-gestor',
    groups: ['GESTOR'],
    scopes: ['api/projects.write'],
    requestId: 'req-2'
  };

  const auditor: Principal = {
    sub: 'sub-auditor',
    groups: ['AUDITOR'],
    scopes: ['api/audit.read'],
    requestId: 'req-3'
  };

  describe('matchesPath()', () => {
    it('reconoce rutas exactas y con parámetros dinámicos', () => {
      expect(matchesPath('/v1/projects', '/v1/projects')).toBe(true);
      expect(matchesPath('/v1/projects/{projectId}', '/v1/projects/abc-123')).toBe(true);
      expect(matchesPath('/v1/projects/{projectId}/stats', '/v1/projects/abc-123/stats')).toBe(true);
      expect(matchesPath('/v1/projects/{projectId}', '/v1/projects/abc-123/stats')).toBe(false);
      expect(matchesPath('/v1/donations/{donationId}/simulate', '/v1/donations/don-999/simulate')).toBe(true);
    });
  });

  describe('normalizePath()', () => {
    it('remueve el prefijo de stage academic de la ruta si está presente', () => {
      expect(normalizePath('/academic/v1/projects', 'academic')).toBe('/v1/projects');
      expect(normalizePath('/academic/v1/donations/me', 'academic')).toBe('/v1/donations/me');
      expect(normalizePath('/v1/donations/me', 'academic')).toBe('/v1/donations/me');
      expect(normalizePath('/academic', 'academic')).toBe('/');
    });
  });

  describe('findPolicy()', () => {
    it('encuentra la política correspondiente ignorando mayúsculas/minúsculas en método', () => {
      const policy = findPolicy('post', '/v1/donations');
      expect(policy).toBeDefined();
      expect(policy?.requiredRole).toBe('DONANTE');
      expect(policy?.requiredScope).toBe('api/donations.write');
    });

    it('resuelve rutas con prefijo de stage /academic en API Gateway real', () => {
      const policy = findPolicy('GET', '/academic/v1/projects', 'academic');
      expect(policy).toBeDefined();
      expect(policy?.isPublic).toBe(true);
    });

    it('resuelve compatibilidad con PublishProject usando POST en lugar de PATCH', () => {
      const policy = findPolicy('POST', '/v1/projects/proj-123/publish');
      expect(policy).toBeDefined();
      expect(policy?.requiredRole).toBe('GESTOR');
      expect(policy?.requiredScope).toBe('api/projects.write');
    });

    it('retorna undefined para rutas no configuradas', () => {
      expect(findPolicy('DELETE', '/v1/projects/abc')).toBeUndefined();
      expect(findPolicy('GET', '/v2/donations')).toBeUndefined();
    });
  });

  describe('assertRoutePolicy()', () => {
    it('permite acceso público a GET /v1/projects sin requerir Principal', () => {
      const policy = assertRoutePolicy('GET', '/v1/projects');
      expect(policy.isPublic).toBe(true);
    });

    it('permite acceso público a GET /v1/projects/{projectId}', () => {
      const policy = assertRoutePolicy('GET', '/v1/projects/proj-001');
      expect(policy.isPublic).toBe(true);
    });

    it('deniega con 403 (FORBIDDEN) rutas no listadas (Fail-closed)', () => {
      expect(() => assertRoutePolicy('DELETE', '/v1/projects/proj-001', gestor)).toThrow(
        AuthzError
      );

      try {
        assertRoutePolicy('DELETE', '/v1/projects/proj-001', gestor);
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
      }
    });

    it('POST /v1/projects permite a GESTOR con scope api/projects.write', () => {
      expect(() => assertRoutePolicy('POST', '/v1/projects', gestor)).not.toThrow();
      expect(() => assertRoutePolicy('POST', '/v1/projects', donante)).toThrow(AuthzError);
    });

    it('PATCH /v1/projects/{projectId}/publish permite a GESTOR con scope api/projects.write', () => {
      expect(() => assertRoutePolicy('PATCH', '/v1/projects/proj-123/publish', gestor)).not.toThrow();
      expect(() => assertRoutePolicy('PATCH', '/v1/projects/proj-123/publish', donante)).toThrow(AuthzError);
    });

    it('POST /v1/donations permite a DONANTE con scope api/donations.write', () => {
      expect(() => assertRoutePolicy('POST', '/v1/donations', donante)).not.toThrow();
      expect(() => assertRoutePolicy('POST', '/v1/donations', gestor)).toThrow(AuthzError);
    });

    it('POST /v1/donations/{donationId}/simulate restringido a stage academic', () => {
      // En stage academic: permitido para DONANTE
      expect(() =>
        assertRoutePolicy('POST', '/v1/donations/d-1/simulate', donante, 'academic')
      ).not.toThrow();

      // En stage production: denegado
      expect(() =>
        assertRoutePolicy('POST', '/v1/donations/d-1/simulate', donante, 'production')
      ).toThrow(AuthzError);

      // Usando process.env.APP_ENV
      const oldEnv = process.env.APP_ENV;
      process.env.APP_ENV = 'academic';
      expect(() =>
        assertRoutePolicy('POST', '/v1/donations/d-1/simulate', donante)
      ).not.toThrow();
      process.env.APP_ENV = oldEnv;
    });

    it('GET /v1/donations/me permite a DONANTE con scope api/donations.read', () => {
      expect(() => assertRoutePolicy('GET', '/v1/donations/me', donante)).not.toThrow();
      expect(() => assertRoutePolicy('GET', '/v1/donations/me', gestor)).toThrow(AuthzError);
    });

    it('GET /v1/audit permite a AUDITOR con scope api/audit.read', () => {
      expect(() => assertRoutePolicy('GET', '/v1/audit', auditor)).not.toThrow();
      expect(() => assertRoutePolicy('GET', '/v1/audit', donante)).toThrow(AuthzError);
      expect(() => assertRoutePolicy('GET', '/v1/audit', gestor)).toThrow(AuthzError);
    });
  });
});
