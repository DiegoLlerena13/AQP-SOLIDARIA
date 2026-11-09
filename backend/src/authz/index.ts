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
 * 1. Envolver los handlers con `withAuthz({ roles, scopes }, async (event, principal) => { ... })`.
 * 2. Usar `principal.sub` directamente para asociar el recurso (`donorSub`), NUNCA leerlo del body.
 * 3. En operaciones sobre donaciones individuales (ej. `/simulate` o consultar donacin especfica),
 *    tras consultar DynamoDB llamar inmediatamente a `assertOwner(principal, donationItem)`.
 *    Si el usuario no es el dueo, se responder automticamente con HTTP 404 sin filtrar datos.
 */

export * from './errors.js';
export * from './principal.js';
export * from './rbac.js';
export * from './ownership.js';
export * from './policy.js';
export * from './withAuthz.js';
