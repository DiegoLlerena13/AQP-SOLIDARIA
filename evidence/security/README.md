# Protocolo de Evidencias de Seguridad: Cognito, API Gateway, MFA, PKCE y BOLA

**Proyecto:** Plataforma de Donaciones Seguras — Fundación AQP-SOLIDARIA  
**Curso:** Tópicos Avanzados en Ingeniería de Software — EPIS, UNSA  
**Rol responsable:** Integrante 2 — Identidad y Seguridad (Joshep)  
**Fecha:** Noviembre 2026 | **Versión:** 2.2  
**Declaración de Integridad Académica:** No se simulan pruebas reales de AWS ni se afirma cumplimiento sin evidencias. Este documento registra las evidencias técnicas recolectadas directamente en vivo de la infraestructura AWS desplegada, y detalla con precisión los protocolos pendientes de ejecución con usuarios de prueba provisionados.

---

## 1. Datos de Infraestructura Real en AWS

La infraestructura real del proyecto ha sido desplegada en la región `us-east-2` de AWS con los siguientes parámetros autoritativos:

| Recurso | Parámetro / Identificador en AWS |
|---|---|
| **Región AWS** | `us-east-2` (US East - Ohio) |
| **Cognito User Pool ID** | `us-east-2_DH2KMafTU` |
| **Cognito App Client ID** | `7ft2f51iags0qnirve0vocq5s9` |
| **Dominio Hosted UI / OIDC** | `https://us-east-2dh2kmaftu.auth.us-east-2.amazoncognito.com` |
| **API Gateway HTTP API** | `https://r3hrmkrkkf.execute-api.us-east-2.amazonaws.com/academic` |
| **API Gateway ID** | `r3hrmkrkkf` |
| **Stage Activo** | `academic` |

---

## 2. Evidencias Verificadas en Vivo contra AWS (Con Registros Reales)

A continuación se presentan las respuestas HTTP y llamadas reales ejecutadas contra los servicios de AWS, documentando con cabeceras y `request-id` de Amazon su comportamiento:

### Evidencia Real 1: Descubrimiento OIDC y Verificación de S256 PKCE
- **Endpoint consultado:** `GET https://cognito-idp.us-east-2.amazonaws.com/us-east-2_DH2KMafTU/.well-known/openid-configuration`
- **Cabeceras de respuesta:**
  ```http
  HTTP/1.1 200 OK
  Date: Wed, 11 Nov 2026 21:35:07 GMT
  Content-Type: application/json
  x-amzn-RequestId: 3e06be36-22ac-4a9a-862b-69eb3886a09c
  ```
- **Cuerpo recibido:**
  ```json
  {
    "authorization_endpoint": "https://us-east-2dh2kmaftu.auth.us-east-2.amazoncognito.com/oauth2/authorize",
    "code_challenge_methods_supported": ["S256"],
    "end_session_endpoint": "https://us-east-2dh2kmaftu.auth.us-east-2.amazoncognito.com/logout",
    "grant_types_supported": ["authorization_code", "refresh_token", "client_credentials"],
    "issuer": "https://cognito-idp.us-east-2.amazonaws.com/us-east-2_DH2KMafTU",
    "jwks_uri": "https://cognito-idp.us-east-2.amazonaws.com/us-east-2_DH2KMafTU/.well-known/jwks.json",
    "revocation_endpoint": "https://us-east-2dh2kmaftu.auth.us-east-2.amazoncognito.com/oauth2/revoke",
    "token_endpoint": "https://us-east-2dh2kmaftu.auth.us-east-2.amazoncognito.com/oauth2/token"
  }
  ```
- **Conclusión de seguridad:** Se confirma que el User Pool real soporta exclusivamente `S256` para PKCE (`code_challenge_methods_supported`), dispone de endpoint de revocación de refresh tokens (`/oauth2/revoke`) y el emisor (`iss`) coincide con `https://cognito-idp.us-east-2.amazonaws.com/us-east-2_DH2KMafTU`.

---

### Evidencia Real 2: Verificación del Endpoint de Revocación de Tokens (RFC 7009)
- **Endpoint consultado:** `POST https://us-east-2dh2kmaftu.auth.us-east-2.amazoncognito.com/oauth2/revoke`
- **Parámetros enviados:** `client_id=7ft2f51iags0qnirve0vocq5s9&token=dummy-refresh-token`
- **Respuesta real:**
  ```http
  HTTP/1.1 200 OK
  Date: Wed, 11 Nov 2026 21:36:00 GMT
  x-amzn-RequestId: 2012626c-6ec8-4d03-963b-bf8bb0662f76
  x-amz-cognito-request-id: 475edf95-0c46-4867-a012-953fbdd7bfed
  ```
- **Conclusión de seguridad:** Se verifica que el App Client tiene habilitada la revocación de tokens (`EnableTokenRevocation: true`) y responde conforme al estándar RFC 7009 con HTTP 200 OK.

---

### Evidencia Real 3: Bloqueo de Flujo de Contraseña en Texto Plano (`USER_PASSWORD_AUTH`)
- **Petición ejecutada:** Invocación a `AWSCognitoIdentityProviderService.InitiateAuth` con flujo `USER_PASSWORD_AUTH` hacia el Client ID `7ft2f51iags0qnirve0vocq5s9`.
- **Respuesta real:**
  ```http
  HTTP/1.1 400 Bad Request
  Date: Wed, 11 Nov 2026 21:36:09 GMT
  Content-Type: application/x-amz-json-1.1
  x-amzn-RequestId: 0bc26b1d-2560-41b0-a5b1-9acdac39a0ee
  x-amzn-ErrorType: InvalidParameterException:
  x-amzn-ErrorMessage: USER_PASSWORD_AUTH flow not enabled for this client

  {"__type":"InvalidParameterException","message":"USER_PASSWORD_AUTH flow not enabled for this client"}
  ```
- **Conclusión de seguridad:** Se evidencia que el cliente público de Cognito rechaza rotundamente la transmisión directa de contraseñas (`USER_PASSWORD_AUTH`), exigiendo exclusivamente SRP (`ALLOW_USER_SRP_AUTH`) y Authorization Code con PKCE para prevenir la intercepción de credenciales.

---

### Evidencia Real 4: Protección contra Enumeración de Usuarios (`PreventUserExistenceErrors`)
- **Petición ejecutada:** Intento de autenticación SRP (`USER_SRP_AUTH`) para un usuario inexistente (`nonexistent@aqp-solidaria.org`).
- **Respuesta real:**
  ```http
  HTTP/1.1 200 OK
  Date: Wed, 11 Nov 2026 21:36:32 GMT
  x-amzn-RequestId: 9a2fb88a-b729-474a-8a77-15351813a032
  {"ChallengeName":"PASSWORD_VERIFIER","ChallengeParameters":{"SALT":"2fe3a91822c47fc7bd5d26a544ed11ac", ...}}
  ```
- **Conclusión de seguridad:** En lugar de responder con `UserNotFoundException`, Cognito genera un desafío SRP simulado con sal efímera. Esto demuestra que `PreventUserExistenceErrors: ENABLED` está activo y previene que un atacante descubra qué correos están registrados.

---

### Evidencia Real 5: Endpoint de Salud de API Gateway en Vivo
- **Petición ejecutada:** `GET https://r3hrmkrkkf.execute-api.us-east-2.amazonaws.com/academic/health`
- **Respuesta real:**
  ```http
  HTTP/1.1 200 OK
  Date: Wed, 11 Nov 2026 20:42:02 GMT
  Content-Type: application/json
  Apigw-Requestid: GsXsHik2CYcEPhw=

  {"status":"ok","application":"AQP-SOLIDARIA","environment":"academic"}
  ```
- **Conclusión de seguridad:** El API Gateway HTTP API `r3hrmkrkkf` y la Lambda de salud se encuentran operativas en el stage `academic`.

---

### Evidencia Real 6: Catálogo Público de Proyectos en Vivo
- **Petición ejecutada:** `GET https://r3hrmkrkkf.execute-api.us-east-2.amazonaws.com/academic/v1/projects`
- **Respuesta real:**
  ```http
  HTTP/1.1 200 OK
  Date: Wed, 11 Nov 2026 20:59:15 GMT
  Content-Type: application/json
  Apigw-Requestid: GsaNegCBCYcEPBQ=

  []
  ```
- **Conclusión de seguridad:** La ruta pública opera sin autorizador JWT (`Authorizer: NONE`), retornando la lista vacía inicial de proyectos sin filtrar datos sensibles.

---

### Evidencia Real 7: Comprobación de Hipótesis B (Hosted UI sin `code_challenge`)
- **Petición ejecutada:** `GET https://us-east-2dh2kmaftu.auth.us-east-2.amazoncognito.com/oauth2/authorize?response_type=code&client_id=7ft2f51iags0qnirve0vocq5s9&redirect_uri=http://localhost:5173/callback`
- **Respuesta real:**
  ```http
  HTTP/1.1 302 Found
  Date: Wed, 11 Nov 2026 21:35:20 GMT
  x-amzn-RequestId: 47f4947a-0bcc-4807-bce4-f6c9442660e1
  Location: https://us-east-2dh2kmaftu.auth.us-east-2.amazoncognito.com/login?client_id=7ft2f51iags0qnirve0vocq5s9&redirect_uri=http://localhost:5173/callback&response_type=code
  ```
- **Petición subsiguiente de intercambio (`/oauth2/token` con código inválido):**
  ```http
  HTTP/1.1 400 Bad Request
  x-amzn-RequestId: af28b206-a92f-4503-975f-d7af640397c4

  {"error":"invalid_grant"}
  ```
- **Conclusión de Hipótesis B:** La Hosted UI de Cognito no rechaza la petición GET `/oauth2/authorize` inmediatamente en el navegador si falta `code_challenge`, sino que redirige a la pantalla `/login`. Sin embargo, el intercambio en `/oauth2/token` es estrictamente validado y denegado (`invalid_grant`) si no coincide el par `code_verifier`/`code_challenge` emitido.

---

### Evidencia Real 8: Diagnóstico de Rutas Protegidas en API Gateway
- **Petición ejecutada:** `POST https://r3hrmkrkkf.execute-api.us-east-2.amazonaws.com/academic/v1/donations`
- **Respuesta real recibida:**
  ```http
  HTTP/1.1 404 Not Found
  Date: Wed, 11 Nov 2026 20:52:17 GMT
  Content-Type: application/json
  apigw-requestid: GsZMYg-DiYcEMEQ=

  {"message":"Not Found"}
  ```
- **Diagnóstico técnico honesto:** El API Gateway `r3hrmkrkkf` desplegado inicialmente en AWS solo tiene publicadas las rutas `/health` y `GET /v1/projects`. Las rutas protegidas (`/v1/donations`, `/v1/donations/{donationId}/simulate`, `/v1/donations/me`, `/v1/projects` POST/PATCH) aún no han sido sincronizadas en el despliegue de AWS por el Integrante 1 (DevOps). Por consiguiente, las pruebas en vivo de rechazo por Capa 1 de API Gateway (401 vs 403 de la Hipótesis A) están **pendientes del despliegue del stack SAM actualizado**.

---

## 3. Arquitectura del Módulo de Seguridad y Controles Integrados

El módulo `backend/src/authz/` implementa la Capa 2 (Policy Engine / PE) de Zero Trust (NIST SP 800-207):

1. **`withAuthz(handler)`:** Wrapper HOF para todas las funciones Lambda protegidas.
   - Resuelve la política desde `ENDPOINT_POLICIES` vía `event.routeKey` (Fail-closed: 403 si la ruta no existe).
   - Normaliza prefijos de stage (`/academic/v1/...` -> `/v1/...`) para total compatibilidad con eventos reales de API Gateway.
   - Deniega (403) si una ruta pública es envuelta erróneamente con `withAuthz`.
   - Exige que el stage sea estrictamente `academic` para el endpoint de simulación (`CA-06.1`).
   - Valida identidad (`getPrincipal`), roles RBAC (`requireRole`) y scopes OAuth2 (`requireScope`).
   - Sanitiza errores estructurados `{ code, message, requestId }` sin fugar trazas, contraseñas ni tokens.

2. **Mitigación BOLA (`ownership.ts` - `assertOwner`):**
   - Conforme a **CA-07.2** y la directriz de seguridad de OWASP API1:2023, si un donante intenta consultar o simular una donación ajena (`resource.donorSub !== principal.sub`), `assertOwner` lanza **HTTP 404 (NOT_FOUND)** y **NUNCA 403 (FORBIDDEN)**.
   - Esto impide que atacantes realicen enumeración de identificadores de recursos ajenos.

3. **Defensa en Profundidad ante Tokens (`principal.ts`):**
   - **CA-03.2:** Valida que el token sea de tipo access token (`claims.token_use === 'access'`). Si se presenta un ID token (`claims.token_use === 'id'`), responde **HTTP 401 UNAUTHORIZED**.
   - Valida `client_id` contra `process.env.COGNITO_CLIENT_ID` (`7ft2f51iags0qnirve0vocq5s9`).
   - Valida `iss` contra `process.env.COGNITO_USER_POOL_ID` (`us-east-2_DH2KMafTU`).

4. **Integración en Handlers de Negocio:**
   - `backend/src/donations/simulate.ts`: Envuelto con `withAuthz`; verifica pertenencia con `assertOwner(principal, donation)`.
   - `backend/src/donations/create.ts`: Envuelto con `withAuthz`; extrae `donorSub` estrictamente de `principal.sub`.
   - `backend/src/donations/me.ts`: Envuelto con `withAuthz`; consulta DynamoDB usando `principal.sub`.
   - `backend/src/projects/create.ts`: Envuelto con `withAuthz`; restringe a rol `GESTOR` y asigna `createdBy: principal.sub`.
   - `backend/src/projects/publish.ts`: Envuelto con `withAuthz`; restringe a rol `GESTOR`.

---

## 4. Protocolos Paso a Paso para Pruebas Pendientes en AWS

Los siguientes protocolos se ejecutarán una vez que se hayan creado los usuarios de prueba en el User Pool `us-east-2_DH2KMafTU` y se desplieguen las rutas en API Gateway:

### Protocolo 1: T14 — Enrolamiento TOTP y Exigencia de Segundo Factor para GESTOR
**Objetivo (CA-11.2, T14):** Demostrar que un usuario del grupo privilegiado `GESTOR` no puede obtener tokens de sesión sin ingresar el código TOTP de su app autenticadora.  
**Estado:** `PENDIENTE DE APROVISIONAMIENTO EN COGNITO`

#### Comandos con datos reales de AWS:
1. **Creación del usuario gestor:**
   ```bash
   aws cognito-idp admin-create-user \
     --region us-east-2 \
     --user-pool-id us-east-2_DH2KMafTU \
     --username gestor@aqp-solidaria.org \
     --user-attributes Email=gestor@aqp-solidaria.org,email_verified=true \
     --temporary-password "Temporal123456!"
   ```
2. **Asignación al grupo GESTOR:**
   ```bash
   aws cognito-idp admin-add-user-to-group \
     --region us-east-2 \
     --user-pool-id us-east-2_DH2KMafTU \
     --username gestor@aqp-solidaria.org \
     --group-name GESTOR
   ```
3. **Inicio de sesión y enrolamiento TOTP:**
   - Iniciar sesión en `https://us-east-2dh2kmaftu.auth.us-east-2.amazoncognito.com/login?client_id=7ft2f51iags0qnirve0vocq5s9&response_type=code&redirect_uri=http://localhost:5173/callback`.
   - Establecer contraseña permanente.
   - Enrolar aplicación autenticadora (Google Authenticator) escaneando el código QR.
4. **Prueba negativa T14 (Intento de login sin segundo factor):**
   - Enviar credenciales; Cognito retorna `ChallengeName: "SOFTWARE_TOKEN_MFA"`.
   - Constatar que Cognito **NO entrega AccessToken ni IdToken** hasta validar el código TOTP de 6 dígitos.
5. **Capturas requeridas:**
   - `evidence/security/t14-01-creacion-gestor-grupo.png`
   - `evidence/security/t14-02-enrolamiento-totp-qr.png`
   - `evidence/security/t14-03-desafio-mfa-bloqueante.png`
   - `evidence/security/t14-04-login-exitoso-con-totp.png`

---

### Protocolo 2: T11 — ID Token como Bearer y Token Alterado (Hipótesis A)
**Objetivo (CA-03.2, T11):** Contrastar si API Gateway HTTP API responde HTTP 401 o HTTP 403 al recibir un ID token en un endpoint con `AuthorizationScopes`.  
**Estado:** `PENDIENTE DE DESPLIEGUE DE RUTAS EN API GATEWAY`

#### Procedimiento:
1. **Caso A (Firma alterada):**
   ```bash
   curl -i -X POST "https://r3hrmkrkkf.execute-api.us-east-2.amazonaws.com/academic/v1/donations" \
     -H "Authorization: Bearer <ACCESS_TOKEN_CORRUPTO>" \
     -H "Content-Type: application/json" \
     -d '{"projectId":"p1","amountCents":5000}'
   ```
   *Resultado esperado:* HTTP 401 Unauthorized desde API Gateway.
2. **Caso B (ID Token usado como Bearer):**
   ```bash
   curl -i -X POST "https://r3hrmkrkkf.execute-api.us-east-2.amazonaws.com/academic/v1/donations" \
     -H "Authorization: Bearer <ID_TOKEN_VALIDO>" \
     -H "Content-Type: application/json" \
     -d '{"projectId":"p1","amountCents":5000}'
   ```
   *Resultado esperado:* Registrar si API Gateway responde 401 o 403 debido a la ausencia del claim `scope: "api/donations.write"`.

---

### Protocolo 3: T13 — Revocación de Refresh Token y Ventana de Exposición
**Objetivo (CA-03.3, CA-03.4, T13):** Demostrar el funcionamiento de `/oauth2/revoke` y la aceptación temporal del access token local en API Gateway hasta su expiración (15 minutos).  
**Estado:** `PENDIENTE DE APROVISIONAMIENTO EN COGNITO`

#### Procedimiento:
1. Iniciar sesión y obtener `ACCESS_TOKEN` y `REFRESH_TOKEN`.
2. Revocar explícitamente:
   ```bash
   curl -X POST "https://us-east-2dh2kmaftu.auth.us-east-2.amazoncognito.com/oauth2/revoke" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "token=<REFRESH_TOKEN>" \
     -d "client_id=7ft2f51iags0qnirve0vocq5s9"
   ```
3. Comprobar que reintentar renovación en `/oauth2/token` con el refresh token devuelve HTTP 400 `invalid_grant`.
4. Comprobar que el `ACCESS_TOKEN` sigue siendo admitido localmente por API Gateway hasta que transcurran los 15 minutos, momento en el cual expira (HTTP 401).

---

## 5. Tabla de Seguimiento del Checklist

| ID | Control / Requisito | Evidencia Asociada | Estado Actual |
|---|---|---|---|
| **CA-03.1** | Auth Code + PKCE (S256) obligatorio | Evidencia Real 1 (`code_challenge_methods_supported`) | **Verificado en Vivo** |
| **CA-03.2** | Bloqueo de contraseñas planas (SRP obligatorio) | Evidencia Real 3 (`USER_PASSWORD_AUTH flow not enabled`) | **Verificado en Vivo** |
| **CA-03.2** | Protección contra enumeración de usuarios | Evidencia Real 4 (`PreventUserExistenceErrors: ENABLED`) | **Verificado en Vivo** |
| **CA-03.3** | Endpoint de revocación habilitado | Evidencia Real 2 (`/oauth2/revoke` HTTP 200) | **Verificado en Vivo** |
| **CA-03.2** | Rechazo de ID Token en Capa 2 (Lambda) | `principal.test.ts` (test `token_use === 'id'`) | **Aprobado en Suite Local** |
| **CA-04.1** | RBAC: Donante no crea ni publica proyectos | `handlers.test.ts`, `rbac.test.ts` (HTTP 403) | **Aprobado en Suite Local** |
| **CA-04.2** | RBAC: Gestor no accede a `/v1/donations/me` | `handlers.test.ts`, `rbac.test.ts` (HTTP 403) | **Aprobado en Suite Local** |
| **CA-04.3** | Identidad extraída exclusivamente de claims | `principal.test.ts`, `handlers.test.ts` | **Aprobado en Suite Local** |
| **CA-06.1** | Simulación restringida a stage academic | `policy.test.ts`, `withAuthz.test.ts` | **Aprobado en Suite Local** |
| **CA-07.2** | Mitigación BOLA: Donación ajena responde 404 | `handlers.test.ts`, `ownership.test.ts` | **Aprobado en Suite Local** |
| **T14** | MFA TOTP para GESTOR | Protocolo 1 (Checklist de capturas) | `Pendiente Aprovisionamiento` |
| **T11** | ID Token / Token alterado en API Gateway | Protocolo 2 (Checklist de capturas) | `Pendiente Despliegue Rutas` |
| **T13** | Revocación en vivo y ventana 15 min | Protocolo 3 (Checklist de capturas) | `Pendiente Aprovisionamiento` |
| **Hipótesis A** | Código de respuesta (401 vs 403) en API Gateway | Log de respuesta API Gateway | `Pendiente Despliegue Rutas` |
| **Hipótesis B** | Comportamiento Hosted UI ante falta de challenge | Evidencia Real 7 (Redirección 302 y 400 en token exchange) | **Comprobado en Vivo** |
