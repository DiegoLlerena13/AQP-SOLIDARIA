# Modelo de Amenazas y Arquitectura Zero Trust (NIST SP 800-207)

**Proyecto:** Plataforma de Donaciones Seguras — Fundación AQP-SOLIDARIA  
**Curso:** Tópicos Avanzados en Ingeniería de Software — EPIS, UNSA  
**Rol responsable:** Integrante 2 — Identidad y Seguridad  
**Fecha:** Noviembre 2026 | **Versión:** 2.0  
**Fuente de verdad:** [requirements.md](../requirements.md) y [design.md](../design.md)

---

## 1. Mapeo de Arquitectura Zero Trust (NIST SP 800-207)

De acuerdo con NIST SP 800-207 y el diseño técnico (§6.1), la arquitectura de AQP-SOLIDARIA desacopla la aplicación de políticas en dos capas complementarias para garantizar defensa en profundidad:

```
[ Cliente SPA ] 
       │  (Bearer Access Token)
       ▼
┌────────────────────────────────────────────────────────┐
│  PEP (Policy Enforcement Point) - Capa 1              │
│  Amazon API Gateway HTTP API                           │
│  - Valida criptográficamente firma y expiración JWT    │
│  - Valida emisor (iss: Cognito User Pool) y client_id  │
│  - Valida scopes OAuth2 por endpoint (AuthorizationScopes)│
│  - Política Fail-Closed: DefaultAuthorizer activo      │
└────────────────────────────────────────────────────────┘
       │  (Petición autorizada con Claims verificados)
       ▼
┌────────────────────────────────────────────────────────┐
│  PDP / PE (Policy Engine) - Capa 2                    │
│  Módulo backend/src/authz/ en AWS Lambda               │
│  - getPrincipal(): Extrae sub, cognito:groups y scopes │
│  - requireScope(): Defensa en profundidad ante tokens  │
│  - requireRole(): RBAC estricto (DONANTE, GESTOR, AUDITOR)│
│  - assertOwner(): Mitigación BOLA (responde 404)       │
│  - Matriz declarativa ENDPOINT_POLICIES (Fail-Closed)  │
└────────────────────────────────────────────────────────┘
       ▲                                 │
       │ Emite / Revoca                  │ Consulta y persiste
┌───────────────┐                 ┌──────────────────────┐
│ PA (Policy    │                 │ Fuentes de Datos     │
│ Administrator)│                 │ - DynamoDB           │
│ Amazon Cognito│                 │ - CloudWatch Logs    │
└───────────────┘                 └──────────────────────┘
```

### Tabla de Componentes NIST SP 800-207

| Componente NIST | Implementación en AQP-SOLIDARIA | Responsabilidad |
|---|---|---|
| **Policy Enforcement Point (PEP)** | **Amazon API Gateway HTTP API** (JWT Authorizer) y **CloudFront** (OAC + Security Headers) | Intercepta cada solicitud en el perímetro de red. Valida firma, emisor (`iss`), expiración (`exp`), `client_id` y scopes requeridos. Deniega el acceso (401/403) antes de invocar cómputo Lambda si el token es inválido o carece del scope necesario. |
| **Policy Engine (PE)** | **Módulo `backend/src/authz/`** embebido en AWS Lambda (extensión futura HU-12: Amazon Verified Permissions + Cedar) | Motor de decisión en Capa 2. Evalúa si el sujeto (`sub`) tiene el rol adecuado en `cognito:groups`, valida que las donaciones pertenezcan al solicitante (`donorSub === sub`) y aplica la matriz declarativa de políticas con denegación por defecto. |
| **Policy Administrator (PA)** | **Amazon Cognito User Pool** (`DonationsUserPool`) | Administrador de políticas de identidad. Emite, renueva y revoca tokens de sesión (Authorization Code + PKCE), gestiona pertenencia a grupos (`DONANTE`, `GESTOR`, `AUDITOR`) y soporta enrolamiento MFA TOTP. |
| **Fuentes de Información (Policy Information Points - PIP)** | **DynamoDB, Claims de Cognito, Contexto de Request, CloudWatch y CloudTrail** | Suministran los atributos del sujeto (claims `sub`, `cognito:groups`), estado del recurso (`status`, `donorSub` en DynamoDB), variables de entorno (`APP_ENV=academic`) y trazas de auditoría. |

---

## 2. Los 7 Principios de NIST SP 800-207 (CA-NF02.3)

| Principio NIST SP 800-207 | Control Técnico en AQP-SOLIDARIA | Evidencia / Verificación |
|---|---|---|
| **1. Todo dato y servicio es un recurso** | Cada ruta del API Gateway cuenta con autorización explícita; `DefaultAuthorizer: CognitoJwtAuthorizer` en `template.yaml` impone fail-closed. Tablas DynamoDB protegidas por IAM mínimo por función. | Pruebas unitarias de `policy.test.ts` (rutas no listadas denegadas por defecto) y configuración en `infra/template.yaml`. |
| **2. Comunicación segura sin importar la red** | Cero confianza en la red cliente. Todo tráfico hacia la API requiere HTTPS/TLS 1.2+ en API Gateway y CloudFront. Sin puertos HTTP planos. | Contrato de infraestructura en `infra/template.yaml` (HTTP API) y requisito CA-NF01.1. *(Validación en AWS en vivo pendiente de despliegue)*. |
| **3. Acceso por sesión y por recurso** | Tokens de acceso de vida corta (15 minutos). Scopes OAuth2 específicos por ruta. Verificación de propiedad (ownership) por cada recurso individual consultado. | Pruebas `ownership.test.ts` (T09, CA-07.2), `withAuthz.test.ts` y parámetros de validez en `template.yaml`. |
| **4. Política dinámica** | La autorización no depende solo del token: evalúa rol dinámico (`cognito:groups`), propietario en base de datos (`donorSub`), clave de idempotencia y stage de despliegue (`academic`). | Pruebas `policy.test.ts` (restricción a stage `academic`) y `ownership.test.ts`. |
| **5. Monitorear la postura de los activos** | **Parcial / Limitación declarada:** El nivel AWS Free plan no incluye AWS Verified Access ni CrowdStrike/posture agents. Se mitiga mediante GitHub Actions CI (análisis estático, lint, tests) y CloudTrail para auditoría de infraestructura. | Sección de limitaciones documentada y pipeline `.github/workflows/ci.yml`. |
| **6. Autenticación y autorización estrictas antes del acceso** | Verificación en dos capas: API Gateway (PEP) valida JWT y scopes; Lambda (PE / `withAuthz`) valida roles y ownership. Exigencia de MFA TOTP para roles con privilegios (GESTOR y AUDITOR). | Pruebas `principal.test.ts` (CA-03.2), `rbac.test.ts` (T03, T12) y checklist en `evidence/security/README.md` (T14). |
| **7. Recolectar información para mejorar** | Logs estructurados JSON con `requestId`, código de error y acción. Se prohíbe registrar tokens, contraseñas o claims completos. Retención de 14 días. Tabla `AuditEventsTable`. | Pruebas `withAuthz.test.ts` (verificación de sanitización) y recurso `HealthLogGroup` en `infra/template.yaml`. |

---

## 3. Análisis STRIDE Resumido (design.md §6.2)

| Categoría STRIDE | Amenaza Concreta | Controles Implementados en el Código | Verificación / Test |
|---|---|---|---|
| **Spoofing (Suplantación)** | Inyección de identidad o roles falsificados vía body JSON (`{ donorSub: "hacker", role: "GESTOR" }`) o headers falsos. | `principal.ts`: Lee `sub` y grupos únicamente de `event.requestContext.authorizer.jwt.claims`. Se ignora completamente el body y headers del cliente para identidad. | `principal.test.ts` (`[CA-04.3][CA-05.3]`) y `withAuthz.test.ts`. |
| **Tampering (Manipulación)** | Modificación de tokens JWT, alteración de montos o estados de donación en tránsito. | Firma criptográfica validada por API Gateway (Capa 1). En backend, el módulo `authz` rechaza tokens sin `sub` (401). Montos en centavos enteros validados con tipos estrictos. | `principal.test.ts` (CA-03.2) y procedimiento T11 en `evidence/security/`. |
| **Repudiation (Repudio)** | Un gestor o donante niega haber realizado una donación o publicado un proyecto. | Correlación obligatoria con `requestId` en cada respuesta y log. Modelo de datos con `AuditEvent` inmutable (`eventType`, `eventKey`, `timestamp`, `actorRef`). | Formato uniforme `{ code, message, requestId }` en `errors.ts` y tabla `AuditEventsTable`. |
| **Information Disclosure (Fuga de información)** | BOLA (Broken Object Level Authorization): un donante consulta ID de donación ajena para extraer montos o datos de otros. Fuga de stacks o claims en respuestas de error. | `ownership.ts`: `assertOwner()` responde HTTP 404 (NOT_FOUND) y nunca 403 ante donaciones ajenas, previniendo enumeración. `formatErrorResponse()` oculta stacks y claims. | `ownership.test.ts` (`[T09][CA-07.2]`), `withAuthz.test.ts` (Sanitización). |
| **Denial of Service (Denegación de servicio)** | Sobrecarga de peticiones repetidas o transacciones concurrentes para generar inconsistencias. | Throttling a nivel de stage en API Gateway HTTP API. En backend, idempotencia atómica y validación Fail-Closed rápida en memoria antes de invocar DynamoDB. | `policy.test.ts` (Fail-closed en memoria) y `infra/template.yaml`. |
| **Elevation of Privilege (Elevación de privilegios)** | Donante con scope de cliente web intenta invocar endpoints administrativos de GESTOR (T03) o AUDITOR. | `rbac.ts`: `requireRole()` verifica obligatoriamente la presencia del grupo en `cognito:groups`. No basta con que el cliente OAuth2 posea el scope; el usuario debe pertenecer al grupo. | `rbac.test.ts` (`[T03][CA-04.1]`, `[T12][CA-04.2]`). |

---

## 4. Limitaciones Conocidas del Modelo de Seguridad

1. **Validación local del JWT Authorizer y Revocación de Tokens (CA-03.4, T13):**  
   El authorizer HTTP API de API Gateway valida los tokens JWT de manera asíncrona y local (verificando firma criptográfica contra el JWKS de Cognito y fecha `exp`). Por diseño de AWS, el authorizer **no** consulta el endpoint de revocación de Cognito en cada solicitud.  
   *Consecuencia:* Si un usuario revoca su refresh token o cierra sesión, el access token previamente emitido continuará siendo aceptado por API Gateway hasta que expire.  
   *Mitigación:* Se fijó la vigencia del access token en el mínimo práctico de **15 minutos** (`AccessTokenValidity: 15`), reduciendo la ventana de exposición a 900 segundos.

2. **Decisión de MFA en Cognito User Pool (CA-11.1, CA-11.2, T14):**  
   En la plantilla SAM, el User Pool define `MfaConfiguration: OPTIONAL`. Esto se debe a que Cognito no permite fijar MFA como obligatorio por grupo (solo a nivel global de pool). Como los `DONANTE` tienen MFA opcional para facilitar la experiencia de usuario, el pool no puede configurarse en `ON`.  
   *Consecuencia y Riesgo:* Un usuario asignado a `GESTOR` o `AUDITOR` que no haya completado el enrolamiento TOTP podría potencialmente iniciar sesión con solo usuario y contraseña.  
   *Mitigación declarada:* Procedimiento de aprovisionamiento administrativo obligatorio: las cuentas con privilegios (`GESTOR`, `AUDITOR`) deben crearse con TOTP pre-enrolado y preferido antes de entregar credenciales, y no se entregan tokens sin completar el desafío `SOFTWARE_TOKEN_MFA`.  
   *Aclaración técnica:* El access token estándar de Cognito no contiene un claim `amr` o `mfa_authenticated`; la exigencia de MFA se verifica en el flujo de autenticación del Identity Provider.

3. **Sin evaluación continua de riesgo ni postura de dispositivo (NIST Principio 5):**  
   AWS Verified Access, Cognito Threat Protection (Cognito Plus) y AWS WAF con Managed Rules para HTTP API requieren suscripciones y costos que no están cubiertos por el nivel gratuito (Free Plan) de AWS.

---

## 5. Matriz de Trazabilidad (Requerimientos -> Implementación -> Tests)

| ID Requerimiento / Test | Descripción | Archivo de Implementación | Archivo de Prueba | Estado |
|---|---|---|---|---|
| **CA-03.1** | Login seguro Authorization Code + PKCE obligatorio | `infra/template.yaml` (`AllowedOAuthFlows: [code]`) | `evidence/security/README.md` (Checklist PKCE) | Especificado en IaC (Ejecución en vivo pendiente) |
| **CA-03.2** / **T02** | Token ausente, alterado o sin claims devuelve 401 | `backend/src/authz/principal.ts` (`getPrincipal`) | `backend/test/authz/principal.test.ts` | **Aprobado (Local)** |
| **CA-03.3** | Access token con vigencia ≤ 15 min y revocación activa | `infra/template.yaml` (`AccessTokenValidity: 15`, `EnableTokenRevocation: true`) | `evidence/security/README.md` (Checklist T13) | Configurado en IaC |
| **CA-03.4** / **T13** | Demostración de limitación: token revocado aceptado hasta expirar | `docs/threat-model.md` §4, `evidence/security/README.md` | `evidence/security/README.md` (Procedimiento T13) | Documentado (Pendiente ejecución en AWS) |
| **CA-04.1** / **T03** | Donante intenta crear/modificar proyectos -> 403 | `backend/src/authz/rbac.ts` (`requireRole('GESTOR')`) | `backend/test/authz/rbac.test.ts` (`[T03][CA-04.1]`) | **Aprobado (Local)** |
| **CA-04.2** / **T12** | Gestor intenta consultar historial de donante -> 403/404 | `backend/src/authz/rbac.ts` (`requireRole('DONANTE')`) | `backend/test/authz/rbac.test.ts` (`[T12][CA-04.2]`) | **Aprobado (Local)** |
| **CA-04.3** / **CA-05.3** | Identidad (`sub`, `groups`) exclusivamente de claims verificados | `backend/src/authz/principal.ts` (`getPrincipal`) | `backend/test/authz/principal.test.ts` (`[CA-04.3][CA-05.3]`) | **Aprobado (Local)** |
| **CA-06.1** | Endpoint de simulación exclusivo del stage `academic` | `backend/src/authz/policy.ts` (`stageRestriction: 'academic'`) | `backend/test/authz/policy.test.ts` | **Aprobado (Local)** |
| **CA-07.2** / **T09** | Mitigación BOLA: acceso a donación ajena responde 404 | `backend/src/authz/ownership.ts` (`assertOwner`) | `backend/test/authz/ownership.test.ts` (`[T09][CA-07.2]`) | **Aprobado (Local)** |
| **CA-11.1** / **CA-11.2** / **T14** | MFA TOTP obligatorio para roles GESTOR y AUDITOR | `infra/template.yaml`, `evidence/security/README.md` | `evidence/security/README.md` (Procedimiento T14) | Documentado (Pendiente ejecución en AWS) |
| **CA-NF01.2** / **CA-NF07.1** | Logs y respuestas sanitizadas sin secretos, stack ni tokens | `backend/src/authz/errors.ts`, `backend/src/authz/withAuthz.ts` | `backend/test/authz/withAuthz.test.ts` | **Aprobado (Local)** |
| **CA-NF02.1** / **T11** | ID token o token alterado rechazado | `infra/template.yaml` (Scopes por ruta), `docs/threat-model.md` | `evidence/security/README.md` (Hipótesis T11) | Documentado (Pendiente comprobación en AWS) |
| **CA-NF02.2** | Validación en Lambda de rol y reglas de negocio | `backend/src/authz/withAuthz.ts`, `backend/src/authz/policy.ts` | `backend/test/authz/withAuthz.test.ts`, `policy.test.ts` | **Aprobado (Local)** |
| **CA-NF02.3** | Mapeo NIST SP 800-207 y componentes PE/PA/PEP | `docs/threat-model.md` §1 y §2 | `docs/threat-model.md` | **Completado** |

> **Nota de integridad académica:** Las pruebas marcadas como *Aprobado (Local)* han sido validadas mediante la suite unitaria automatizada (Vitest). Las pruebas marcadas como *Pendiente de ejecución* corresponden a validaciones de interacción en vivo con los servicios gestionados de AWS (Cognito, API Gateway), documentadas paso a paso en `evidence/security/README.md`.
