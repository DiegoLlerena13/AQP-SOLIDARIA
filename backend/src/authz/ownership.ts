/**
 * @file ownership.ts
 * @description Verificacin estricta de propiedad de recursos (ABAC / Ownership).
 * Mitiga ataques de Broken Object Level Authorization (BOLA, OWASP API1:2023).
 *
 * REGLA DE SEGURIDAD CRTICA (CA-07.2, CA-04.2, T09):
 * Si el usuario autenticado intenta acceder a un recurso ajeno o inexistente,
 * la funcin lanza AuthzError 404 (NOT_FOUND) y NUNCA 403 (FORBIDDEN).
 * Esto evita enumerar o confirmar la existencia de recursos privados pertenecientes a otros donantes.
 */

import { AuthzError } from './errors.js';
import type { Principal } from './principal.js';

export interface OwnedResource {
  donorSub?: string | null;
  [key: string]: unknown;
}

/**
 * Valida que el recurso pertenezca exclusivamente al donante autenticado (principal.sub === resource.donorSub).
 * Si resource es null/undefined o donorSub no coincide, responde 404 NOT_FOUND.
 *
 * @param principal Identidad autenticada obtenida con getPrincipal
 * @param resource Recurso recuperado de DynamoDB
 * @throws {AuthzError} Con cdigo HTTP 404 si no coincide o no existe
 */
export function assertOwner(
  principal: Principal,
  resource: OwnedResource | null | undefined
): void {
  if (!resource || !resource.donorSub || resource.donorSub !== principal.sub) {
    throw new AuthzError(404, 'NOT_FOUND', 'Recurso no encontrado');
  }
}
