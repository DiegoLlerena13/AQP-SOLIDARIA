import { describe, it, expect } from 'vitest';
import {
  getPrincipal,
  parseCognitoGroups,
  parseScopes,
  AuthzError
} from '../../src/authz/index.js';
import { createMockV2Event } from '../helpers/mockEvents.js';

describe('principal.ts - Extracción de identidad y normalización de claims', () => {
  describe('parseCognitoGroups()', () => {
    it('debe parsear arreglo nativo de grupos válidos', () => {
      const result = parseCognitoGroups(['DONANTE', 'GESTOR']);
      expect(result).toEqual(['DONANTE', 'GESTOR']);
    });

    it('debe parsear cadena simple con un solo rol', () => {
      const result = parseCognitoGroups('DONANTE');
      expect(result).toEqual(['DONANTE']);
    });

    it('debe parsear formato Cognito con corchetes y espacios "[DONANTE GESTOR]"', () => {
      const result = parseCognitoGroups('[DONANTE GESTOR]');
      expect(result).toEqual(['DONANTE', 'GESTOR']);
    });

    it('debe parsear formato JSON string \'["DONANTE","AUDITOR"]\'', () => {
      const result = parseCognitoGroups('["DONANTE","AUDITOR"]');
      expect(result).toEqual(['DONANTE', 'AUDITOR']);
    });

    it('debe parsear cadena separada por comas y espacios "DONANTE, GESTOR"', () => {
      const result = parseCognitoGroups('DONANTE, GESTOR');
      expect(result).toEqual(['DONANTE', 'GESTOR']);
    });

    it('debe descartar grupos no reconocidos y preservar solo roles válidos', () => {
      const result = parseCognitoGroups('[DONANTE ADMIN ROOT SUPERUSER AUDITOR]');
      expect(result).toEqual(['DONANTE', 'AUDITOR']);
    });

    it('debe retornar arreglo vacío ante entradas vacías, nulas o corchetes solos', () => {
      expect(parseCognitoGroups(undefined)).toEqual([]);
      expect(parseCognitoGroups(null)).toEqual([]);
      expect(parseCognitoGroups('')).toEqual([]);
      expect(parseCognitoGroups('   ')).toEqual([]);
      expect(parseCognitoGroups('[]')).toEqual([]);
      expect(parseCognitoGroups('[ ]')).toEqual([]);
    });

    it('debe deduplicar grupos repetidos', () => {
      const result = parseCognitoGroups('[DONANTE DONANTE GESTOR]');
      expect(result).toEqual(['DONANTE', 'GESTOR']);
    });
  });

  describe('parseScopes()', () => {
    it('debe parsear arreglo nativo de scopes', () => {
      const result = parseScopes(['api/donations.write', 'api/donations.read']);
      expect(result).toEqual(['api/donations.write', 'api/donations.read']);
    });

    it('debe parsear cadena OAuth2 delimitada por espacios', () => {
      const result = parseScopes('api/donations.write api/donations.read');
      expect(result).toEqual(['api/donations.write', 'api/donations.read']);
    });

    it('debe parsear JSON string de scopes', () => {
      const result = parseScopes('["api/projects.write"]');
      expect(result).toEqual(['api/projects.write']);
    });

    it('debe parsear scopes con corchetes no JSON "[scope1 scope2]"', () => {
      const result = parseScopes('[api/projects.write api/donations.write]');
      expect(result).toEqual(['api/projects.write', 'api/donations.write']);
    });

    it('debe retornar vacío ante valores nulos o cadenas vacías', () => {
      expect(parseScopes(undefined)).toEqual([]);
      expect(parseScopes(null)).toEqual([]);
      expect(parseScopes('')).toEqual([]);
    });
  });

  describe('getPrincipal()', () => {
    it('[CA-03.2] lanza 401 si el evento carece de JWT o claims', () => {
      const eventSinJwt = createMockV2Event({ omitJwt: true });
      expect(() => getPrincipal(eventSinJwt)).toThrow(AuthzError);

      try {
        getPrincipal(eventSinJwt);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
      }
    });

    it('[CA-03.2] lanza 401 si falta el claim sub o viene vacío', () => {
      const eventSinSub = createMockV2Event({ sub: '' });
      expect(() => getPrincipal(eventSinSub)).toThrow(AuthzError);

      try {
        getPrincipal(eventSinSub);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
      }
    });

    it('[CA-04.3][CA-05.3] extrae sub y grupos de claims e IGNORA campos falsos en body o headers', () => {
      const eventManipulado = createMockV2Event({
        sub: 'real-donor-sub-1234',
        groups: '[DONANTE]',
        scopes: ['api/donations.write'],
        headers: {
          'x-injected-sub': 'fake-hacker-sub',
          'x-injected-role': 'GESTOR'
        },
        body: {
          donorSub: 'fake-hacker-sub',
          groups: ['GESTOR', 'AUDITOR'],
          role: 'GESTOR'
        }
      });

      const principal = getPrincipal(eventManipulado);

      expect(principal.sub).toBe('real-donor-sub-1234');
      expect(principal.groups).toEqual(['DONANTE']);
      expect(principal.scopes).toEqual(['api/donations.write']);
      expect(principal.requestId).toBe('req-test-1234');
    });

    it('extrae client_id y requestId correctamente', () => {
      const event = createMockV2Event({
        sub: 'user-sub-abc',
        clientId: 'app-client-xyz-789',
        requestId: 'req-aws-999'
      });

      const principal = getPrincipal(event);
      expect(principal.clientId).toBe('app-client-xyz-789');
      expect(principal.requestId).toBe('req-aws-999');
    });
  });
});
