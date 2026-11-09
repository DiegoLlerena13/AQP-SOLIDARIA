/**
 * @file withAuthz.ts
 * @description Wrapper de orden superior (middleware) para handlers AWS Lambda.
 * Aplica la Capa 2 de autorizacin Zero Trust (Policy Engine) antes de delegar en la lgica de negocio:
 * 1. Extrae y valida la identidad (Principal) desde claims verificados (getPrincipal).
 * 2. Verifica los scopes exigidos (requireScope).
 * 3. Verifica los roles RBAC requeridos (requireRole).
 * 4. Pasa el principal autenticado directamente al handler.
 * 5. Captura AuthzError y genera respuestas uniformes { code, message, requestId }.
 * 6. Realiza logging estructurado y sanitizado (nunca registra tokens ni claims completos).
 */

import { AuthzError, formatErrorResponse, type UniformResponse } from './errors.js';
import { getPrincipal, type Principal, type Role } from './principal.js';
import { requireRole, requireScope } from './rbac.js';

export interface WithAuthzOptions {
  /**
   * Roles permitidos para acceder a este handler. El usuario debe poseer al menos uno.
   */
  roles?: Role[];
  /**
   * Scopes OAuth2 requeridos para acceder a este handler. Todos los listados son exigidos.
   */
  scopes?: string[];
}

/**
 * Tipo de funcin para los handlers que reciben el evento y el Principal autenticado.
 */
export type AuthorizedHandler<TEvent = any, TResult = any> = (
  event: TEvent,
  principal: Principal
) => Promise<TResult>;

/**
 * Envuelve un handler de Lambda con validaciones de autenticacin y autorizacin en Capa 2.
 *
 * @example
 * ```typescript
 * import { withAuthz, assertOwner } from '../authz/index.js';
 *
 * export const handler = withAuthz(
 *   { roles: ['DONANTE'], scopes: ['api/donations.write'] },
 *   async (event, principal) => {
 *     // Lgica de negocio aqu
 *     // donorSub garantizado desde principal.sub, nunca desde el body
 *     const donorSub = principal.sub;
 *     // ...
 *     return { statusCode: 200, body: JSON.stringify({ ok: true }) };
 *   }
 * );
 * ```
 */
export function withAuthz<TEvent = any>(
  options: WithAuthzOptions,
  handler: AuthorizedHandler<TEvent>
): (event: TEvent) => Promise<UniformResponse | any> {
  return async (event: TEvent): Promise<UniformResponse | any> => {
    const requestId = (event as any)?.requestContext?.requestId || 'unknown';

    try {
      // 1. Extraer Principal de los claims verificados
      const principal = getPrincipal(event);

      // 2. Validar scopes requeridos (defensa en profundidad frente al PEP de API Gateway)
      if (options.scopes && options.scopes.length > 0) {
        for (const scope of options.scopes) {
          requireScope(principal, scope);
        }
      }

      // 3. Validar roles requeridos (RBAC)
      if (options.roles && options.roles.length > 0) {
        requireRole(principal, ...options.roles);
      }

      // 4. Delegar en la lgica de negocio pasando el principal verificado
      return await handler(event, principal);
    } catch (error: unknown) {
      // Registro seguro de auditora interna (sanitizado)
      if (error instanceof AuthzError) {
        console.warn(
          JSON.stringify({
            level: 'WARN',
            event: 'AUTHZ_REJECTED',
            code: error.code,
            statusCode: error.status,
            requestId
          })
        );
      } else {
        console.error(
          JSON.stringify({
            level: 'ERROR',
            event: 'UNEXPECTED_HANDLER_ERROR',
            code: 'INTERNAL_SERVER_ERROR',
            requestId
          })
        );
      }

      return formatErrorResponse(error, requestId);
    }
  };
}
