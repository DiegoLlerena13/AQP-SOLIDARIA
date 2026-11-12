/**
 * @file withAuthz.ts
 * @description Wrapper de orden superior (middleware) para handlers AWS Lambda.
 * Aplica la Capa 2 de autorización Zero Trust usando ENDPOINT_POLICIES como fuente de verdad:
 * 1. Extrae routeKey del evento HTTP API v2 y busca la política en la matriz declarativa (Fail-Closed).
 * 2. Si la ruta es pública, deniega (403) por configuración errónea (withAuthz solo aplica a rutas protegidas).
 * 3. Aplica restricción de stage (ej. simulate exclusivo para 'academic' usando event.requestContext.stage).
 * 4. Extrae y valida la identidad (Principal) desde claims verificados (getPrincipal).
 * 5. Verifica los scopes exigidos por la matriz y los opcionales adicionales (nunca relajan la matriz).
 * 6. Verifica los roles RBAC requeridos por la matriz y los opcionales adicionales.
 * 7. Pasa el principal autenticado directamente al handler.
 * 8. Captura AuthzError y genera respuestas uniformes { code, message, requestId }.
 * 9. Realiza logging estructurado y sanitizado con route y durationMs (nunca tokens, claims ni correo).
 */

import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2
} from 'aws-lambda';
import { AuthzError, formatErrorResponse, type UniformResponse } from './errors.js';
import { findPolicyByRouteKey } from './policy.js';
import { getPrincipal, type Principal, type Role } from './principal.js';
import { requireRole, requireScope } from './rbac.js';

export interface WithAuthzOptions {
  /**
   * Roles permitidos adicionales para acceder a este handler. No pueden relajar la matriz.
   */
  roles?: Role[];
  /**
   * Scopes OAuth2 requeridos adicionales para acceder a este handler. No pueden relajar la matriz.
   */
  scopes?: string[];
}

/**
 * Tipo de función para los handlers que reciben el evento y el Principal autenticado.
 */
export type AuthorizedHandler<
  TEvent = APIGatewayProxyEventV2WithJWTAuthorizer,
  TResult = APIGatewayProxyResultV2
> = (
  event: TEvent,
  principal: Principal
) => Promise<TResult>;

/**
 * Sobrecarga 1: withAuthz({ roles, scopes }, handler) - Firma original comunicada al Integrante 3.
 */
export function withAuthz<
  TEvent = APIGatewayProxyEventV2WithJWTAuthorizer,
  TResult = APIGatewayProxyResultV2
>(
  options: WithAuthzOptions,
  handler: AuthorizedHandler<TEvent, TResult>
): (event: TEvent) => Promise<UniformResponse | TResult>;

/**
 * Sobrecarga 2: withAuthz(handler) - Opciones opcionales donde las reglas se derivan 100% de ENDPOINT_POLICIES.
 */
export function withAuthz<
  TEvent = APIGatewayProxyEventV2WithJWTAuthorizer,
  TResult = APIGatewayProxyResultV2
>(
  handler: AuthorizedHandler<TEvent, TResult>
): (event: TEvent) => Promise<UniformResponse | TResult>;

/**
 * Implementación del wrapper withAuthz.
 */
export function withAuthz<
  TEvent = APIGatewayProxyEventV2WithJWTAuthorizer,
  TResult = APIGatewayProxyResultV2
>(
  optionsOrHandler: WithAuthzOptions | AuthorizedHandler<TEvent, TResult>,
  maybeHandler?: AuthorizedHandler<TEvent, TResult>
): (event: TEvent) => Promise<UniformResponse | TResult> {
  const isFunction = typeof optionsOrHandler === 'function';
  const handler = isFunction
    ? (optionsOrHandler as AuthorizedHandler<TEvent, TResult>)
    : maybeHandler!;
  const explicitOptions: WithAuthzOptions = isFunction
    ? {}
    : (optionsOrHandler || {});

  return async (event: TEvent): Promise<UniformResponse | TResult> => {
    const startTime = Date.now();
    const requestId = (event as any)?.requestContext?.requestId || 'unknown';
    const stage = (event as any)?.requestContext?.stage || process.env.APP_ENV;

    // Resolver routeKey del evento HTTP API Payload v2
    const routeKey: string =
      (event as any)?.routeKey ||
      (event as any)?.requestContext?.routeKey ||
      ((event as any)?.requestContext?.http?.method &&
      ((event as any)?.rawPath || (event as any)?.requestContext?.http?.path)
        ? `${(event as any).requestContext.http.method} ${(event as any).rawPath || (event as any).requestContext.http.path}`
        : 'UNKNOWN');

    try {
      // 1. Buscar la política en la matriz declarativa (Fail-Closed) considerando el stage
      const policy = findPolicyByRouteKey(routeKey, stage);

      if (!policy) {
        throw new AuthzError(
          403,
          'FORBIDDEN',
          `Acceso denegado: ruta no autorizada por política (${routeKey})`
        );
      }

      // 2. Si la ruta está catalogada como pública, el uso de withAuthz es una configuración errónea
      if (policy.isPublic) {
        throw new AuthzError(
          403,
          'FORBIDDEN',
          `Configuración errónea: la ruta pública ${routeKey} no debe ser envuelta con withAuthz`
        );
      }

      // 3. Restricción de entorno/stage (ej. /simulate exclusivo para 'academic')
      if (policy.stageRestriction) {
        if (stage !== policy.stageRestriction) {
          throw new AuthzError(
            403,
            'FORBIDDEN',
            `Endpoint no disponible en este stage (requiere ${policy.stageRestriction})`
          );
        }
      }

      // 4. Extraer Principal de los claims verificados por el autorizador
      const principal = getPrincipal(event);

      // 5. Validar scopes (los de la matriz son obligatorios; las opciones explícitas agregan requisitos)
      if (policy.requiredScope) {
        requireScope(principal, policy.requiredScope);
      }
      if (explicitOptions.scopes && explicitOptions.scopes.length > 0) {
        for (const scope of explicitOptions.scopes) {
          requireScope(principal, scope);
        }
      }

      // 6. Validar roles RBAC (los de la matriz son obligatorios; las opciones explícitas agregan requisitos)
      if (policy.requiredRole) {
        requireRole(principal, policy.requiredRole);
      }
      if (explicitOptions.roles && explicitOptions.roles.length > 0) {
        requireRole(principal, ...explicitOptions.roles);
      }

      // 7. Delegar en la lógica de negocio pasando el principal verificado
      return await handler(event, principal);
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;

      // Registro seguro de auditoría interna (sanitizado: nunca tokens, claims ni correo)
      if (error instanceof AuthzError) {
        console.warn(
          JSON.stringify({
            level: 'WARN',
            event: 'AUTHZ_REJECTED',
            code: error.code,
            statusCode: error.status,
            requestId,
            route: routeKey,
            durationMs
          })
        );
      } else {
        console.error(
          JSON.stringify({
            level: 'ERROR',
            event: 'UNEXPECTED_HANDLER_ERROR',
            code: 'INTERNAL_SERVER_ERROR',
            requestId,
            route: routeKey,
            durationMs
          })
        );
      }

      return formatErrorResponse(error, requestId);
    }
  };
}
