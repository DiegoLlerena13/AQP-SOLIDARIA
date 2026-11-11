import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENDPOINT_POLICIES, matchesPath } from '../../src/authz/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TemplateHttpApiEvent {
  eventName: string;
  path: string;
  method: string;
}

interface KnownMismatch {
  templateMethod: string;
  templatePath: string;
  expectedPolicyMethod: string;
  expectedPolicyPath: string;
  reason: string;
}

/**
 * Lista de discrepancias conocidas entre infra/template.yaml y design.md §4 / ENDPOINT_POLICIES.
 *
 * TODO: Cuando el Integrante 1 (DevOps) corrija infra/template.yaml cambiando el método de
 * PublishProject de POST a PATCH (conforme a design.md §4 y ENDPOINT_POLICIES), esta entrada
 * DEBE ser removida de esta lista. Esta prueba fallará intencionalmente si template.yaml ya usa PATCH
 * o si se introduce cualquier otra discrepancia no documentada.
 */
const KNOWN_MISMATCHES: KnownMismatch[] = [
  {
    templateMethod: 'POST',
    templatePath: '/v1/projects/{projectId}/publish',
    expectedPolicyMethod: 'PATCH',
    expectedPolicyPath: '/v1/projects/{projectId}/publish',
    reason: 'design.md §4 exige PATCH /v1/projects/{projectId}/publish, pero template.yaml define POST'
  }
];

/**
 * Extrae eventos HttpApi de infra/template.yaml sin requerir dependencias externas de parsing YAML.
 */
function extractHttpApiEventsFromTemplate(templatePath: string): TemplateHttpApiEvent[] {
  const content = readFileSync(templatePath, 'utf-8');
  const eventRegex =
    /Events:\s*\r?\n\s*(\w+):\s*\r?\n\s*Type:\s*HttpApi\s*\r?\n\s*Properties:[\s\S]*?Path:\s*(\S+)\s*\r?\n\s*Method:\s*(\S+)/g;

  const events: TemplateHttpApiEvent[] = [];
  let match: RegExpExecArray | null;

  while ((match = eventRegex.exec(content)) !== null) {
    events.push({
      eventName: match[1],
      path: match[2],
      method: match[3].toUpperCase()
    });
  }

  return events;
}

describe('Prueba de contrato: infra/template.yaml vs ENDPOINT_POLICIES', () => {
  const templatePath = resolve(__dirname, '../../../infra/template.yaml');

  it('el archivo infra/template.yaml debe existir en el repositorio', () => {
    expect(existsSync(templatePath)).toBe(true);
  });

  it('extrae correctamente los eventos HttpApi del template SAM', () => {
    const events = extractHttpApiEventsFromTemplate(templatePath);
    expect(events.length).toBeGreaterThanOrEqual(7);

    const eventNames = events.map(e => e.eventName);
    expect(eventNames).toContain('HealthEndpoint');
    expect(eventNames).toContain('ListProjects');
    expect(eventNames).toContain('CreateDonation');
    expect(eventNames).toContain('SimulateDonation');
    expect(eventNames).toContain('GetMyDonations');
    expect(eventNames).toContain('CreateProject');
    expect(eventNames).toContain('PublishProject');
  });

  it('cada ruta de negocio /v1/* de template.yaml debe coincidir con ENDPOINT_POLICIES o figurar en KNOWN_MISMATCHES', () => {
    const events = extractHttpApiEventsFromTemplate(templatePath);
    const businessEvents = events.filter(e => e.path.startsWith('/v1'));

    for (const event of businessEvents) {
      // 1. Verificar si coincide con una discrepancia conocida
      const knownMismatch = KNOWN_MISMATCHES.find(
        m => m.templateMethod === event.method && m.templatePath === event.path
      );

      if (knownMismatch) {
        // Validar que en ENDPOINT_POLICIES sí existe con el método y ruta esperados por design.md
        const policy = ENDPOINT_POLICIES.find(
          p =>
            p.method === knownMismatch.expectedPolicyMethod &&
            matchesPath(p.pathPattern, knownMismatch.expectedPolicyPath)
        );
        expect(
          policy,
          `La discrepancia conocida ${knownMismatch.templateMethod} ${knownMismatch.templatePath} debe estar cubierta por la política esperada ${knownMismatch.expectedPolicyMethod} ${knownMismatch.expectedPolicyPath}`
        ).toBeDefined();
      } else {
        // 2. Si no es una discrepancia conocida, DEBE existir exactamente en ENDPOINT_POLICIES
        const policy = ENDPOINT_POLICIES.find(
          p => p.method === event.method && matchesPath(p.pathPattern, event.path)
        );

        expect(
          policy,
          `Discrepancia no autorizada detectada: el evento SAM '${event.eventName}' (${event.method} ${event.path}) no existe en ENDPOINT_POLICIES ni en KNOWN_MISMATCHES.`
        ).toBeDefined();
      }
    }
  });

  it('la lista KNOWN_MISMATCHES no debe tener entradas obsoletas (falla cuando se corrija template.yaml a PATCH)', () => {
    const events = extractHttpApiEventsFromTemplate(templatePath);

    for (const mismatch of KNOWN_MISMATCHES) {
      const stillPresentInTemplate = events.some(
        e => e.method === mismatch.templateMethod && e.path === mismatch.templatePath
      );

      expect(
        stillPresentInTemplate,
        `¡La discrepancia conocida '${mismatch.templateMethod} ${mismatch.templatePath}' ya no está presente en infra/template.yaml! Debe removerse de KNOWN_MISMATCHES en contract.test.ts.`
      ).toBe(true);
    }
  });
});
