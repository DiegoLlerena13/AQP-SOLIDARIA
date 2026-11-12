# AQP-SOLIDARIA — Plataforma de donaciones simuladas con Zero Trust

**Proyecto académico | Tópicos Avanzados en Ingeniería de Software (TAIS) | EPIS – Universidad Nacional de San Agustín (UNSA), Arequipa, Perú**

AQP-SOLIDARIA es una aplicación web *cloud-native* basada en arquitectura **serverless**, desarrollada para una fundación ficticia que publica proyectos sociales y registra **intenciones de donación exclusivamente simuladas**. El proyecto implementa controles de autenticación, autorización y mínimo privilegio inspirados en **NIST SP 800-207 (Zero Trust Architecture)**.

> **Aviso:** prototipo académico. No recibe dinero, no procesa pagos reales y no debe solicitar números de tarjeta, CVV ni credenciales bancarias.

## 🌐 Enlaces del proyecto

| Recurso | Enlace |
|---|---|
| **Aplicación web desplegada (HTTPS)** | **[Abrir AQP-SOLIDARIA](https://d2ntyf9p68a1jz.cloudfront.net/)** |
| Repositorio GitHub | [DiegoLlerena13/AQP-SOLIDARIA](https://github.com/DiegoLlerena13/AQP-SOLIDARIA) |
| Rama de integración | [`feature/integration`](https://github.com/DiegoLlerena13/AQP-SOLIDARIA/tree/feature/integration) |
| API académica — estado | [GET /health](https://r3hrmkrkkf.execute-api.us-east-2.amazonaws.com/academic/health) |
| API académica — proyectos | [GET /v1/projects](https://r3hrmkrkkf.execute-api.us-east-2.amazonaws.com/academic/v1/projects) |
| Especificación de requisitos | [`requirements.md`](./requirements.md) |
| Diseño de arquitectura y contratos | [`design.md`](./design.md) |
| Modelo de amenazas | [`ThreatDragonModels/`](./ThreatDragonModels/) |
| Evidencias | [`evidence/`](./evidence/) |
| Declaración de uso de IA | [`AI_USAGE.md`](./AI_USAGE.md) |

**Nota de disponibilidad:** la URL pública se mantiene durante la evaluación académica y puede dejar de funcionar después de la limpieza de recursos AWS.

## 1. Objetivos y alcance

- Permitir consultar campañas publicadas y sus cifras agregadas.
- Restringir la creación y publicación de campañas al rol **GESTOR**.
- Permitir que **DONANTE** registre, consulte y simule confirmar/rechazar únicamente sus propios aportes.
- Aplicar autenticación **Amazon Cognito**, **Authorization Code + PKCE**, **MFA TOTP**, **JWT**, **scopes**, **RBAC** y protección **BOLA/ownership**.
- Minimizar permisos de las funciones Lambda y comprobar controles con pruebas automatizadas y peticiones reales.
- Documentar decisiones, evidencias y amenazas STRIDE en **OWASP Threat Dragon**.

Las extensiones de consulta avanzada de auditoría (HU-10) y autorización externa con Amazon Verified Permissions/Cedar (HU-12) son opcionales en la especificación. Los eventos de auditoría de creación/publicación requeridos por **CA-08.3** son distintos de esa extensión y su implementación/verificación aún debe completarse.

## 2. Arquitectura y servicios AWS

```text
VISITANTE / DONANTE / GESTOR / AUDITOR
             |
             +--- HTTPS ---> CloudFront --- OAC ---> S3 privado (React/Vite)
             |
             +--- OAuth2 Authorization Code + PKCE ---> Cognito (MFA TOTP)
             |                              |
             |                       Access token JWT
             |                              |
             +--- HTTPS / Bearer ----------> API Gateway HTTP API
                                                | JWT authorizer + scopes
                                                v
                                         AWS Lambda (Node.js)
                                         authz: roles + ownership
                                                |
                           +--------------------+------------------+
                           |                                       |
                           v                                       v
                    DynamoDB                                  CloudWatch Logs
          Projects / Donations / Idempotency / Audit
```

| Servicio / tecnología | Finalidad y justificación |
|---|---|
| **Amazon Cognito** | Identidad centralizada, grupos `DONANTE`/`GESTOR`/`AUDITOR`, OAuth2/OIDC, PKCE y TOTP. |
| **Amazon API Gateway HTTP API** | Exposición de endpoints HTTPS, JWT authorizer y scopes por ruta; primera barrera de autorización. |
| **AWS Lambda** | Ejecución serverless de casos de uso sin mantener servidores; control de identidad y propiedad dentro de los handlers. |
| **Amazon DynamoDB** | Persistencia de proyectos, donaciones e idempotencia mediante claves, índices secundarios y operaciones condicionadas/transaccionales. Se creó además una tabla para eventos de auditoría. |
| **AWS IAM** | Roles diferenciados por función y políticas acotadas por tabla/acción, siguiendo mínimo privilegio. |
| **Amazon S3 (privado)** | Almacenamiento de los archivos estáticos compilados del frontend, sin lectura pública directa. |
| **Amazon CloudFront + OAC** | Distribución pública HTTPS del frontend y acceso controlado al bucket S3. |
| **Amazon CloudWatch Logs** | Registros técnicos y evidencia de solicitudes, respuestas y errores; retención configurada para funciones verificadas. |
| **AWS Budgets** | Seguimiento preventivo del consumo de recursos en la cuenta de uso académico. |
| **AWS SAM / CloudFormation** | Plantilla de infraestructura como código validada y compilada localmente; el despliegue efectivo se realizó manualmente en consola. |
| **GitHub / GitHub Actions** | Control de versiones, ramas, PR, integración y verificaciones de calidad. El flujo CI todavía requiere alineación con el entorno final. |
| **OWASP Threat Dragon** | Identificación y documentación de amenazas con STRIDE y límites de confianza. |

**Región utilizada:** `us-east-2` (Ohio). El despliegue se realizó **manualmente en la consola AWS**, debido a una restricción de Service Control Policy (SCP) que impidió completar el despliegue por CloudFormation. La plantilla SAM y la documentación de infraestructura permanecen como referencia técnica; no se afirma que el entorno esté completamente reproducido desde SAM.

## 3. Roles y permisos

| Operación | VISITANTE | DONANTE | GESTOR | AUDITOR |
|---|:---:|:---:|:---:|:---:|
| Ver campañas publicadas e indicadores | ✅ | ✅ | ✅ | ✅ |
| Registrar intención de donación | — | ✅ | — | — |
| Consultar historial propio | — | ✅ | — | — |
| Simular confirmación/rechazo propio | — | ✅ | — | — |
| Crear y publicar proyectos | — | — | ✅ | — |
| Consultar auditoría avanzada (extensión) | — | — | — | Previsto |

La validación de permisos se efectúa en el **backend**, no simplemente ocultando botones en React. El User Pool de la demostración exige **MFA TOTP a todos los usuarios** (configuración más estricta que el requisito mínimo para GESTOR y AUDITOR).

## 4. Funcionalidades y API

Base de la API: `https://r3hrmkrkkf.execute-api.us-east-2.amazonaws.com/academic`

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/health` | Público |
| `GET` | `/v1/projects` | Público |
| `GET` | `/v1/projects/{projectId}` | Público, solo PUBLICADO; verificar disponibilidad final |
| `GET` | `/v1/projects/{projectId}/stats` | Público; verificar disponibilidad final |
| `POST` | `/v1/projects` | GESTOR, scope `api/projects.write` |
| `PATCH` | `/v1/projects/{projectId}/publish` | GESTOR, scope `api/projects.write` |
| `POST` | `/v1/donations` | DONANTE, scope `api/donations.write` |
| `POST` | `/v1/donations/{donationId}/simulate` | DONANTE propietario; solo stage `academic` |
| `GET` | `/v1/donations/me` | DONANTE, scope `api/donations.read` |
| `GET` | `/v1/audit` | AUDITOR, scope `api/audit.read` (**extensión**, no declarada desplegada) |

Una intención de donación válida utiliza importe en céntimos enteros (`amountCents`, de 100 a 100000) y `Idempotency-Key`. Las donaciones comienzan en `PENDIENTE_SIMULACION` y pueden pasar a `CONFIRMADA_SIMULADA` o `RECHAZADA_SIMULADA`. Las confirmaciones actualizan la recaudación simulada; las rechazadas no deben incrementarla.

## 5. Instalación y ejecución local

**Requisitos:** Git, Node.js compatible con el proyecto y pnpm 10 para el frontend. Se recomienda utilizar las versiones indicadas en los archivos de dependencias y verificar la configuración antes de iniciar la aplicación.

```powershell
# Clonar la rama de integración
 git clone -b feature/integration https://github.com/DiegoLlerena13/AQP-SOLIDARIA.git
 cd AQP-SOLIDARIA

# Frontend
 cd frontend
 npx --yes pnpm@10 install
 Copy-Item .env.example .env
 # Editar .env con los valores de Cognito y API Gateway
 npx --yes pnpm@10 run dev
```

Abrir `http://localhost:5173/`.

**Ejemplo de `frontend/.env` para conectar con el entorno académico** (el *client ID* de una SPA es público; jamás introducir client secrets ni tokens aquí):

```dotenv
VITE_USE_MOCK=false
VITE_API_BASE_URL=https://r3hrmkrkkf.execute-api.us-east-2.amazonaws.com/academic
VITE_COGNITO_USER_POOL_ID=us-east-2_DH2KMafTU
VITE_COGNITO_CLIENT_ID=7ft2f51iags0qnirve0vocq5s9
VITE_COGNITO_DOMAIN=https://us-east-2dh2kmaftu.auth.us-east-2.amazoncognito.com
VITE_COGNITO_REDIRECT_URI=http://localhost:5173/callback
VITE_COGNITO_LOGOUT_URI=http://localhost:5173/
```

En Cognito deben estar permitidos el callback y logout del origen utilizado. **No utilizar el callback de CloudFront para una sesión iniciada en localhost**, porque PKCE requiere recuperar el `code_verifier` en el mismo origen. Si `frontend/.env` se modifica, reiniciar Vite. El archivo `.env` local **no se debe subir al repositorio**.

> **Producción:** antes de compilar para CloudFront, configurar `VITE_COGNITO_REDIRECT_URI=https://d2ntyf9p68a1jz.cloudfront.net/callback` y `VITE_COGNITO_LOGOUT_URI=https://d2ntyf9p68a1jz.cloudfront.net/`. Recomendado: mantener un `.env.production` separado y no versionar datos sensibles.

Para verificar backend localmente:

```powershell
cd ../backend
npm ci
npm run typecheck
npm test
npm run build
```

El backend no requiere un servidor Express local: los handlers se ejecutan como funciones Lambda y dependen de permisos AWS y variables de entorno (`PROJECTS_TABLE`, `DONATIONS_TABLE`, `IDEMPOTENCY_TABLE`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `APP_ENV`). La prueba de integración debe hacerse contra el stage académico desplegado o mediante eventos simulados apropiados.

## 6. Pruebas y resultados

**Ejecuciones reportadas durante la integración:**

| Prueba / verificación | Resultado |
|---|---|
| Vitest backend (`npm test`) | **82/82** pruebas aprobadas en 7 archivos |
| Vitest frontend (`pnpm test`) | **21/21** pruebas aprobadas en 6 archivos |
| Typecheck y build del backend/frontend | Ejecuciones satisfactorias |
| Login desde CloudFront con Cognito + PKCE | Verificado |
| MFA TOTP | Configuración mediante QR y desafío real para roles de prueba |
| Protección BOLA — T09 | DONANTE B recibió **HTTP 404** al intentar simular una donación de DONANTE A |
| IAM Policy Simulator — T10 | Lectura de proyectos permitida; `PutItem` denegado a la Lambda de listado |
| Creación de proyecto | BORRADOR creado en DynamoDB; después publicado mediante PATCH |
| Donación simulada | Intención registrada y confirmación con **HTTP 200**; acumulado actualizado de S/ 0 a S/ 10 |
| Auditoría de dependencias backend | `npm audit --omit=dev`: **0 vulnerabilidades conocidas reportadas** |
| Auditoría de dependencias frontend | `pnpm audit --prod`: **0 vulnerabilidades conocidas reportadas** tras retirar `zod` no utilizado |
| OWASP Threat Dragon | **6 amenazas STRIDE** documentadas: 4 clasificadas como mitigadas y 2 abiertas |

Las **14 pruebas de aceptación T01–T14** están definidas en [`requirements.md`](./requirements.md). Las 103 pruebas automatizadas aprobadas **no sustituyen** la evidencia real de todos los escenarios de aceptación.

**Pendientes por cerrar o documentar:** validación integral de idempotencia (T06–T07) y diez confirmaciones concurrentes (T08); token incorrecto en AWS (T11) y ventana de revocación (T13); prueba negativa formal de MFA sin completar el desafío (T14); eventos persistentes de auditoría al crear/publicar proyectos (CA-08.3); verificación de detalle/estadísticas, rendimiento, accesibilidad y cabeceras de seguridad. Las extensiones HU-10/HU-12 no son parte obligatoria del MVP.

## 7. Organización, colaboración y enfoque SDD

El trabajo se organizó por responsabilidades funcionales, con **Spec-Driven Development (SDD)** entendido como desarrollo guiado por los contratos y criterios de `requirements.md` y `design.md`, seguido de implementación, pruebas y validación humana.

| Área | Ramas utilizadas | Contribución |
|---|---|---|
| Infraestructura / DevOps e integración | `feature/infra`, `feature/integration` | Configuración AWS y permisos IAM, empaquetado/despliegue manual, verificación de endpoints y evidencias. |
| Seguridad | `feature/security`, `feature/security-integration` | `withAuthz`, validación de principal JWT, scopes, RBAC, ownership/BOLA, tests negativos y modelo de amenazas. |
| Backend | `feature/backend` | Handlers de proyectos/donaciones, estados de negocio, DynamoDB y transacciones. |
| Frontend | `feature/frontend` | SPA React/Vite, Cognito PKCE, módulos de catálogo/gestión/donaciones, validación y tests UI. |
| Integración transversal | `feature/integration` | Merges/PR, resolución de conflictos, pruebas, build y conexión entre capas. |

Se emplearon ramas y pull requests para integrar cambios. Por ejemplo, el **[PR #4](https://github.com/DiegoLlerena13/AQP-SOLIDARIA/pull/4)** abordó la integración del módulo de autorización con Cognito y los handlers del backend. La coordinación entre áreas incluyó revisión de contratos, permisos, nombres de tablas, variables de entorno y pruebas de extremo a extremo.

El uso de asistentes de programación está documentado en [`AI_USAGE.md`](./AI_USAGE.md); los resultados sugeridos por IA están sujetos a revisión y pruebas humanas.

## 8. Modelo Zero Trust y amenazas STRIDE

Los controles principales se distribuyen por nivel:

1. **Identidad:** Cognito, PKCE, access token JWT y MFA TOTP.
2. **Punto de aplicación de políticas:** API Gateway JWT authorizer y scopes.
3. **Autorización de negocio:** módulo `authz`, validaciones `token_use`, `iss`, `client_id`, `cognito:groups`, ownership y control de stage.
4. **Persistencia:** validación en backend y condiciones/transacciones DynamoDB.
5. **Mínimo privilegio:** ejecución de cada Lambda con IAM acotado.
6. **Observabilidad:** CloudWatch Logs, pruebas y evidencias de operaciones/rechazos.

**Threat Dragon** incluye las categorías STRIDE: *Spoofing*, *Tampering*, *Repudiation*, *Information Disclosure*, *Denial of Service* y *Elevation of Privilege*. El análisis registró controles existentes y riesgos pendientes, principalmente trazabilidad y saturación de API. Ver [`docs/threat-model.md`](./docs/threat-model.md) y [`ThreatDragonModels/`](./ThreatDragonModels/).

## 9. Despliegue y operación

La demostración utiliza **S3 privado + CloudFront (OAC)** para React y **API Gateway + Lambda + DynamoDB** para la API, con Cognito como proveedor de identidad.

**Esquema de despliegue manual utilizado:**

1. Selección de región `us-east-2`, cuenta de uso académico y control preventivo del presupuesto.
2. Creación de tablas DynamoDB: `aqp-solidaria-projects`, `aqp-solidaria-donations`, `aqp-solidaria-idempotency`, `aqp-solidaria-audit`.
3. Definición de roles IAM y políticas restringidas por función/acción/recurso.
4. Compilación TypeScript, preparación de paquetes ZIP con dependencias de ejecución y carga de Lambdas; ajuste del handler y variables de entorno.
5. Asociación de rutas API Gateway a Lambdas; autorización JWT y scopes en rutas protegidas, CORS para los orígenes permitidos.
6. Configuración del User Pool Cognito, cliente SPA, grupos, scopes y MFA TOTP requerido.
7. Build del frontend con variables de producción, carga de `index.html` y `assets/` al **raíz del bucket S3 privado**, CloudFront con OAC y prueba de HTTPS/callback.
8. Pruebas funcionales y negativas, revisión de logs y evidencia en el repositorio.

> **No afirmar despliegue automático desde SAM:** `sam validate` y `sam build` se ejecutaron localmente, pero el despliegue de CloudFormation estuvo restringido por políticas de la cuenta. La documentación de lo implementado manualmente debe mantenerse sincronizada con la plantilla y la configuración real.

**Costos y limpieza:** AWS Budgets permite recibir alertas, pero **no constituye un límite rígido de gasto**. Tras la evaluación, retirar distribuciones/recursos que ya no se necesiten, vaciar el bucket antes de borrarlo, eliminar Lambdas, rutas/API, tablas, logs, grupos/usuarios de prueba y recursos asociados conforme a las instrucciones de AWS. Si en el futuro se despliega una pila SAM válida, `sam delete` elimina los recursos administrados por esa pila, **no** todos los creados manualmente.

## 10. Limitaciones y documentación

Este prototipo **no es una plataforma de pagos real ni una certificación integral de seguridad**. Quedan pendientes las evidencias de algunos criterios del MVP, principalmente auditoría persistente y pruebas de idempotencia/concurrencia. También se requiere finalizar README/CI y correspondencia exacta entre SAM y los recursos manuales antes de declarar reproducibilidad completa.

Documentos de consulta:

- [`requirements.md`](./requirements.md): historias HU, criterios CA y pruebas T01–T14.
- [`design.md`](./design.md): decisiones AD-01 a AD-08, módulos, rutas, modelo de datos y NIST.
- [`docs/threat-model.md`](./docs/threat-model.md): análisis de amenazas.
- [`evidence/`](./evidence/): capturas sanitizadas, salidas de pruebas y verificaciones.
- [`AI_USAGE.md`](./AI_USAGE.md): registro de uso de asistentes y validación humana.

## 11. Referencias

- [NIST SP 800-207 — Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final)
- [OWASP API Security Top 10](https://owasp.org/API-Security/)
- [OWASP Threat Dragon](https://www.threatdragon.com/)
- [AWS API Gateway — JWT Authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- [Amazon Cognito — Token Revocation](https://docs.aws.amazon.com/cognito/latest/developerguide/token-revocation.html)
- [AWS SAM](https://docs.aws.amazon.com/serverless-application-model/)

---

**AQP-SOLIDARIA — UNSA / TAIS (2026).** Plataforma académica con donaciones simuladas, sin procesamiento de pagos reales.
