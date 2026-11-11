import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseCognitoGroups,
  parseScopes,
  getPrincipal,
  VALID_ROLES
} from '../../src/authz/principal.js';
import { AuthzError } from '../../src/authz/errors.js';
import { createMockV2Event } from '../helpers/mockEvents.js';

describe('principal.ts - Extracción y Normalización de Identidad', () => {
  describe('parseCognitoGroups', () => {
    it('parsea corchetes separados por espacios: "[DONANTE GESTOR]"', () => {
      const groups = parseCognitoGroups('[DONANTE GESTOR]');
      expect(groups).toEqual(['DONANTE', 'GESTOR']);
    });

    it('parsea cadena JSON: \'["DONANTE", "AUDITOR"]\'', () => {
      const groups = parseCognitoGroups('["DONANTE", "AUDITOR"]');
      expect(groups).toEqual(['DONANTE', 'AUDITOR']);
    });

    it('parsea cadena simple: "DONANTE"', () => {
      const groups = parseCognitoGroups('DONANTE');
      expect(groups).toEqual(['DONANTE']);
    });

    it('parsea array nativo: ["GESTOR", "AUDITOR"]', () => {
      const groups = parseCognitoGroups(['GESTOR', 'AUDITOR']);
      expect(groups).toEqual(['GESTOR', 'AUDITOR']);
    });

    it('parsea cadena separada por comas: "DONANTE, GESTOR"', () => {
      const groups = parseCognitoGroups('DONANTE, GESTOR');
      expect(groups).toEqual(['DONANTE', 'GESTOR']);
    });

    it('descarta grupos desconocidos o inyectados y desduplica', () => {
      const groups = parseCognitoGroups('[DONANTE ADMIN ROOT HACKER DONANTE]');
      expect(groups).toEqual(['DONANTE']);
    });

    it('retorna arreglo vacío ante null, undefined, cadena vacía o "[]"', () => {
      expect(parseCognitoGroups(null)).toEqual([]);
      expect(parseCognitoGroups(undefined)).toEqual([]);
      expect(parseCognitoGroups('')).toEqual([]);
      expect(parseCognitoGroups('   ')).toEqual([]);
      expect(parseCognitoGroups('[]')).toEqual([]);
    });

    it('roles válidos deben ser exactamente DONANTE, GESTOR, AUDITOR', () => {
      expect(VALID_ROLES).toEqual(['DONANTE', 'GESTOR', 'AUDITOR']);
    });
  });

  describe('parseScopes', () => {
    it('parsea cadena delimitada por espacios (formato OAuth2)', () => {
      const scopes = parseScopes('openid email api/donations.write');
      expect(scopes).toEqual(['openid', 'email', 'api/donations.write']);
    });

    it('parsea arreglo de strings', () => {
      const scopes = parseScopes(['api/donations.read', 'api/projects.write']);
      expect(scopes).toEqual(['api/donations.read', 'api/projects.write']);
    });

    it('parsea JSON string de scopes', () => {
      const scopes = parseScopes('["api/donations.write", "api/donations.read"]');
      expect(scopes).toEqual(['api/donations.write', 'api/donations.read']);
    });

    it('retorna vacío ante valores nulos o indefinidos', () => {
      expect(parseScopes(null)).toEqual([]);
      expect(parseScopes(undefined)).toEqual([]);
      expect(parseScopes('')).toEqual([]);
    });
  });

  describe('getPrincipal', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('extrae exitosamente sub, grupos y scopes de evento Payload v2', () => {
      const event = createMockV2Event({
        sub: 'usr-1234-uuid',
        groups: ['DONANTE'],
        scopes: ['api/donations.write']
      });

      const principal = getPrincipal(event);

      expect(principal.sub).toBe('usr-1234-uuid');
      expect(principal.groups).toEqual(['DONANTE']);
      expect(principal.scopes).toEqual(['api/donations.write']);
      expect(principal.requestId).toBe('req-test-1234');
    });

    it('[CA-03.2] lanza AuthzError 401 si no hay claims verificados (sin authorizer)', () => {
      const eventSinJwt = createMockV2Event({ omitJwt: true });

      expect(() => getPrincipal(eventSinJwt)).toThrow(AuthzError);

      try {
        getPrincipal(eventSinJwt);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
      }
    });

    it('[CA-03.2] lanza AuthzError 401 si falta el claim sub', () => {
      const eventSinSub = createMockV2Event({ sub: '' });

      expect(() => getPrincipal(eventSinSub)).toThrow(AuthzError);

      try {
        getPrincipal(eventSinSub);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
      }
    });

    it('[CA-03.2] rechaza ID token con HTTP 401 si token_use es "id"', () => {
      const eventIdToken = createMockV2Event({
        sub: 'usr-id-token-user',
        rawClaims: {
          token_use: 'id',
          email: 'donor@aqp-solidaria.org'
        }
      });

      expect(() => getPrincipal(eventIdToken)).toThrow(AuthzError);

      try {
        getPrincipal(eventIdToken);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
        expect(err.message).toContain('ID token');
      }
    });

    it('[CA-03.2] acepta access token legítimo con token_use: "access"', () => {
      const eventAccessToken = createMockV2Event({
        sub: 'usr-access-token-user',
        scopes: ['api/donations.write'],
        groups: ['DONANTE'],
        rawClaims: {
          token_use: 'access',
          client_id: '7ft2f51iags0qnirve0vocq5s9'
        }
      });

      const principal = getPrincipal(eventAccessToken);
      expect(principal.sub).toBe('usr-access-token-user');
      expect(principal.clientId).toBe('7ft2f51iags0qnirve0vocq5s9');
    });

    it('[CA-03.2] rechaza token si COGNITO_CLIENT_ID difiere del client_id del token', () => {
      process.env.COGNITO_CLIENT_ID = '7ft2f51iags0qnirve0vocq5s9';

      const eventOtroClient = createMockV2Event({
        sub: 'usr-123',
        clientId: 'otro-client-hacker-999',
        groups: ['DONANTE']
      });

      expect(() => getPrincipal(eventOtroClient)).toThrow(AuthzError);

      try {
        getPrincipal(eventOtroClient);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.message).toContain('client_id');
      }
    });

    it('[CA-03.2] rechaza token si COGNITO_USER_POOL_ID no coincide con el issuer', () => {
      process.env.COGNITO_USER_POOL_ID = 'us-east-2_DH2KMafTU';

      const eventOtroPool = createMockV2Event({
        sub: 'usr-123',
        rawClaims: {
          iss: 'https://cognito-idp.us-east-2.amazonaws.com/us-east-2_OTROPOOL'
        }
      });

      expect(() => getPrincipal(eventOtroPool)).toThrow(AuthzError);

      try {
        getPrincipal(eventOtroPool);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.message).toContain('User Pool');
      }
    });

    it('valida exitosamente los datos reales de AWS Cognito (us-east-2_DH2KMafTU y 7ft2f51iags0qnirve0vocq5s9)', () => {
      process.env.COGNITO_USER_POOL_ID = 'us-east-2_DH2KMafTU';
      process.env.COGNITO_CLIENT_ID = '7ft2f51iags0qnirve0vocq5s9';

      const eventRealAws = createMockV2Event({
        sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        groups: ['DONANTE'],
        scopes: ['api/donations.write', 'api/donations.read'],
        rawClaims: {
          token_use: 'access',
          client_id: '7ft2f51iags0qnirve0vocq5s9',
          iss: 'https://cognito-idp.us-east-2.amazonaws.com/us-east-2_DH2KMafTU'
        }
      });

      const principal = getPrincipal(eventRealAws);
      expect(principal.sub).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(principal.groups).toEqual(['DONANTE']);
      expect(principal.scopes).toContain('api/donations.write');
      expect(principal.clientId).toBe('7ft2f51iags0qnirve0vocq5s9');
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
        clientId: '7ft2f51iags0qnirve0vocq5s9',
        requestId: 'req-aws-999'
      });

      const principal = getPrincipal(event);
      expect(principal.clientId).toBe('7ft2f51iags0qnirve0vocq5s9');
      expect(principal.requestId).toBe('req-aws-999');
    });

        it('[CA-03.2] fail-closed: sin COGNITO_CLIENT_ID o COGNITO_USER_POOL_ID responde 401', () => {
      const savedClient = process.env.COGNITO_CLIENT_ID;
      const savedPool = process.env.COGNITO_USER_POOL_ID;
      try {
        delete process.env.COGNITO_CLIENT_ID;
        delete process.env.COGNITO_USER_POOL_ID;

        const event = createMockV2Event({ sub: 'usr-123', groups: ['DONANTE'] });

        expect(() => getPrincipal(event)).toThrow(AuthzError);
        try {
          getPrincipal(event);
        } catch (err: any) {
          expect(err.status).toBe(401);
          expect(err.message).toContain('Configuración de seguridad incompleta');
        }
      } finally {
        process.env.COGNITO_CLIENT_ID = savedClient;
        process.env.COGNITO_USER_POOL_ID = savedPool;
      }
    });

    it('[CA-03.2] rechaza token sin el claim token_use (fail-closed)', () => {
      const event = createMockV2Event({
        sub: 'usr-123',
        groups: ['DONANTE'],
        rawClaims: { token_use: undefined }
      });

      expect(() => getPrincipal(event)).toThrow(AuthzError);
    });

    it('[CA-03.2] rechaza iss con el pool correcto como subcadena pero emisor distinto (sin includes)', () => {
      const event = createMockV2Event({
        sub: 'usr-123',
        groups: ['DONANTE'],
        rawClaims: {
          iss: 'https://evil.example.com/us-east-2_DH2KMafTU'
        }
      });

      expect(() => getPrincipal(event)).toThrow(AuthzError);
    });
  });
});
