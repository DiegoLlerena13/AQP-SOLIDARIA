# Frontend — Plataforma de Donaciones Seguras AQP-SOLIDARIA

**Curso:** Tópicos Avanzados en Ingeniería de Software — EPIS, UNSA  
**Versión:** 2.0 | **Laboratorio:** LAB4 (TAIS)  
**Rol:** Integrante 4 (Frontend Developer)  
**Rama de desarrollo:** `caracteristica/frontend`  
**Modelo de Seguridad:** Zero Trust Architecture (NIST SP 800-207)  

---

## 1. Tecnologías Utilizadas

- **Framework:** React 19 + TypeScript + Vite 6
- **Estilos:** Tailwind CSS v4 (prohibido Bootstrap según `design.md` §2)
- **Gestión de Estado y Datos:** TanStack Query v5
- **Iconografía:** Lucide React
- **Autenticación OIDC:** Amazon Cognito con **Authorization Code + PKCE** (RFC 7636)
- **Almacenamiento de Tokens:** **Estrictamente en memoria** (`tokenStorage.ts`), sin persistencia en `localStorage` ni `sessionStorage` (CA-NF11.1).
- **Pruebas:** Vitest + React Testing Library + JSDOM

---

## 2. Historias de Usuario Implementadas

| Historia | Descripción | Criterios de Aceptación / Trazabilidad |
|---|---|---|
| **HU-01** | Catálogo de proyectos públicos | CA-01.1 (nombre, meta PEN, suma confirmada), CA-01.2 (excluye borradores), CA-01.3 (estado vacío) |
| **HU-02** | Detalle de proyecto y progreso | CA-02.1 (meta, progreso sin datos personales), CA-02.2 (404 a no publicados/inexistentes) |
| **HU-03** | Autenticación Zero Trust | CA-03.1 (Cognito Auth Code + PKCE), CA-03.3 (tokens ≤ 15 min, revocación al logout) |
| **HU-04** | Matriz de roles y permisos | CA-04.1 (Donante no gestiona), CA-04.2 (Gestor no ve donaciones privadas), CA-04.3 (claims verificados) |
| **HU-05** | Intención de donación simulada | CA-05.1 (monto en céntimos PEN, UUID `Idempotency-Key`), CA-05.2 (validación 100-100000 céntimos), CA-05.5 (sin tarjetas ni datos bancarios) |
| **HU-06** | Simulación de confirmación | CA-06.1 (stage académico), CA-06.2 (incremento atómico), CA-06.3 (rechazo no suma), CA-06.4 (aviso destacado) |
| **HU-07** | Historial de donaciones propias | CA-07.1 (solo registros del `sub` autenticado), CA-07.2 (BOLA mitigado) |
| **HU-08** | Gestión de proyectos (GESTOR) | CA-08.1 (crear en BORRADOR), CA-08.2 (publicar a PUBLICADO), CA-08.3 (auditoría) |
| **HU-09** | Indicadores agregados | CA-09.1 (suma excluye pendientes y rechazadas), CA-09.2 (sin datos personales) |
| **HU-10** | Auditoría y trazabilidad | CA-10.1 (solo AUDITOR), CA-10.2 (eventos sin secretos ni tokens) |
| **RNF-HU-06** | Accesibilidad y usabilidad | CA-NF06.1 (adaptado a 375 px), CA-NF06.2 (foco visible, semántica ARIA, WCAG 2.2 AA) |
| **RNF-HU-11** | Seguridad en navegador | CA-NF11.1 (tokens en memoria, mitigación XSS) |

---

## 3. Endpoints Consumidos (design.md §4)

| Método | Endpoint | Scope / Rol Requerido | Descripción |
|---|---|---|---|
| `GET` | `/v1/projects` | Público | Lista de proyectos publicados |
| `GET` | `/v1/projects/{projectId}` | Público | Detalle de un proyecto publicado |
| `GET` | `/v1/projects/{projectId}/stats` | Público | Estadísticas de recaudación |
| `POST` | `/v1/projects` | `api/projects.write` + GESTOR | Crear proyecto (inicia en BORRADOR) |
| `PATCH` | `/v1/projects/{projectId}/publish` | `api/projects.write` + GESTOR | Publicar proyecto borrador |
| `POST` | `/v1/donations` | `api/donations.write` + DONANTE | Registrar intención (con `Idempotency-Key`) |
| `POST` | `/v1/donations/{id}/simulate` | `api/donations.write` + DONANTE | Simular confirmación/rechazo (stage académico) |
| `GET` | `/v1/donations/me` | `api/donations.read` + DONANTE | Historial de donaciones del usuario |
| `GET` | `/v1/audit` | `api/audit.read` + AUDITOR | Bitácora de eventos de seguridad |

---

## 4. Capa de Mocks Controlados y Conexión con Backend Real

Para permitir el desarrollo y evaluación paralela mientras el Integrante 1 (Infraestructura) y el Integrante 3 (Backend) despliegan la API en AWS API Gateway, el frontend cuenta con un adaptador de mocks controlados (`mockAdapter.ts`).

- **Modo Mock (desarrollo local / evaluación docente):**
  - Configurado por defecto (`VITE_USE_MOCK=true`).
  - Mantiene estado en memoria emulando DynamoDB, idempotencia atómica y validaciones de rol.
  - Permite intercambiar roles con un clic en la barra de navegación: `VISITANTE`, `DONANTE`, `GESTOR`, `AUDITOR`.
- **Conexión al Backend Real en AWS:**
  - En `.env`:
    ```bash
    VITE_USE_MOCK=false
    VITE_API_BASE_URL=https://{api-id}.execute-api.us-east-1.amazonaws.com/academic
    VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
    VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
    VITE_COGNITO_DOMAIN=https://aqp-solidaria-users.auth.us-east-1.amazoncognito.com
    VITE_COGNITO_REDIRECT_URI=http://localhost:5173/callback
    ```

---

## 5. Instrucciones de Ejecución

```bash
# 1. Instalar dependencias
cd frontend
pnpm install

# 2. Ejecutar suite de pruebas automáticas (Vitest)
pnpm test

# 3. Compilar la aplicación (TypeScript typecheck + Vite build)
pnpm run build

# 4. Iniciar servidor de desarrollo local
pnpm run dev
```

