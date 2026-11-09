# Protocolo de Evidencias de Seguridad: MFA, PKCE y Ciclo de Vida de Tokens

**Proyecto:** Plataforma de Donaciones Seguras — Fundación AQP-SOLIDARIA  
**Curso:** Tópicos Avanzados en Ingeniería de Software — EPIS, UNSA  
**Rol responsable:** Integrante 2 — Identidad y Seguridad  
**Fecha:** Noviembre 2026  
**Estado:** **TODAS LAS PRUEBAS EN VIVO ESTÁN PENDIENTES DE EJECUTAR** (se ejecutarán una vez desplegada la infraestructura en AWS).

---

## 1. Resumen y Decisión Arquitectónica de MFA

### Decisión de MFA en el User Pool (Cognito)
En la plantilla `infra/template.yaml`, el recurso `DonationsUserPool` define:
```yaml
MfaConfiguration: OPTIONAL
EnabledMfas:
  - SOFTWARE_TOKEN_MFA
```
- **Razón:** Amazon Cognito no permite configurar exigencia de MFA por grupo (solo a nivel global de User Pool). Dado que los donantes tienen MFA opcional para minimizar la fricción en el registro, el pool no puede configurarse en `ON` (obligatorio para todos).
- **Riesgo:** Si un usuario perteneciente al grupo `GESTOR` o `AUDITOR` no tiene TOTP enrolado, podría autenticarse únicamente con usuario y contraseña, vulnerando la directriz Zero Trust (CA-11.1).
- **Mitigación obligatoria:** Procedimiento administrativo de aprovisionamiento. Toda cuenta creada para roles privilegiados (`GESTOR` y `AUDITOR`) debe crearse administrativamente, forzar el cambio de contraseña y enrolar obligatoriamente el dispositivo TOTP antes de ser entregada al usuario.
- **Limitación técnica declarada:** El access token de Cognito **no** transporta un claim específico de MFA (como `amr: ["mfa"]`). Por ende, la exigencia del segundo factor se valida y audita estrictamente en el Identity Provider (PA) durante la fase de emisión de tokens, no en el JWT authorizer de API Gateway.

---

## 2. Hipótesis por Comprobar en el Despliegue Real

Antes de dar por sentados comportamientos no documentados oficialmente de AWS, se establecen las siguientes dos hipótesis que deberán contrastarse experimentalmente en AWS:

> **Hipótesis A:** *¿API Gateway HTTP API responde HTTP 401 o HTTP 403 cuando se presenta un ID token legítimo como Bearer en un endpoint protegido con `AuthorizationScopes`?*  
> - *Planteamiento:* Un ID token de Cognito tiene firma y emisor válidos, pero carece del atributo de scopes OAuth2 (`scope` o `scp`). Se comprobará si el JWT authorizer rechaza la solicitud en la Capa 1 con 401 (token no aplicable como credencial de autorización) o con 403 (autorizado en identidad pero con scopes insuficientes).

> **Hipótesis B:** *¿Amazon Cognito Hosted UI rechaza una solicitud de autorización si no se envía el parámetro `code_challenge`?*  
> - *Planteamiento:* Se evaluará si el endpoint `/oauth2/authorize` de Cognito configurado para cliente público SPA con flujo `code` rechaza de inmediato con error `invalid_request` si un atacante omite `code_challenge` y `code_challenge_method`.

---

## 3. Protocolos Paso a Paso y Checklist de Capturas

### Protocolo 1: T14 — Enrolamiento TOTP y Exigencia de Segundo Factor para GESTOR
**Objetivo (CA-11.2, T14):** Demostrar que un usuario con rol privilegiado (`GESTOR`) no puede obtener tokens de sesión sin ingresar el código TOTP de su aplicación autenticadora.  
**Estado:** `PENDIENTE DE EJECUTAR EN AWS`

#### Procedimiento:
1. **Creación del usuario de prueba:**
   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id <USER_POOL_ID> \
     --username gestor@aqp-solidaria.org \
     --user-attributes Email=gestor@aqp-solidaria.org,email_verified=true \
     --temporary-password "Temporal123456!"
   ```
2. **Asignación al grupo GESTOR:**
   ```bash
   aws cognito-idp admin-add-user-to-group \
     --user-pool-id <USER_POOL_ID> \
     --username gestor@aqp-solidaria.org \
     --group-name GESTOR
   ```
3. **Inicio de sesión inicial y enrolamiento TOTP:**
   - Iniciar sesión en la Hosted UI o vía API `AdminInitiateAuth`.
   - Establecer nueva contraseña permanente.
   - Invocar `AssociateSoftwareToken` para obtener el secreto TOTP / código QR.
   - Registrar la clave en Google Authenticator / 1Password.
   - Enviar `VerifySoftwareToken` con un código de 6 dígitos para activar el dispositivo.
   - Configurar el software token como preferido (`SetUserMFAPreference`).
4. **Prueba negativa T14 (Intento de login sin segundo factor):**
   - Ejecutar login con usuario y contraseña permanente.
   - Cognito responde con desafío `ChallengeName: "SOFTWARE_TOKEN_MFA"` y un `Session` temporal, **sin entregar `AccessToken` ni `IdToken`**.
   - Si no se envía el código TOTP mediante `RespondToAuthChallenge`, el flujo termina sin emisión de credenciales.
5. **Prueba positiva:**
   - Enviar el código TOTP válido; verificar recepción de los tokens de sesión.

#### Capturas de pantalla requeridas:
- [ ] `evidence/security/t14-01-creacion-gestor-grupo.png`: Usuario en consola o CLI asignado a grupo GESTOR.
- [ ] `evidence/security/t14-02-enrolamiento-totp-qr.png`: Pantalla de escaneo de QR y vinculación de app autenticadora.
- [ ] `evidence/security/t14-03-desafio-mfa-bloqueante.png`: Respuesta del IdP con `SOFTWARE_TOKEN_MFA` denegando tokens directos.
- [ ] `evidence/security/t14-04-login-exitoso-con-totp.png`: Emisión exitosa de tokens tras validar el código de 6 dígitos.

---

### Protocolo 2: Flujo OIDC Seguro (Authorization Code + PKCE)
**Objetivo (CA-03.1):** Verificar que la autenticación del cliente SPA utiliza exclusivamente Authorization Code con Proof Key for Code Exchange (RFC 7636) y que no se utiliza el flujo implícito.  
**Estado:** `PENDIENTE DE EJECUTAR EN AWS`

#### Procedimiento:
1. **Generación de Verifier y Challenge:**
   - En consola del navegador o script Node.js:
     ```javascript
     const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"; // Base64URL(Random 32 bytes)
     // SHA256 del verifier en Base64URL:
     const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
     ```
2. **Petición de autorización al Hosted UI:**
   ```
   GET https://<DOMINIO_COGNITO>.auth.<REGION>.amazoncognito.com/oauth2/authorize?
     response_type=code&
     client_id=<APP_CLIENT_ID>&
     redirect_uri=http://localhost:5173/callback&
     scope=openid+email+api/donations.write+api/donations.read&
     code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
     code_challenge_method=S256
   ```
3. **Comprobación de Hipótesis B (Omitir code_challenge):**
   - Realizar la misma petición sin los parámetros `code_challenge` ni `code_challenge_method`.
   - Registrar si Cognito responde con error HTTP 400 (`invalid_request`) o redirige con error.
4. **Intercambio del código por tokens (Token Exchange):**
   ```bash
   curl -X POST "https://<DOMINIO_COGNITO>.auth.<REGION>.amazoncognito.com/oauth2/token" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code" \
     -d "client_id=<APP_CLIENT_ID>" \
     -d "code=<CODIGO_OBTENIDO>" \
     -d "redirect_uri=http://localhost:5173/callback" \
     -d "code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
   ```
5. **Verificación de tokens en memoria:**
   - Comprobar que la SPA almacena los tokens en memoria de JavaScript y no en `localStorage` ni `sessionStorage` (RNF-HU-11).

#### Capturas de pantalla requeridas:
- [ ] `evidence/security/pkce-01-solicitud-con-challenge.png`: Inspección de red mostrando parámetros `code_challenge` y `code_challenge_method=S256`.
- [ ] `evidence/security/pkce-02-intercambio-token-verifier.png`: Petición POST a `/oauth2/token` con `code_verifier`.
- [ ] `evidence/security/pkce-03-tokens-en-memoria.png`: DevTools mostrando `localStorage` vacío y tokens contenidos en memoria.
- [ ] `evidence/security/pkce-04-hipotesis-b-rechazo-sin-challenge.png`: Respuesta de Cognito al omitir `code_challenge`.

---

### Protocolo 3: T11 — Token Alterado e ID Token como Bearer
**Objetivo (CA-03.2, CA-NF02.1, T11):** Demostrar que API Gateway rechaza tokens no válidos o ID tokens usados indebidamente como credenciales de autorización.  
**Estado:** `PENDIENTE DE EJECUTAR EN AWS`

#### Procedimiento:
1. **Caso 1: Token con firma alterada:**
   - Tomar un access token válido y alterar un solo caracter de la firma (tercera sección del JWT).
   - Enviar a la API:
     ```bash
     curl -i -X POST "https://<API_ID>.execute-api.<REGION>.amazonaws.com/academic/v1/donations" \
       -H "Authorization: Bearer <TOKEN_ALTERADO>" \
       -H "Content-Type: application/json" \
       -d '{"projectId":"p1","amountCents":5000}'
     ```
   - *Resultado esperado:* HTTP 401 Unauthorized desde API Gateway.
2. **Caso 2: ID Token usado como Bearer (Comprobación de Hipótesis A):**
   - Extraer el `id_token` obtenido en el login (que contiene nombre y correo, pero NO contiene scopes de API).
   - Enviar el `id_token` como Bearer al endpoint protegido `/v1/donations`:
     ```bash
     curl -i -X POST "https://<API_ID>.execute-api.<REGION>.amazonaws.com/academic/v1/donations" \
       -H "Authorization: Bearer <ID_TOKEN>" \
       -H "Content-Type: application/json" \
       -d '{"projectId":"p1","amountCents":5000}'
     ```
   - *Resultado esperado:* Rechazo con HTTP 401 o 403 por falta de `api/donations.write`. Registrar cuál código exacto retorna API Gateway HTTP API.

#### Capturas de pantalla requeridas:
- [ ] `evidence/security/t11-01-token-alterado-401.png`: Respuesta 401 Unauthorized ante firma corrupta.
- [ ] `evidence/security/t11-02-id-token-bearer-rechazado.png`: Respuesta del API Gateway al usar ID token en lugar de Access token (evidencia de Hipótesis A).

---

### Protocolo 4: T13 — Revocación de Refresh Token y Ventana de Exposición
**Objetivo (CA-03.3, CA-03.4, T13):** Demostrar el funcionamiento de `/oauth2/revoke` y registrar la limitación conocida del JWT authorizer local.  
**Estado:** `PENDIENTE DE EJECUTAR EN AWS`

#### Procedimiento:
1. **Paso A: Obtención de par de tokens:**
   - Iniciar sesión y guardar `ACCESS_TOKEN_1` y `REFRESH_TOKEN_1`.
2. **Paso B: Verificación de acceso inicial:**
   - Invocar `GET /v1/donations/me` con `ACCESS_TOKEN_1` -> Responde HTTP 200.
3. **Paso C: Revocación explícita (Logout):**
   ```bash
   curl -X POST "https://<DOMINIO_COGNITO>.auth.<REGION>.amazoncognito.com/oauth2/revoke" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "token=<REFRESH_TOKEN_1>" \
     -d "client_id=<APP_CLIENT_ID>"
   ```
   - Responde HTTP 200 OK.
4. **Paso D: Demostración de la limitación (Uso de Access Token no expirado):**
   - Inmediatamente después de la revocación, invocar nuevamente `GET /v1/donations/me` usando `ACCESS_TOKEN_1`.
   - *Comportamiento esperado:* La petición **es aceptada (HTTP 200)** porque API Gateway valida el JWT localmente sin consultar revocaciones en tiempo real.
5. **Paso E: Verificación de revocación del Refresh Token:**
   - Intentar renovar tokens con el `REFRESH_TOKEN_1` revocado:
     ```bash
     curl -X POST "https://<DOMINIO_COGNITO>.auth.<REGION>.amazoncognito.com/oauth2/token" \
       -d "grant_type=refresh_token" \
       -d "client_id=<APP_CLIENT_ID>" \
       -d "refresh_token=<REFRESH_TOKEN_1>"
     ```
   - *Resultado esperado:* Error HTTP 400 `invalid_grant` ("Refresh token has been revoked").
6. **Paso F: Expiración natural del Access Token:**
   - Transcurridos 15 minutos (vigencia configurada en `template.yaml`), reintentar con `ACCESS_TOKEN_1`.
   - *Resultado esperado:* HTTP 401 Unauthorized ("Token has expired").

#### Capturas de pantalla requeridas:
- [ ] `evidence/security/t13-01-revoke-refresh-token.png`: Petición POST a `/oauth2/revoke` con respuesta 200.
- [ ] `evidence/security/t13-02-access-token-aceptado-antes-de-expirar.png`: Demostración de la limitación arquitectónica (HTTP 200 con token de sesión revocado).
- [ ] `evidence/security/t13-03-refresh-token-rechazado-400.png`: Fallo al intentar refrescar tokens con el refresh token revocado.
- [ ] `evidence/security/t13-04-access-token-expirado-401.png`: Rechazo 401 definitivo tras transcurrir los 15 minutos.

---

## 4. Tabla de Seguimiento del Checklist

| ID | Escenario / Prueba | Evidencia Asociada | Estado Actual |
|---|---|---|---|
| **T11** | ID token o token alterado como Bearer | Capturas `t11-01` y `t11-02` | `PENDIENTE DE EJECUTAR` |
| **T13** | Token revocado aceptado hasta expirar (15 min) | Capturas `t13-01`, `t13-02`, `t13-03`, `t13-04` | `PENDIENTE DE EJECUTAR` |
| **T14** | GESTOR sin TOTP no obtiene credenciales | Capturas `t14-01`, `t14-02`, `t14-03`, `t14-04` | `PENDIENTE DE EJECUTAR` |
| **PKCE** | Authorization Code con S256 verifier/challenge | Capturas `pkce-01`, `pkce-02`, `pkce-03`, `pkce-04` | `PENDIENTE DE EJECUTAR` |
| **Hipótesis A** | Código de respuesta (401 vs 403) ante ID token con scopes | Log de respuesta API Gateway | `PENDIENTE DE COMPROBAR` |
| **Hipótesis B** | Rechazo de `/oauth2/authorize` sin `code_challenge` | Log de respuesta Cognito | `PENDIENTE DE COMPROBAR` |
