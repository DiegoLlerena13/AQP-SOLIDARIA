/**
 * @file rbac.ts
 * @description Control de acceso basado en roles (RBAC) y scopes OAuth2 (Capa 2 / Policy Engine).
 * Aplica el principio Zero Trust de defensa en profundidad: aunque API Gateway valide
 * scopes en la Capa 1, Lambda comprueba de forma explcita tanto roles como scopes.
 */

import { AuthzError } from './errors.js';
import type { Principal, Role } from './principal.js';

/**
 * Comprueba si el Principal posee al menos uno de los roles solicitados.
 */
export function hasRole(principal: Principal, ...roles: Role[]): boolean {
  if (!principal || !Array.isArray(principal.groups)) {
    return false;
  }
  return roles.some(role => principal.groups.includes(role));
}

/**
 * Exige que el Principal tenga al menos uno de los roles requeridos.
 * Lanza AuthzError(403) si no cuenta con el rol (T03, T12, CA-04.1, CA-04.2).
 */
export function requireRole(principal: Principal, ...roles: Role[]): void {
  if (!hasRole(principal, ...roles)) {
    throw new AuthzError(
      403,
      'FORBIDDEN',
      `Acceso denegado: se requiere uno de los siguientes roles: ${roles.join(', ')}`
    );
  }
}

/**
 * Comprueba si el Principal posee el scope requerido.
 */
export function hasScope(principal: Principal, requiredScope: string): boolean {
  if (!principal || !Array.isArray(principal.scopes)) {
    return false;
  }
  return principal.scopes.includes(requiredScope);
}

/**
 * Exige que el Principal posea el scope requerido.
 * Lanza AuthzError(403) si el scope est ausente.
 */
export function requireScope(principal: Principal, requiredScope: string): void {
  if (!hasScope(principal, requiredScope)) {
    throw new AuthzError(
      403,
      'FORBIDDEN',
      `Acceso denegado: scope requerido ${requiredScope}`
    );
  }
}
