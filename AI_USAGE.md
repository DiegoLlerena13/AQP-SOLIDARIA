# Declaración de Uso de Asistentes y Agentes de Código (AI_USAGE.md)

**Curso:** Tópicos Avanzados en Ingeniería de Software — EPIS, UNSA  
**Versión:** 2.0 | **Laboratorio:** LAB4 (TAIS 2026)  
**Caso:** Fundación peruana ficticia «Fundación AQP-SOLIDARIA»  
**Trazabilidad:** [requirements.md](./requirements.md) §7 y [design.md](./design.md) §10  

Conforme a la política académica establecida en el diseño técnico, se declara formalmente el uso de herramientas de asistencia basada en IA para la planificación, desarrollo y verificación del proyecto:

---

## Registro de Uso de IA por Integrante y Módulo

### Integrante 4 — Interfaz Web y Experiencia de Usuario (Frontend)

| Campo | Contenido Declarado |
|---|---|
| **Herramienta / Modelo** | Google Antigravity / Gemini 3.8 Flash (High) |
| **Participante** | Integrante 4 (Frontend Developer) |
| **Tareas Asistidas** | Scaffolding de la SPA en React 19 + TypeScript + Vite, configuración de Tailwind CSS v4 (sin Bootstrap), implementación de autenticación OIDC con Amazon Cognito (Authorization Code + PKCE), arquitectura de tokens en memoria (Zero Trust / CA-NF11.1), capa de mocks controlados, conexión real con infraestructura AWS desplegada (API Gateway y Cognito en us-east-2 Ohio), y suite de pruebas unitarias y de seguridad (Vitest). |
| **Aportes IA** | - Generación de la estructura del proyecto y tipos compartidos en `frontend/src/types/`.<br>- Implementación de `tokenStorage.ts` garantizando que los tokens nunca se almacenen en `localStorage` ni `sessionStorage`.<br>- Implementación de `pkce.ts` mediante Web Crypto API (`crypto.subtle`) para SHA-256 (`S256`).<br>- Diseño responsivo adaptado a móviles de 375 px y criterios WCAG 2.2 AA (foco visible, semántica ARIA, estados vacíos).<br>- Implementación del aviso obligatorio: *«Simulación académica: no se ha realizado ningún cobro»* y componentes de error con `requestId`.<br>- Configuración de 21 pruebas automatizadas (unitarias, integración y negativas T01–T12) y flujo de GitHub Actions en CI.<br>- Integración con infraestructura AWS en `us-east-2`: configuración de endpoints reales de API Gateway (`GET /health`, `GET /v1/projects`) y User Pool Cognito con dominio Hosted UI, conservando el modo simulado para desarrollo local y ejecución de tests. |
| **Validación Humana** | - Verificación estricta de que el formulario de donación no solicite números de tarjeta, CVV ni credenciales bancarias (CA-05.5).<br>- Comprobación de que los montos se representen en céntimos enteros de PEN (entre 100 y 100,000 céntimos) y se genere `Idempotency-Key` UUID único por envío.<br>- Inspección del almacenamiento del navegador para asegurar la ausencia total de tokens persistidos tras el inicio y cierre de sesión.<br>- Verificación de endpoints en vivo en AWS: `GET /health` (200 OK) y `GET /v1/projects` (200 OK con array vacío conectado a DynamoDB).<br>- Ejecución y aprobación de los 21 tests en Vitest y validación del build de producción sin advertencias. |
| **Limitaciones Detectadas y Mitigadas** | - **Intercambio PKCE local y aislamiento de pruebas:** Se aisló el entorno de pruebas (`import.meta.env.MODE === 'test'`) en el cliente API para garantizar que las 21 pruebas se ejecuten de forma determinista y hermética contra los mocks sin depender de conectividad a la nube, mientras que la SPA en ejecución se conecta a AWS real o mock según `VITE_USE_MOCK`.<br>- **Rutas protegidas no desplegadas aún:** Conforme a la directiva del líder, no se inventaron respuestas para rutas protegidas no desplegadas; solo los endpoints públicos desplegados (`/health`, `GET /v1/projects`) consumen AWS real.<br>- **HTML5 Form Validation en JSDOM:** Se ajustó la validación en `DonationModal.tsx` con `noValidate` para permitir que los mensajes accesibles personalizados de la aplicación gestionen y expongan los errores de validación sin ser bloqueados por el motor nativo del navegador. |

---

*Nota: Las secciones correspondientes a Infraestructura (Integrante 1), Seguridad (Integrante 2) y Backend (Integrante 3) serán incorporadas en sus respectivos Pull Requests.*
