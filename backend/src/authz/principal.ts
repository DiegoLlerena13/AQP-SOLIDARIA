/**
 * @file principal.ts
 * @description Extraccin y normalizacin de la identidad (Principal) desde eventos HTTP API Payload v2.
 * Implementa la obtencin de sub y cognito:groups exclusivamente desde claims verificados por el autorizador
 * (CA-04.3, CA-05.3), descartando datos no confiables de encabezados, query o body.
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
 * - Vacos o nulos: undefined, null, "", "[]"
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
 * Acepta arreglos nativos o cadenas delimitadas por espacios (estndar OAuth2).
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
 * Lanza AuthzError(401) si no hay claims verificados o si falta el claim `sub`.
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
    throw new AuthzError(401, 'UNAUTHORIZED', 'Autenticacin requerida: token ausente o invlido');
  }

  const rawSub = claims.sub;
  if (!rawSub || typeof rawSub !== 'string' || rawSub.trim().length === 0) {
    throw new AuthzError(401, 'UNAUTHORIZED', 'Claim sub ausente o invlido en el token');
  }

  const sub = rawSub.trim();
  const rawGroups = claims['cognito:groups'] ?? claims.groups;
  const groups = parseCognitoGroups(rawGroups);

  const rawScopes = authorizerJwt.scopes ?? claims.scope ?? claims.scp;
  const scopes = parseScopes(rawScopes);

  const clientId = typeof claims.client_id === 'string'
    ? claims.client_id.trim()
    : undefined;

  return {
    sub,
    groups,
    scopes,
    clientId,
    requestId
  };
}
