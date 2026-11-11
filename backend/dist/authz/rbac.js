"use strict";
/**
 * @file rbac.ts
 * @description Control de acceso basado en roles (RBAC) y scopes OAuth2 (Capa 2 / Policy Engine).
 * Aplica el principio Zero Trust de defensa en profundidad: aunque API Gateway valide
 * scopes en la Capa 1, Lambda comprueba de forma explcita tanto roles como scopes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasRole = hasRole;
exports.requireRole = requireRole;
exports.hasScope = hasScope;
exports.requireScope = requireScope;
const errors_js_1 = require("./errors.js");
/**
 * Comprueba si el Principal posee al menos uno de los roles solicitados.
 */
function hasRole(principal, ...roles) {
    if (!principal || !Array.isArray(principal.groups)) {
        return false;
    }
    return roles.some(role => principal.groups.includes(role));
}
/**
 * Exige que el Principal tenga al menos uno de los roles requeridos.
 * Lanza AuthzError(403) si no cuenta con el rol (T03, T12, CA-04.1, CA-04.2).
 */
function requireRole(principal, ...roles) {
    if (!hasRole(principal, ...roles)) {
        throw new errors_js_1.AuthzError(403, 'FORBIDDEN', `Acceso denegado: se requiere uno de los siguientes roles: ${roles.join(', ')}`);
    }
}
/**
 * Comprueba si el Principal posee el scope requerido.
 */
function hasScope(principal, requiredScope) {
    if (!principal || !Array.isArray(principal.scopes)) {
        return false;
    }
    return principal.scopes.includes(requiredScope);
}
/**
 * Exige que el Principal posea el scope requerido.
 * Lanza AuthzError(403) si el scope est ausente.
 */
function requireScope(principal, requiredScope) {
    if (!hasScope(principal, requiredScope)) {
        throw new errors_js_1.AuthzError(403, 'FORBIDDEN', `Acceso denegado: scope requerido ${requiredScope}`);
    }
}
