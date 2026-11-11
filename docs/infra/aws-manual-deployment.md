# Despliegue manual y controles de seguridad AWS — AQP-SOLIDARIA

## 1. Objetivo

Documentar la implementación manual de la infraestructura de AQP-SOLIDARIA en Amazon Web Services, tomando como referencia `requirements.md` y `design.md`, bajo los principios de Zero Trust Architecture (NIST SP 800-207).

El sistema tiene fines académicos y permite gestionar proyectos sociales y donaciones simuladas, sin procesamiento de pagos reales.

## 2. Justificación del despliegue manual

Inicialmente se preparó la infraestructura mediante AWS SAM y CloudFormation. La plantilla superó las comprobaciones locales de validación y compilación.

Sin embargo, el despliegue automatizado fue rechazado mediante una denegación explícita de una Service Control Policy (SCP) para operaciones de CloudFormation.

Posteriormente se identificó que el entorno AWS Proof of Concept disponible estaba asignado a la región `us-east-2` (Ohio), mientras que la configuración inicial utilizaba `us-east-1`.

Con autorización del docente para utilizar la consola AWS, se inició el despliegue manual en `us-east-2`, manteniendo la plantilla SAM como referencia de infraestructura como código.

Esta implementación manual debe documentarse y reconciliarse posteriormente con la configuración versionada del repositorio.

## 3. Recursos implementados

### 3.1. Amazon DynamoDB

Se crearon cuatro tablas en la región `us-east-2`:

| Tabla | Clave principal | Finalidad |
|---|---|---|
| aqp-solidaria-projects | projectId | Proyectos sociales |
| aqp-solidaria-donations | donationId | Donaciones simuladas |
| aqp-solidaria-idempotency | pk | Control de solicitudes duplicadas |
| aqp-solidaria-audit | eventType + eventKey | Registro de eventos de auditoría |

Las tablas Projects y Donations disponen de un índice secundario global cada una.

Se debe verificar y conservar evidencia del nombre y estructura de los índices, la configuración TTL `expiresAt` de Idempotency y la protección contra eliminaciones.

### 3.2. AWS IAM

Se crearon los siguientes roles de ejecución:

| Rol | Responsabilidad |
|---|---|
| aqp-solidaria-health-role | Ejecución y registros de diagnóstico |
| aqp-solidaria-projects-read-role | Consulta de proyectos |
| aqp-solidaria-donations-create-role | Operaciones de registro de donaciones |

Los roles utilizan `AWSLambdaBasicExecutionRole` para emitir registros a CloudWatch.

El rol de lectura de proyectos tiene una política específica que autoriza `dynamodb:GetItem` y `dynamodb:Query` sobre la tabla Projects y su índice en `us-east-2`.

Se dispone de una política inicial para registrar donaciones, pendiente de contrastar completamente con las operaciones del backend definitivo.

**Justificación:** separar los roles limita los permisos de cada función y contribuye al principio de mínimo privilegio.

### 3.3. AWS Lambda

Se desplegaron y probaron dos funciones:

**aqp-solidaria-health**

- Runtime: Node.js 22.x.
- Resultado: `statusCode: 200`.
- Finalidad: verificar el estado de la aplicación.

**aqp-solidaria-projects-list**

- Runtime: Node.js 22.x.
- Handler: `projects/list.handler`.
- Variable de entorno: `PROJECTS_TABLE=aqp-solidaria-projects`.
- Resultado: `statusCode: 200`, cuerpo `[]`.
- Finalidad: consultar el catálogo de proyectos publicados mediante DynamoDB.

La lista vacía corresponde al estado observado de la tabla sin proyectos publicados.

### 3.4. Amazon API Gateway

Se creó una API HTTP denominada `aqp-solidaria-api`, con la etapa `academic`.

**URL base:**

`https://r3hrmkrkkf.execute-api.us-east-2.amazonaws.com/academic`

Endpoints desplegados y probados:

| Método y ruta | Autorización | Resultado |
|---|---|---|
| GET /health | Pública | 200, diagnóstico correcto |
| GET /v1/projects | Pública | 200, lista vacía |

Se configuró un autorizador JWT asociado a Amazon Cognito, preparado para utilizarse en rutas protegidas.

El funcionamiento de las rutas protegidas todavía requiere pruebas reales con tokens válidos e inválidos.

### 3.5. Amazon Cognito

Se creó un directorio de usuarios en `us-east-2`.

- User Pool ID: `us-east-2_DH2KMafTU`.
- App Client ID: `7ft2f51iags0qnirve0vocq5s9`.
- Grupos: DONANTE, GESTOR y AUDITOR.
- Servidor de recursos: `api`.
- Scopes: `projects.write`, `donations.write`, `donations.read`, `audit.read`.

La arquitectura contempla Authorization Code con PKCE y autenticación multifactor TOTP para cuentas privilegiadas.

La configuración efectiva de MFA obligatorio para GESTOR y AUDITOR, la duración del token y la emisión controlada de scopes deben verificarse mediante pruebas.

### 3.6. Amazon CloudWatch

Se configuraron grupos de registros para las funciones Health y Projects.

Se estableció una retención de **14 días**, evitando la conservación indefinida de registros y permitiendo consultar las ejecuciones de las funciones.

### 3.7. CORS

Se configuró API Gateway con:

- Origen permitido: `http://localhost:5173`.
- Métodos: GET, POST, PATCH, OPTIONS.
- Encabezados: `authorization`, `content-type`, `x-idempotency-key`.
- Credenciales CORS: deshabilitadas.
- Max-Age: 300 segundos.

Esta configuración permite el desarrollo del frontend React desde el origen local autorizado. CORS no sustituye la autenticación ni los controles de autorización.

### 3.8. Control de costos

Se creó un presupuesto mensual AWS de **US$5** para monitorear el consumo de recursos del proyecto.

El presupuesto es un mecanismo de alerta y no constituye un límite automático de gasto.

## 4. Validación y evidencias

| Verificación | Resultado observado |
|---|---|
| AWS SAM validate | Correcto en la configuración inicial |
| AWS SAM build | Correcto en la configuración inicial |
| GitHub Actions | Tres ejecuciones exitosas de infraestructura |
| TypeScript build | Correcto |
| TypeScript typecheck | Correcto |
| Pruebas unitarias de autorización | 61 pruebas aprobadas en 6 archivos |
| Lambda