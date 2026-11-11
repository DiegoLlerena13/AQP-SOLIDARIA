"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.withAuthz = withAuthz;
const errors_js_1 = require("./errors.js");
const policy_js_1 = require("./policy.js");
const principal_js_1 = require("./principal.js");
const rbac_js_1 = require("./rbac.js");
/**
 * Implementación del wrapper withAuthz.
 */
function withAuthz(optionsOrHandler, maybeHandler) {
    const isFunction = typeof optionsOrHandler === 'function';
    const handler = isFunction
        ? optionsOrHandler
        : maybeHandler;
    const explicitOptions = isFunction
        ? {}
        : (optionsOrHandler || {});
    return async (event) => {
        const startTime = Date.now();
        const requestId = event?.requestContext?.requestId || 'unknown';
        const stage = event?.requestContext?.stage || process.env.APP_ENV;
        // Resolver routeKey del evento HTTP API Payload v2
        const routeKey = event?.routeKey ||
            event?.requestContext?.routeKey ||
            (event?.requestContext?.http?.method &&
                (event?.rawPath || event?.requestContext?.http?.path)
                ? `${event.requestContext.http.method} ${event.rawPath || event.requestContext.http.path}`
                : 'UNKNOWN');
        try {
            // 1. Buscar la política en la matriz declarativa (Fail-Closed) considerando el stage
            const policy = (0, policy_js_1.findPolicyByRouteKey)(routeKey, stage);
            if (!policy) {
                throw new errors_js_1.AuthzError(403, 'FORBIDDEN', `Acceso denegado: ruta no autorizada por política (${routeKey})`);
            }
            // 2. Si la ruta está catalogada como pública, el uso de withAuthz es una configuración errónea
            if (policy.isPublic) {
                throw new errors_js_1.AuthzError(403, 'FORBIDDEN', `Configuración errónea: la ruta pública ${routeKey} no debe ser envuelta con withAuthz`);
            }
            // 3. Restricción de entorno/stage (ej. /simulate exclusivo para 'academic')
            if (policy.stageRestriction) {
                if (stage !== policy.stageRestriction) {
                    throw new errors_js_1.AuthzError(403, 'FORBIDDEN', `Endpoint no disponible en este stage (requiere ${policy.stageRestriction})`);
                }
            }
            // 4. Extraer Principal de los claims verificados por el autorizador
            const principal = (0, principal_js_1.getPrincipal)(event);
            // 5. Validar scopes (los de la matriz son obligatorios; las opciones explícitas agregan requisitos)
            if (policy.requiredScope) {
                (0, rbac_js_1.requireScope)(principal, policy.requiredScope);
            }
            if (explicitOptions.scopes && explicitOptions.scopes.length > 0) {
                for (const scope of explicitOptions.scopes) {
                    (0, rbac_js_1.requireScope)(principal, scope);
                }
            }
            // 6. Validar roles RBAC (los de la matriz son obligatorios; las opciones explícitas agregan requisitos)
            if (policy.requiredRole) {
                (0, rbac_js_1.requireRole)(principal, policy.requiredRole);
            }
            if (explicitOptions.roles && explicitOptions.roles.length > 0) {
                (0, rbac_js_1.requireRole)(principal, ...explicitOptions.roles);
            }
            // 7. Delegar en la lógica de negocio pasando el principal verificado
            return await handler(event, principal);
        }
        catch (error) {
            const durationMs = Date.now() - startTime;
            // Registro seguro de auditoría interna (sanitizado: nunca tokens, claims ni correo)
            if (error instanceof errors_js_1.AuthzError) {
                console.warn(JSON.stringify({
                    level: 'WARN',
                    event: 'AUTHZ_REJECTED',
                    code: error.code,
                    statusCode: error.status,
                    requestId,
                    route: routeKey,
                    durationMs
                }));
            }
            else {
                console.error(JSON.stringify({
                    level: 'ERROR',
                    event: 'UNEXPECTED_HANDLER_ERROR',
                    code: 'INTERNAL_SERVER_ERROR',
                    requestId,
                    route: routeKey,
                    durationMs
                }));
            }
            return (0, errors_js_1.formatErrorResponse)(error, requestId);
        }
    };
}
