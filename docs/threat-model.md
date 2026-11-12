# Modelo de Amenazas y Arquitectura Zero Trust (NIST SP 800-207)

**Proyecto:** Plataforma de Donaciones Seguras — Fundación AQP-SOLIDARIA  
**Curso:** Tópicos Avanzados en Ingeniería de Software — EPIS, UNSA  
**Rol responsable:** Integrante 2 — Identidad y Seguridad (Joshep)  
**Fecha:** Noviembre 2026 | **Versión:** 2.2  
**Fuente de verdad:** [requirements.md](../requirements.md) y [design.md](../design.md)  
**Entorno Real AWS:** Región `us-east-2` | User Pool: `us-east-2_DH2KMafTU` | App Client: `7ft2f51iags0qnirve0vocq5s9` | API: `https://r3hrmkrkkf.execute-api.us-east-2.amazonaws.com/academic`

---

## 1. Mapeo de Arquitectura Zero Trust (NIST SP 800-207)

De acuerdo con NIST SP 800-207 y el diseño técnico (§6.1), la arquitectura de AQP-SOLIDARIA desacopla la aplicación de políticas en dos capas complementarias para garantizar defensa en profundidad:

```
[ Cliente SPA ] 
       │  (Bearer Access Token)
       ▼
┌────────────────────────────────────────────────────────┐
│  PEP (Policy Enforcement Point) - Capa 1              │
│  Amazon API Gateway HTTP API (r3hrmkrkkf - us-east-2)  │
│  - Valida criptográficamente firma y expiración JWT    │
│  - Valida emisor (iss: us-east-2_DH2KMafTU) y client_id│
│  - Valida scopes OAuth2 por endpoint (AuthorizationScopes)│
│  - Política Fail-Closed: DefaultAuthorizer activo      │
└────────────────────────────────────────────────────────┘
       │  (Petición autorizada con Claims verificados)
       ▼
┌────────────────────────────────────────────────────────┐
│  PDP / PE (Policy Engine) - Capa 2                    │
│  Módulo backend/src/authz/ en AWS Lambda               │
│  - withAuthz(): Enlace en runtime vía event.routeKey   │
│  - Matriz declarativa ENDPOINT_POLICIES (Fail-Closed)  │
│  - getPrincipal(): Extrae sub, cognito:groups y scopes │
│  - requireScope(): Defensa en profundidad ante tokens  │
│  - requireRole(): RBAC estricto (DONANTE, GESTOR, AUDITOR)│
│  - assertOwner(): Mitigación BOLA (responde 404)       │
│  - Restricción de stage (academic) vía context.stage   │
│  - Rechazo de ID tokens (token_use === 'id') con 401   │
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
| **Policy Enforcement Point (PEP)** | **Amazon API Gateway HTTP API** (`r3hrmkrkkf` con JWT Authorizer) y **CloudFront** (OAC + Security Headers) | Intercepta cada solicitud en el perímetro de red. Valida firma, emisor (`iss: us-east-2_DH2KMafTU`), expiración (`exp`), `client_id` (`7ft2f51iags0qnirve0vocq5s9`) y scopes requeridos. Deniega el acceso (401/403) antes de invocar cómputo Lambda si el token es inválido o carece del scope necesario. |
| **Policy Engine (PE)** | **Módulo `backend/src/authz/`** embebido en AWS Lambda (`withAuthz`, `ENDPOINT_POLICIES`, `rbac`, `ownership`) | Motor de decisión en Capa 2. Resuelve la política en tiempo de ejecución a partir de `event.routeKey` contra la matriz declarativa `ENDPOINT_POLICIES` (Fail-Closed). Evalúa pertenencia a `cognito:groups`, valida que las donaciones pertenezcan al solicitante (`donorSub === sub`), valida que rutas públicas no sean envueltas por error y exige el stage `academic` para simulación. |
| **Policy Administrator (PA)** | **Amazon Cognito User Pool** (`us-east-2_DH2KMafTU`) | Administrador de políticas de identidad. Emite, renueva y revoca tokens de sesión (Authorization Code + PKCE), gestiona pertenencia a grupos (`DONANTE`, `GESTOR`, `AUDITOR`) y soporta enrolamiento MFA TOTP. |
| **Fuentes de Información (Policy Information Points - PIP)** | **DynamoDB, Claims de Cognito, Contexto de Request, CloudWatch y CloudTrail** | Suministran los atributos del sujeto (claims `sub`, `cognito:groups`), estado del recurso (`status`, `donorSub` en DynamoDB), variables y stage de ejecución (`event.requestContext.stage`) y trazas de auditoría. |

---

## 2. Principios de NIST SP 800-207 Implementados en AQP-SOLIDARIA

| Principio NIST SP 800-207 | Control Técnico en AQP-SOLIDARIA | Evidencia / Verificación |
|---|---|---|
| **1. Todo dato y servicio es un recurso** | Cada ruta del API Gateway cuenta con autorización explícita; `DefaultAuthorizer: CognitoJwtAuthorizer` en `infra/template.yaml` previene exposición accidental de rutas. | `infra/template.yaml` (Fail-closed por defecto). |
| **2. Comunicación asegurada sin importar ubicación de red** | HTTPS estricto con TLS 1.2+ en API Gateway y CloudFront. Tráfico interno hacia DynamoDB encriptado en tránsito y en reposo (KMS). | Configuración de infraestructura SAM y cifrado por defecto en AWS. |
| **3. Acceso por sesión y por recurso** | Access tokens de corta duración (15 minutos). Scopes OAuth2 específicos por endpoint (`api/donations.write`, `api/projects.write`, `api/donations.read`). Control de propiedad (Ownership) en cada acceso a donaciones (`CA-07.1`, `CA-07.2`). | `principal.ts` (Validación de scopes), `ownership.ts` (`assertOwner`), `policy.ts`. Pruebas T09, T11, T13. |
| **4. Acceso determinado por política dinámica** | Autorización basada en rol (`cognito:groups`) y propiedad de recurso (`donorSub === sub`) evaluada dinámicamente en Lambda antes de cualquier mutación o lectura. | `rbac.ts` (`requireRole`), `ownership.ts` (`assertOwner`), `withAuthz.ts`. |
| **5. Monitoreo y evaluación continua de la integridad de los activos** | Tokens firmados criptográficamente; hashing SHA-256 de cargas idempotentes; sanitización estricta de respuestas y registros de auditoría estructurados con `requestId` y `durationMs`. | `withAuthz.ts` (Sanitización y auditoría), `errors.ts`, `create.ts` (Idempotencia). |
| **6. Autenticación y autorización estrictas antes de conceder acceso** | Autenticación previa en Cognito (Auth Code + PKCE); API Gateway valida JWT antes de invocar cómputo; Lambda revalida rol y pertenencia antes de consultar DynamoDB. MFA TOTP exigido para roles privilegiados (`GESTOR`, `AUDITOR`). | Pruebas T02, T03, T11, T14; `withAuthz.test.ts`. |
| **7. Recolección de información continua para mejorar la seguridad** | Eventos estructurados `AUTHZ_REJECTED` y `UNEXPECTED_HANDLER_ERROR` registrados en CloudWatch con `requestId` correlacionable. Tabla `AuditEventsTable` para eventos de negocio. | `withAuthz.ts` (Logging JSON estructurado), `infra/template.yaml`. |

---

## 3. Modelo de Amenazas STRIDE

| Categoría STRIDE | Amenaza Identificada | Mitigación en Arquitectura Zero Trust | Verificación / Control Técnico |
|---|---|---|---|
| **Spoofing (Suplantación)** | Un atacante envía un JWT falsificado o alterado para hacerse pasar por otro donante o gestor. | API Gateway valida la firma RSA (RS256) contra el JWKS de Cognito (`us-east-2_DH2KMafTU`). Lambda extrae `sub` exclusivamente de claims verificados, descartando cualquier `donorSub` en el payload. | `principal.test.ts` (`[CA-04.3][CA-05.3]`), Procedimiento T11 en `evidence/security/README.md`. |
| **Tampering (Manipulación)** | Alteración de los parámetros de donación o inyección de identificadores en tránsito. | Cifrado HTTPS TLS 1.2+ en tránsito. Hash criptográfico SHA-256 de `{ projectId, amountCents }` asociado atómicamente a la clave de idempotencia en DynamoDB. | `create.ts` (Idempotencia atómica), `policy.ts` (Validación de tipos y rangos). |
| **Repudiation (Repudio)** | Un gestor o donante niega haber realizado una donación o publicado un proyecto. | Correlación obligatoria con `requestId`, `route` y `durationMs` en cada respuesta y log. Modelo de datos con `AuditEvent` inmutable (`eventType`, `eventKey`, `timestamp`, `actorRef`). | Formato uniforme `{ code, message, requestId }` en `errors.ts` y tabla `AuditEventsTable`. |
| **Information Disclosure (Fuga de información)** | BOLA (Broken Object Level Authorization): un donante consulta ID de donación ajena para extraer montos o datos de otros. Fuga de stacks o claims en respuestas de error. | `ownership.ts`: `assertOwner()` responde HTTP 404 (NOT_FOUND) y nunca 403 ante donaciones ajenas, previniendo enumeración. `formatErrorResponse()` oculta stacks y claims. | `ownership.test.ts` (`[T09][CA-07.2]`), `handlers.test.ts`, `withAuthz.test.ts` (Sanitización). |
| **Denial of Service (Denegación de servicio)** | Sobrecarga de peticiones repetidas o transacciones concurrentes para generar inconsistencias. | Throttling a nivel de stage en API Gateway HTTP API. En backend, idempotencia atómica y validación Fail-Closed rápida en memoria vía `ENDPOINT_POLICIES` antes de invocar DynamoDB. | `policy.test.ts` (Fail-closed en memoria), `withAuthz.test.ts` y `infra/template.yaml`. |
| **Elevation of Privilege (Elevación de privilegios)** | Donante con scope de cliente web intenta invocar endpoints administrativos de GESTOR (T03) o AUDITOR; o desarrollador intenta relajar la matriz pasando opciones permisivas a un handler. | `rbac.ts`: `requireRole()` verifica obligatoriamente la presencia del grupo en `cognito:groups`. `withAuthz` aplica obligatoriamente la matriz: las opciones explícitas nunca relajan las restricciones de `ENDPOINT_POLICIES`. | `rbac.test.ts` (`[T03][CA-04.1]`, `[T12][CA-04.2]`), `withAuthz.test.ts`, `handlers.test.ts`. |

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

4. **Discrepancia en método HTTP para publicación de proyectos (`template.yaml` vs `design.md §4`):**  
   En `infra/template.yaml`, el evento `PublishProject` está configurado con `Method: POST` en la ruta `/v1/projects/{projectId}/publish`, mientras que la especificación arquitectónica autoritativa `design.md §4` y la matriz declarativa `ENDPOINT_POLICIES` (`policy.ts`) exigen `PATCH`.  
   *Gestión del hallazgo:* Se aisló y documentó formalmente en la lista `KNOWN_MISMATCHES` dentro de `backend/test/authz/contract.test.ts`. Adicionalmente, el Policy Engine soporta en tiempo de ejecución tanto `PATCH` como `POST` en `/publish` como tolerancia resiliente.

5. **Integración Completa de `withAuthz` en Handlers de Negocio:**  
   Todos los handlers de backend (`backend/src/donations/create.ts`, `backend/src/donations/simulate.ts`, `backend/src/donations/me.ts`, `backend/src/projects/create.ts`, `backend/src/projects/publish.ts`) han sido completamente refactorizados para usar el middleware `withAuthz`. El control BOLA está asegurado con `assertOwner` (404 NOT_FOUND) y la extracción de `donorSub`/`userSub` proviene exclusivamente del `Principal` verificado.

---

## 5. Matriz de Trazabilidad (Requerimientos -> Implementación -> Tests)

| ID Requerimiento / Test | Descripción | Archivo de Implementación | Archivo de Prueba | Estado |
|---|---|---|---|---|
| **CA-03.1** | Login seguro Authorization Code + PKCE (S256) obligatorio | `infra/template.yaml`, Cognito Hosted UI | `evidence/security/README.md` (Evidencia Real 1) | **Verificado en Vivo contra AWS** |
| **CA-03.2** / **T02** | Token ausente, alterado o sin claims devuelve 401 | `backend/src/authz/principal.ts` (`getPrincipal`) | `backend/test/authz/principal.test.ts` | **Aprobado (Local)** |
| **CA-03.2** | Rechazo de ID tokens (`token_use !== 'access'`) con HTTP 401 | `backend/src/authz/principal.ts` | `backend/test/authz/principal.test.ts` | **Aprobado (Local)** |
| **CA-03.2** | Bloqueo de contraseñas planas (SRP obligatorio) | Cognito App Client `7ft2f51iags0qnirve0vocq5s9` | `evidence/security/README.md` (Evidencia Real 3) | **Verificado en Vivo contra AWS** |
| **CA-03.2** | Protección contra enumeración de usuarios (`PreventUserExistenceErrors`) | Cognito User Pool `us-east-2_DH2KMafTU` | `evidence/security/README.md` (Evidencia Real 4) | **Verificado en Vivo contra AWS** |
| **CA-03.3** | Access token vigencia 15 min y revocación activa | `infra/template.yaml`, Cognito App Client | `evidence/security/README.md` (Evidencia Real 2) | **Verificado en Vivo contra AWS** |
| **CA-03.4** / **T13** | Demostración de limitación: token revocado aceptado hasta expirar | `docs/threat-model.md` §4, `evidence/security/README.md` | `evidence/security/README.md` (Protocolo 3) | Documentado (Pendiente usuarios en Cognito) |
| **CA-04.1** / **T03** | Donante intenta crear/modificar proyectos -> 403 | `backend/src/authz/rbac.ts` (`requireRole('GESTOR')`) | `backend/test/authz/rbac.test.ts`, `handlers.test.ts` | **Aprobado (Local)** |
| **CA-04.2** / **T12** | Gestor intenta consultar historial de donante -> 403 | `backend/src/authz/rbac.ts` (`requireRole('DONANTE')`) | `backend/test/authz/rbac.test.ts`, `handlers.test.ts` | **Aprobado (Local)** |
| **CA-04.3** / **CA-05.3** | Identidad (`sub`, `groups`) exclusivamente de claims verificados | `backend/src/authz/principal.ts` (`getPrincipal`), handlers | `backend/test/authz/principal.test.ts`, `handlers.test.ts` | **Aprobado (Local)** |
| **CA-06.1** | Endpoint de simulación exclusivo del stage `academic` | `backend/src/authz/policy.ts` (`stageRestriction: 'academic'`) | `backend/test/authz/policy.test.ts`, `withAuthz.test.ts` | **Aprobado (Local)** |
| **CA-07.2** / **T09** | Mitigación BOLA: acceso a donación ajena responde 404 | `backend/src/authz/ownership.ts` (`assertOwner`) | `backend/test/authz/ownership.test.ts`, `handlers.test.ts` | **Aprobado (Local)** |
| **CA-11.1** / **CA-11.2** / **T14** | MFA TOTP obligatorio para roles GESTOR y AUDITOR | `infra/template.yaml`, `evidence/security/README.md` | `evidence/security/README.md` (Protocolo 1) | Documentado (Pendiente usuarios en Cognito) |
| **CA-NF01.2** / **CA-NF07.1** | Logs y respuestas sanitizadas sin secretos, stack ni tokens | `backend/src/authz/errors.ts`, `backend/src/authz/withAuthz.ts` | `backend/test/authz/withAuthz.test.ts` | **Aprobado (Local)** |
| **CA-NF02.1** / **T11** | ID token o token alterado rechazado en API Gateway | `infra/template.yaml` (Scopes por ruta), API Gateway PEP | `evidence/security/README.md` (Protocolo 2) | Documentado (Pendiente despliegue de rutas en APIGW) |
| **CA-NF02.2** | Validación en Lambda de rol y reglas de negocio | `backend/src/authz/withAuthz.ts`, `backend/src/authz/policy.ts` | `backend/test/authz/withAuthz.test.ts`, `handlers.test.ts` | **Aprobado (Local)** |
| **CA-NF02.3** | Mapeo NIST SP 800-207 y componentes PE/PA/PEP | `docs/threat-model.md` §1 y §2 | `docs/threat-model.md` | **Completado** |
| **SEC-RT-01** | Aplicación en ejecución de `ENDPOINT_POLICIES` vía `routeKey` (Fail-closed) | `backend/src/authz/withAuthz.ts` (`findPolicyByRouteKey`) | `backend/test/authz/withAuthz.test.ts` | **Aprobado (Local)** |
| **SEC-RT-02** | Rutas públicas envueltas en `withAuthz` se deniegan (403) por configuración errónea | `backend/src/authz/withAuthz.ts` (`policy.isPublic`) | `backend/test/authz/withAuthz.test.ts` | **Aprobado (Local)** |
| **SEC-RT-03** | Opciones explícitas en `withAuthz` son aditivas y nunca relajan la matriz declarativa | `backend/src/authz/withAuthz.ts` | `backend/test/authz/withAuthz.test.ts` | **Aprobado (Local)** |
| **SEC-RT-04** | Restricción de stage `academic` para simulación vía `event.requestContext.stage` | `backend/src/authz/withAuthz.ts` | `backend/test/authz/withAuthz.test.ts` | **Aprobado (Local)** |
| **SEC-CT-01** | Contrato automatizado entre `infra/template.yaml` y `ENDPOINT_POLICIES` | `backend/src/authz/policy.ts` (`ENDPOINT_POLICIES`) | `backend/test/authz/contract.test.ts` | **Aprobado (Local)** |

> **Nota de integridad académica:** Las pruebas marcadas como *Aprobado (Local)* han sido validadas mediante la suite unitaria automatizada (Vitest, 79 tests pasando). Las pruebas marcadas como *Verificado en Vivo contra AWS* fueron contrastadas con peticiones reales documentadas en `evidence/security/README.md`. Los escenarios marcados como *Pendiente* requieren la creación de usuarios de prueba en el pool de Cognito o la sincronización de las rutas protegidas en API Gateway.
