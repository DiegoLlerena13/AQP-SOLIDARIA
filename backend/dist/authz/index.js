"use strict";
/**
 * @file index.ts
 * @module authz
 * @description Mdulo central de Autorizacin y Control de Acceso Zero Trust para AQP-SOLIDARIA.
 *
 * Implementa la Capa 2 (Policy Engine / PE) para el backend serverless segn NIST SP 800-207 y design.md:
 * - Extraccin de identidad (Principal) nicamente de claims verificados (sub, cognito:groups, scopes).
 * - Parser resiliente de grupos Cognito en API Gateway HTTP API Payload v2.
 * - Control de acceso basado en roles (RBAC): DONANTE, GESTOR, AUDITOR.
 * - Control de acceso basado en propietario (Ownership / ABAC) con respuesta 404 ante BOLA.
 * - Matriz declarativa de endpoints con denegacin por defecto (Fail-closed).
 * - Wrapper de orden superior `withAuthz` para handlers de AWS Lambda.
 *
 * @guide Gua de integracin para el Integrante 3 (Backend):
 * 1. Envolver los handlers con `withAuthz({ roles, scopes }, async (event, principal) => { ... })`
 *    o simplemente `withAuthz(async (event, principal) => { ... })` ya que ENDPOINT_POLICIES
 *    infiere roles y scopes a partir del routeKey.
 * 2. Usar `principal.sub` directamente para asociar el recurso (`donorSub`), NUNCA leerlo del body.
 * 3. En operaciones sobre donaciones individuales (ej. `/simulate` o consultar donacin especfica),
 *    tras consultar DynamoDB llamar inmediatamente a `assertOwner(principal, donationItem)`.
 *    Si el usuario no es el dueo, se responder automticamente con HTTP 404 sin filtrar datos.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./errors.js"), exports);
__exportStar(require("./principal.js"), exports);
__exportStar(require("./rbac.js"), exports);
__exportStar(require("./ownership.js"), exports);
__exportStar(require("./policy.js"), exports);
__exportStar(require("./withAuthz.js"), exports);
