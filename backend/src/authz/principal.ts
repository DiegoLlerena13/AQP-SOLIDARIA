/**
 * @file principal.ts
 * @description Extracción y normalización de la identidad (Principal) desde eventos HTTP API Payload v2.
 * Implementa la obtención de sub y cognito:groups exclusivamente desde claims verificados por el autorizador
 * (CA-04.3, CA-05.3), descartando datos no confiables de encabezados, query o body.
 * Aplica defensa en profundidad rechazando ID tokens y validando client_id / issuer exactamente (CA-03.2).
 */

import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { AuthzError } from './errors.js';

export type Role = 'DONANTE' | 'GESTOR' | 'AUDITOR';

export const VALID_ROLES: readonly Role[] = ['DONANTE', 'GESTOR', 'AUDITOR'] as const;

export interface Principal {
  sub: string;
  groups: Role[];
  scopes: string[];
  clientId?: string;
  requestId: string;
}

/**
 * Parsea y normaliza el campo cognito:groups recibido en claims de Cognito.
 * En eventos Payload v2 de API Gateway, Cognito y API Gateway pueden serializar
 * los grupos en diversos formatos:
 * - Cadena separada por espacios entre corchetes: "[DONANTE GESTOR]"
 * - Cadena simple: "DONANTE"
 * - JSON string: '["DONANTE","GESTOR"]'
 * - Arreglo nativo: ["DONANTE", "GESTOR"]
 * - Cadena separada por comas o espacios: "DONANTE, GESTOR"
 * - Vacíos o nulos: undefined, null, "", "[]"
 *
 * Filtra de forma estricta descartando cualquier grupo no reconocido en VALID_ROLES.
 */
export function parseCognitoGroups(rawGroups: unknown): Role[] {
  if (rawGroups === undefined || rawGroups === null) {
    return [];
  }

  let candidates: string[] = [];

  if (Array.isArray(rawGroups)) {
    candidates = rawGroups.map(item => String(item).trim());
  } else if (typeof rawGroups === 'string') {
    const trimmed = rawGroups.trim();
    if (trimmed.length === 0 || trimmed === '[]') {
      return [];
    }

    // Caso 1: Cadena con formato JSON (ej. '["DONANTE","GESTOR"]')
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          candidates = parsed.map(item => String(item).trim());
        }
      } catch {
        // Caso 2: Formato Cognito con corchetes sin comillas (ej. "[DONANTE GESTOR]" o "[DONANTE, GESTOR]")
        const inner = trimmed.slice(1, -1).trim();
        candidates = inner.split(/[\s,]+/);
      }
    } else {
      // Caso 3: Cadena simple o delimitada por espacios/comas (ej. "DONANTE" o "DONANTE GESTOR")
      candidates = trimmed.split(/[\s,]+/);
    }
  }

  const validSet = new Set<string>(VALID_ROLES);
  const result: Role[] = [];

  for (const item of candidates) {
    const clean = item.replace(/["'\[\]]/g, '').trim();
    if (validSet.has(clean) && !result.includes(clean as Role)) {
      result.push(clean as Role);
    }
  }

  return result;
}

/**
 * Parsea y normaliza la lista de scopes autorizados por el authorizer.
 * Acepta arreglos nativos o cadenas delimitadas por espacios (estándar OAuth2).
 */
export function parseScopes(rawScopes: unknown): string[] {
  if (rawScopes === undefined || rawScopes === null) {
    return [];
  }

  if (Array.isArray(rawScopes)) {
    return rawScopes
      .map(s => String(s).trim())
      .filter(s => s.length > 0);
  }

  if (typeof rawScopes === 'string') {
    const trimmed = rawScopes.trim();
    if (!trimmed) {
      return [];
    }
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(s => String(s).trim()).filter(s => s.length > 0);
        }
      } catch {
        return trimmed
          .slice(1, -1)
          .split(/[\s,]+/)
          .map(s => s.trim())
          .filter(s => s.length > 0);
      }
    }
    return trimmed
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  return [];
}

/**
 * Obtiene el Principal autenticado a partir de un evento de API Gateway HTTP API v2 con JWT authorizer.
 * Lee exclusivamente de requestContext.authorizer.jwt.
 * Lanza AuthzError(401) si:
 * - No hay claims verificados o falta el claim `sub`
 * - COGNITO_CLIENT_ID o COGNITO_USER_POOL_ID no están definidos (Fail-closed)
 * - El token es un ID token en lugar de access token (claims.token_use !== 'access')
 * - El client_id del token no coincide exactamente con COGNITO_CLIENT_ID
 * - El iss del token no coincide exactamente con https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}
 *
 * @param event Evento APIGatewayProxyEventV2WithJWTAuthorizer o compatible
 * @returns Identidad verificada con sub, grupos válidos, scopes y requestId
 */
export function getPrincipal(
  event: APIGatewayProxyEventV2WithJWTAuthorizer | Record<string, unknown> | any
): Principal {
  const authorizerJwt = event?.requestContext?.authorizer?.jwt;
  const claims = authorizerJwt?.claims;
  const requestId = event?.requestContext?.requestId || 'unknown';

  if (!claims || typeof claims !== 'object') {
    throw new AuthzError(401, 'UNAUTHORIZED', 'Autenticación requerida: token ausente o inválido');
  }

  // CA-03.2: Fail-closed si COGNITO_CLIENT_ID o COGNITO_USER_POOL_ID no están definidos en el entorno
  const expectedClientId = process.env.COGNITO_CLIENT_ID;
  const expectedPoolId = process.env.COGNITO_USER_POOL_ID;

  if (!expectedClientId || !expectedPoolId) {
    throw new AuthzError(
      401,
      'UNAUTHORIZED',
      'Configuración de seguridad incompleta: COGNITO_CLIENT_ID y COGNITO_USER_POOL_ID son requeridos'
    );
  }

  // CA-03.2: Exigir access token. Si el token recibido tiene token_use explícito y no es 'access', rechazar
  if (claims.token_use !== 'access') {
    throw new AuthzError(401, 'UNAUTHORIZED', 'Token inválido: se requiere un access token, no un ID token');
  }

  const rawSub = claims.sub;
  if (!rawSub || typeof rawSub !== 'string' || rawSub.trim().length === 0) {
    throw new AuthzError(401, 'UNAUTHORIZED', 'Claim sub ausente o inválido en el token');
  }

  const sub = rawSub.trim();
  const rawGroups = claims['cognito:groups'] ?? claims.groups;
  const groups = parseCognitoGroups(rawGroups);

  const rawScopes = authorizerJwt.scopes ?? claims.scope ?? claims.scp;
  const scopes = parseScopes(rawScopes);

  const clientId = typeof claims.client_id === 'string'
    ? claims.client_id.trim()
    : (typeof claims.aud === 'string' ? claims.aud.trim() : undefined);

  // CA-03.2: Comparación estricta de client_id (debe coincidir exactamente con COGNITO_CLIENT_ID)
  if (!clientId || clientId !== expectedClientId) {
    throw new AuthzError(401, 'UNAUTHORIZED', 'Token emitido para un client_id no autorizado');
  }

  // CA-03.2: Comparación exacta de iss con https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}
  const awsRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-2';
  const expectedIssuer = `https://cognito-idp.${awsRegion}.amazonaws.com/${expectedPoolId}`;

  if (claims.iss !== expectedIssuer) {
    throw new AuthzError(401, 'UNAUTHORIZED', 'Token emitido por un User Pool no autorizado');
  }

  return {
    sub,
    groups,
    scopes,
    clientId,
    requestId
  };
}
