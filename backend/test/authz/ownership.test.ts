import { describe, it, expect } from 'vitest';
import { assertOwner, AuthzError, type Principal } from '../../src/authz/index.js';

describe('ownership.ts - Verificación de propiedad (BOLA mitigation)', () => {
  const donanteVictima: Principal = {
    sub: 'sub-victima-alice',
    groups: ['DONANTE'],
    scopes: ['api/donations.write'],
    requestId: 'req-alice'
  };

  const donanteAtacante: Principal = {
    sub: 'sub-atacante-bob',
    groups: ['DONANTE'],
    scopes: ['api/donations.write'],
    requestId: 'req-bob'
  };

  const donacionDeAlice = {
    donationId: 'don-111-alice',
    projectId: 'proj-123',
    donorSub: 'sub-victima-alice',
    amountCents: 5000,
    status: 'PENDIENTE_SIMULACION'
  };

  it('[T09][CA-07.2] donante B intenta acceder a donación de donante A -> 404 NOT_FOUND (no 403) sin filtrar datos', () => {
    expect(() => assertOwner(donanteAtacante, donacionDeAlice)).toThrow(AuthzError);

    try {
      assertOwner(donanteAtacante, donacionDeAlice);
    } catch (err: any) {
      // Debe responder 404 para no revelar existencia del ID
      expect(err.status).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('Recurso no encontrado');
    }
  });

  it('lanza 404 si el recurso no existe (null o undefined)', () => {
    expect(() => assertOwner(donanteVictima, null)).toThrow(AuthzError);
    expect(() => assertOwner(donanteVictima, undefined)).toThrow(AuthzError);

    try {
      assertOwner(donanteVictima, null);
    } catch (err: any) {
      expect(err.status).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
    }
  });

  it('lanza 404 si el recurso no tiene atributo donorSub', () => {
    expect(() => assertOwner(donanteVictima, { donationId: 'don-orphan' })).toThrow(AuthzError);
  });

  it('Camino feliz: donante Alice accede a su propia donación exitosamente', () => {
    expect(() => assertOwner(donanteVictima, donacionDeAlice)).not.toThrow();
  });
});
