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
| **Tareas Asistidas** | Scaffolding de la SPA en React 19 + TypeScript + Vite, configuración de Tailwind CSS v4 (sin Bootstrap), implementación de autenticación OIDC con Amazon Cognito (Authorization Code + PKCE), arquitectura de tokens en memoria (Zero Trust / CA-NF11.1), capa de mocks controlados y suite de pruebas unitarias y de seguridad (Vitest). |
| **Aportes IA** | - Generación de la estructura del proyecto y tipos compartidos en `frontend/src/types/`.<br>- Implementación de `tokenStorage.ts` garantizando que los tokens nunca se almacenen en `localStorage` ni `sessionStorage`.<br>- Implementación de `pkce.ts` mediante Web Crypto API (`crypto.subtle`) para SHA-256 (`S256`).<br>- Diseño responsivo adaptado a móviles de 375 px y criterios WCAG 2.2 AA (foco visible, semántica ARIA, estados vacíos).<br>- Implementación del aviso obligatorio: *«Simulación académica: no se ha realizado ningún cobro»* y componentes de error con `requestId`.<br>- Configuración de 21 pruebas automatizadas (unitarias, integración y negativas T01–T12) y flujo de GitHub Actions en CI. |
| **Validación Humana** | - Verificación estricta de que el formulario de donación no solicite números de tarjeta, CVV ni credenciales bancarias (CA-05.5).<br>- Comprobación de que los montos se representen en céntimos enteros de PEN (entre 100 y 100,000 céntimos) y se genere `Idempotency-Key` UUID único por envío.<br>- Inspección del almacenamiento del navegador para asegurar la ausencia total de tokens persistidos tras el inicio y cierre de sesión.<br>- Ejecución y aprobación de los 21 tests en Vitest y validación del build de producción sin advertencias. |
| **Limitaciones Detectadas y Mitigadas** | - **Intercambio PKCE local:** En fase previa al despliegue de AWS Cognito, la UI dependía de credenciales reales; se implementó el adaptador de mocks controlados (`mockAdapter.ts`) con selector de roles para permitir pruebas exhaustivas de la matriz de permisos.<br>- **HTML5 Form Validation en JSDOM:** Se ajustó la validación en `DonationModal.tsx` con `noValidate` para permitir que los mensajes accesibles personalizados de la aplicación gestionen y expongan los errores de validación sin ser bloqueados por el motor nativo del navegador. |

---

*Nota: Las secciones correspondientes a Infraestructura (Integrante 1), Seguridad (Integrante 2) y Backend (Integrante 3) serán incorporadas en sus respectivos Pull Requests.*
