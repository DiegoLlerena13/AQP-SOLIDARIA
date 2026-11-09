import { describe, it, expect } from 'vitest';
import {
  requireRole,
  requireScope,
  hasRole,
  hasScope,
  AuthzError,
  type Principal
} from '../../src/authz/index.js';

describe('rbac.ts - Control de acceso basado en roles y scopes', () => {
  const donantePrincipal: Principal = {
    sub: 'sub-donante-1',
    groups: ['DONANTE'],
    scopes: ['api/donations.write', 'api/donations.read'],
    requestId: 'req-donante'
  };

  const gestorPrincipal: Principal = {
    sub: 'sub-gestor-1',
    groups: ['GESTOR'],
    scopes: ['api/projects.write'],
    requestId: 'req-gestor'
  };

  const auditorPrincipal: Principal = {
    sub: 'sub-auditor-1',
    groups: ['AUDITOR'],
    scopes: ['api/audit.read'],
    requestId: 'req-auditor'
  };

  const usuarioSinRol: Principal = {
    sub: 'sub-sin-rol-1',
    groups: [],
    scopes: [],
    requestId: 'req-anon'
  };

  describe('requireRole()', () => {
    it('[T03][CA-04.1] DONANTE intenta acción de GESTOR -> 403 FORBIDDEN', () => {
      expect(() => requireRole(donantePrincipal, 'GESTOR')).toThrow(AuthzError);

      try {
        requireRole(donantePrincipal, 'GESTOR');
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
      }
    });

    it('[T12][CA-04.2] GESTOR intenta acceder a historial reservado a DONANTE -> 403 FORBIDDEN', () => {
      expect(() => requireRole(gestorPrincipal, 'DONANTE')).toThrow(AuthzError);

      try {
        requireRole(gestorPrincipal, 'DONANTE');
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
      }
    });

    it('Usuario sin roles intenta acción protegida -> 403 FORBIDDEN', () => {
      expect(() => requireRole(usuarioSinRol, 'DONANTE')).toThrow(AuthzError);
    });

    it('Camino feliz: GESTOR ejecuta acción con rol GESTOR', () => {
      expect(() => requireRole(gestorPrincipal, 'GESTOR')).not.toThrow();
    });

    it('Camino feliz: DONANTE ejecuta acción con rol DONANTE', () => {
      expect(() => requireRole(donantePrincipal, 'DONANTE')).not.toThrow();
    });

    it('Camino feliz: AUDITOR ejecuta acción con rol AUDITOR', () => {
      expect(() => requireRole(auditorPrincipal, 'AUDITOR')).not.toThrow();
    });

    it('Acepta múltiples roles alternativos si el usuario tiene uno de ellos', () => {
      expect(() => requireRole(gestorPrincipal, 'DONANTE', 'GESTOR')).not.toThrow();
    });
  });

  describe('requireScope()', () => {
    it('Scope ausente o insuficiente -> 403 FORBIDDEN', () => {
      expect(() => requireScope(donantePrincipal, 'api/projects.write')).toThrow(AuthzError);

      try {
        requireScope(donantePrincipal, 'api/projects.write');
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
      }
    });

    it('Camino feliz: usuario cuenta con el scope requerido', () => {
      expect(() => requireScope(donantePrincipal, 'api/donations.write')).not.toThrow();
      expect(() => requireScope(gestorPrincipal, 'api/projects.write')).not.toThrow();
      expect(() => requireScope(auditorPrincipal, 'api/audit.read')).not.toThrow();
    });
  });

  describe('hasRole() & hasScope()', () => {
    it('retorna booleanos coherentes', () => {
      expect(hasRole(donantePrincipal, 'DONANTE')).toBe(true);
      expect(hasRole(donantePrincipal, 'GESTOR')).toBe(false);
      expect(hasScope(donantePrincipal, 'api/donations.write')).toBe(true);
      expect(hasScope(donantePrincipal, 'api/projects.write')).toBe(false);
    });

    it('maneja valores nulos o inválidos de principal de forma segura', () => {
      expect(hasRole(null as any, 'DONANTE')).toBe(false);
      expect(hasRole({} as any, 'DONANTE')).toBe(false);
      expect(hasScope(null as any, 'api/donations.write')).toBe(false);
      expect(hasScope({} as any, 'api/donations.write')).toBe(false);
    });
  });
});
