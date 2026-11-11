"use strict";
/**
 * @file policy.ts
 * @description Matriz declarativa de políticas de autorización (design.md §4).
 * Define los endpoints permitidos, sus scopes y roles requeridos.
 * Aplica el principio de denegación por defecto (Fail-closed):
 * cualquier ruta o método no explícitamente listado en esta matriz es denegado (HTTP 403).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENDPOINT_POLICIES = void 0;
exports.matchesPath = matchesPath;
exports.normalizePath = normalizePath;
exports.findPolicy = findPolicy;
exports.findPolicyByRouteKey = findPolicyByRouteKey;
exports.assertRoutePolicy = assertRoutePolicy;
const errors_js_1 = require("./errors.js");
const rbac_js_1 = require("./rbac.js");
/**
 * Matriz única y autoritativa de endpoints del backend AQP-SOLIDARIA (design.md §4).
 */
exports.ENDPOINT_POLICIES = [
    {
        method: 'GET',
        pathPattern: '/v1/projects',
        isPublic: true,
        description: 'Catálogo público de proyectos confirmados y publicados'
    },
    {
        method: 'GET',
        pathPattern: '/v1/projects/{projectId}',
        isPublic: true,
        description: 'Detalle de proyecto público publicado'
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
        description: 'Creación de nuevo proyecto en estado BORRADOR'
    },
    {
        method: 'PATCH',
        pathPattern: '/v1/projects/{projectId}/publish',
        requiredRole: 'GESTOR',
        requiredScope: 'api/projects.write',
        description: 'Publicación de un proyecto en borrador'
    },
    {
        method: 'POST',
        pathPattern: '/v1/donations',
        requiredRole: 'DONANTE',
        requiredScope: 'api/donations.write',
        description: 'Creación de intención de donación simulada'
    },
    {
        method: 'POST',
        pathPattern: '/v1/donations/{donationId}/simulate',
        requiredRole: 'DONANTE',
        requiredScope: 'api/donations.write',
        requiresOwnership: true,
        stageRestriction: 'academic',
        description: 'Confirmación o rechazo de donación propia (exclusivo stage academic)'
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
        description: 'Consulta de eventos críticos de auditoría (extensión HU-10)'
    }
];
/**
 * Comprueba si una ruta concreta coincide con un patrón parametrizado (ej. /v1/projects/{projectId}).
 */
function matchesPath(pattern, path) {
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
 * Normaliza una ruta removiendo el prefijo de stage de API Gateway (ej. /academic/v1/projects -> /v1/projects).
 */
function normalizePath(path, stage) {
    let clean = (path || '').trim();
    if (stage && stage !== '$default') {
        const stagePrefix = `/${stage.replace(/^\/+|\/+$/g, '')}`;
        if (clean === stagePrefix) {
            clean = '/';
        }
        else if (clean.startsWith(`${stagePrefix}/`)) {
            clean = clean.slice(stagePrefix.length);
        }
    }
    else if (clean.startsWith('/academic/')) {
        clean = clean.slice('/academic'.length);
    }
    return clean;
}
/**
 * Busca la política correspondiente a un método y ruta dados, con soporte de normalización de stage.
 */
function findPolicy(method, path, stage) {
    const upperMethod = method.toUpperCase();
    const normalizedPath = normalizePath(path, stage);
    const matched = exports.ENDPOINT_POLICIES.find(policy => policy.method === upperMethod && matchesPath(policy.pathPattern, normalizedPath));
    if (matched) {
        return matched;
    }
    // Tolerancia para discrepancia conocida de template.yaml (PublishProject usa POST en lugar de PATCH)
    if (upperMethod === 'POST' && matchesPath('/v1/projects/{projectId}/publish', normalizedPath)) {
        return exports.ENDPOINT_POLICIES.find(p => p.method === 'PATCH' && p.pathPattern === '/v1/projects/{projectId}/publish');
    }
    return undefined;
}
/**
 * Busca una política a partir del routeKey de API Gateway HTTP API v2
 * (ej. "POST /v1/donations", "POST /v1/donations/{donationId}/simulate" o "POST /v1/donations/d-123/simulate").
 */
function findPolicyByRouteKey(routeKey, stage) {
    if (!routeKey || typeof routeKey !== 'string') {
        return undefined;
    }
    const parts = routeKey.trim().split(/\s+/);
    if (parts.length < 2) {
        return undefined;
    }
    const method = parts[0];
    const path = parts.slice(1).join(' ');
    return findPolicy(method, path, stage);
}
/**
 * Evalúa la política para una solicitud.
 * Si la ruta no está registrada en la matriz, lanza AuthzError 403 (Deny by default).
 * Valida scope, rol y restricciones de entorno (stage academic).
 *
 * @param method Método HTTP
 * @param path Ruta solicitada
 * @param principal Identidad verificada (requerida para rutas protegidas)
 * @param currentStage Entorno de ejecución (opcional, ej. 'academic')
 * @returns La política validada que autorizó la solicitud
 */
function assertRoutePolicy(method, path, principal, currentStage) {
    const policy = findPolicy(method, path, currentStage);
    if (!policy) {
        throw new errors_js_1.AuthzError(403, 'FORBIDDEN', `Acceso denegado: ruta no permitida por política (${method} ${path})`);
    }
    // Rutas públicas no requieren autenticación
    if (policy.isPublic) {
        return policy;
    }
    // Rutas protegidas requieren Principal válido
    if (!principal) {
        throw new errors_js_1.AuthzError(401, 'UNAUTHORIZED', 'Autenticación requerida para este endpoint');
    }
    // Validación de restricción de stage (ej. solo stage academic para /simulate)
    if (policy.stageRestriction) {
        const stage = currentStage || process.env.APP_ENV || process.env.STAGE;
        if (stage !== policy.stageRestriction) {
            throw new errors_js_1.AuthzError(403, 'FORBIDDEN', `Endpoint no disponible en este stage (requiere ${policy.stageRestriction})`);
        }
    }
    // Validación de scope OAuth2
    if (policy.requiredScope) {
        (0, rbac_js_1.requireScope)(principal, policy.requiredScope);
    }
    // Validación de Rol RBAC
    if (policy.requiredRole) {
        (0, rbac_js_1.requireRole)(principal, policy.requiredRole);
    }
    return policy;
}
