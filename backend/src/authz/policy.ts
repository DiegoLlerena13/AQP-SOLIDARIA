/**
 * @file policy.ts
 * @description Matriz declarativa de polticas de autorizacin (design.md 4).
 * Define los endpoints permitidos, sus scopes y roles requeridos.
 * Aplica el principio de denegacin por defecto (Fail-closed):
 * cualquier ruta o mtodo no explcitamente listado en esta matriz es denegado (HTTP 403).
 */

import { AuthzError } from './errors.js';
import type { Principal, Role } from './principal.js';
import { requireRole, requireScope } from './rbac.js';

export interface RoutePolicy {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly pathPattern: string;
  readonly isPublic?: boolean;
  readonly requiredRole?: Role;
  readonly requiredScope?: string;
  readonly requiresOwnership?: boolean;
  readonly stageRestriction?: string;
  readonly description: string;
}

/**
 * Matriz nica y autoritativa de endpoints del backend AQP-SOLIDARIA (design.md 4).
 */
export const ENDPOINT_POLICIES: readonly RoutePolicy[] = [
  {
    method: 'GET',
    pathPattern: '/v1/projects',
    isPublic: true,
    description: 'Catlogo pblico de proyectos confirmados y publicados'
  },
  {
    method: 'GET',
    pathPattern: '/v1/projects/{projectId}',
    isPublic: true,
    description: 'Detalle de proyecto pblico publicado'
  },
  {
    method: 'GET',
    pathPattern: '/v1/projects/{projectId}/stats',
    isPublic: true,
    description: 'Indicadores agregados y avance del proyecto'
  },
  {
    method: 'POST',
    pathPattern: '/v1/projects',
    requiredRole: 'GESTOR',
    requiredScope: 'api/projects.write',
    description: 'Creacin de nuevo proyecto en estado BORRADOR'
  },
  {
    method: 'PATCH',
    pathPattern: '/v1/projects/{projectId}/publish',
    requiredRole: 'GESTOR',
    requiredScope: 'api/projects.write',
    description: 'Publicacin de un proyecto en borrador'
  },
  {
    method: 'POST',
    pathPattern: '/v1/donations',
    requiredRole: 'DONANTE',
    requiredScope: 'api/donations.write',
    description: 'Creacin de intencin de donacin simulada'
  },
  {
    method: 'POST',
    pathPattern: '/v1/donations/{donationId}/simulate',
    requiredRole: 'DONANTE',
    requiredScope: 'api/donations.write',
    requiresOwnership: true,
    stageRestriction: 'academic',
    description: 'Confirmacin o rechazo de donacin propia (exclusivo stage academic)'
  },
  {
    method: 'GET',
    pathPattern: '/v1/donations/me',
    requiredRole: 'DONANTE',
    requiredScope: 'api/donations.read',
    description: 'Historial privado de donaciones del usuario autenticado'
  },
  {
    method: 'GET',
    pathPattern: '/v1/audit',
    requiredRole: 'AUDITOR',
    requiredScope: 'api/audit.read',
    description: 'Consulta de eventos crticos de auditora (extensin HU-10)'
  }
] as const;

/**
 * Comprueba si una ruta concreta coincide con un patrn parametrizado (ej. /v1/projects/{projectId}).
 */
export function matchesPath(pattern: string, path: string): boolean {
  // Normalizar barras al inicio y fin
  const cleanPattern = pattern.replace(/\/+$/, '') || '/';
  const cleanPath = path.replace(/\/+$/, '') || '/';

  if (cleanPattern === cleanPath) {
    return true;
  }

  const regexString = '^' + cleanPattern
    .replace(/\{[^}]+\}/g, '([^/]+)')
    .replace(/\//g, '\\/') + '$';

  const regex = new RegExp(regexString);
  return regex.test(cleanPath);
}

/**
 * Busca la poltica correspondiente a un mtodo y ruta dados.
 */
export function findPolicy(method: string, path: string): RoutePolicy | undefined {
  const upperMethod = method.toUpperCase();
  return ENDPOINT_POLICIES.find(
    policy => policy.method === upperMethod && matchesPath(policy.pathPattern, path)
  );
}

/**
 * Busca una poltica a partir del routeKey de API Gateway HTTP API v2
 * (ej. "POST /v1/donations", "POST /v1/donations/{donationId}/simulate" o "POST /v1/donations/d-123/simulate").
 */
export function findPolicyByRouteKey(routeKey: string): RoutePolicy | undefined {
  if (!routeKey || typeof routeKey !== 'string') {
    return undefined;
  }
  const parts = routeKey.trim().split(/\s+/);
  if (parts.length < 2) {
    return undefined;
  }
  const method = parts[0];
  const path = parts.slice(1).join(' ');
  return findPolicy(method, path);
}

/**
 * Evala la poltica para una solicitud.
 * Si la ruta no est registrada en la matriz, lanza AuthzError 403 (Deny by default).
 * Valida scope, rol y restricciones de entorno (stage academic).
 *
 * @param method Mtodo HTTP
 * @param path Ruta solicitada
 * @param principal Identidad verificada (requerida para rutas protegidas)
 * @param currentStage Entorno de ejecucin (opcional, ej. 'academic')
 * @returns La poltica validada que autoriz la solicitud
 */
export function assertRoutePolicy(
  method: string,
  path: string,
  principal?: Principal,
  currentStage?: string
): RoutePolicy {
  const policy = findPolicy(method, path);

  if (!policy) {
    throw new AuthzError(
      403,
      'FORBIDDEN',
      `Acceso denegado: ruta no permitida por poltica (${method} ${path})`
    );
  }

  // Rutas pblicas no requieren autenticacin
  if (policy.isPublic) {
    return policy;
  }

  // Rutas protegidas requieren Principal vlido
  if (!principal) {
    throw new AuthzError(401, 'UNAUTHORIZED', 'Autenticacin requerida para este endpoint');
  }

  // Validacin de restriccin de stage (ej. solo stage academic para /simulate)
  if (policy.stageRestriction) {
    const stage = currentStage || process.env.APP_ENV || process.env.STAGE;
    if (stage !== policy.stageRestriction) {
      throw new AuthzError(
        403,
        'FORBIDDEN',
        `Endpoint no disponible en este stage (requiere ${policy.stageRestriction})`
      );
    }
  }

  // Validacin de scope OAuth2
  if (policy.requiredScope) {
    requireScope(principal, policy.requiredScope);
  }

  // Validacin de Rol RBAC
  if (policy.requiredRole) {
    requireRole(principal, policy.requiredRole);
  }

  return policy;
}
