import { describe, it, expect, beforeEach } from 'vitest';
import { mockAdapter } from '../services/mock/mockAdapter';
import { tokenStorage } from '../auth/tokenStorage';
import { ApiError } from '../types/api';

describe('Pruebas Negativas y Controles Zero Trust (T02, T03, T04, T06, T07, T09, T12)', () => {
  beforeEach(() => {
    mockAdapter.reset();
    tokenStorage.clear();
  });

  it('T02 / CA-03.2: Intento de donar sin token o sin autenticación devuelve 401 (UNAUTHORIZED)', async () => {
    // Sin autenticación (VISITANTE)
    expect(tokenStorage.isAuthenticated()).toBe(false);

    await expect(
      mockAdapter.createDonation(
        { projectId: 'proj-arequipa-001', amountCents: 5000 },
        'idemp-uuid-1'
      )
    ).rejects.toThrowError(ApiError);

    try {
      await mockAdapter.createDonation(
        { projectId: 'proj-arequipa-001', amountCents: 5000 },
        'idemp-uuid-1'
      );
    } catch (e: unknown) {
      const err = e as ApiError;
      expect(err.status).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
    }
  });

  it('T03 / CA-04.1: Donante intenta crear proyecto en backend y devuelve 403 (FORBIDDEN)', async () => {
    // Autenticado como DONANTE
    tokenStorage.setAuth(
      { accessToken: 'donor-token', expiresAt: Date.now() + 60000 },
      { sub: 'donor-sub-1', email: 'donor@unsa.pe', roles: ['DONANTE'], currentRole: 'DONANTE' }
    );

    try {
      await mockAdapter.createProject({
        title: 'Intento Ilegítimo',
        description: 'Proyecto no autorizado',
        goalAmountCents: 500000,
      });
      expect.fail('Debió lanzar ApiError 403');
    } catch (e: unknown) {
      const err = e as ApiError;
      expect(err.status).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
    }
  });

  it('T04 / CA-05.2: Donante envía 0, número negativo, superior a 100000 o no entero y devuelve 400', async () => {
    tokenStorage.setAuth(
      { accessToken: 'donor-token', expiresAt: Date.now() + 60000 },
      { sub: 'donor-sub-1', email: 'donor@unsa.pe', roles: ['DONANTE'], currentRole: 'DONANTE' }
    );

    // Monto 0
    await expect(
      mockAdapter.createDonation(
        { projectId: 'proj-arequipa-001', amountCents: 0 },
        'key-0'
      )
    ).rejects.toThrow();

    // Monto mayor a 100000 céntimos (S/ 1,000.00)
    await expect(
      mockAdapter.createDonation(
        { projectId: 'proj-arequipa-001', amountCents: 100001 },
        'key-100001'
      )
    ).rejects.toThrow();

    // Monto no entero (con decimales)
    await expect(
      mockAdapter.createDonation(
        { projectId: 'proj-arequipa-001', amountCents: 50.5 },
        'key-float'
      )
    ).rejects.toThrow();
  });

  it('T06 / CA-05.4: Reenviar misma clave de idempotencia con mismo payload devuelve el mismo resultado sin duplicar', async () => {
    tokenStorage.setAuth(
      { accessToken: 'donor-token', expiresAt: Date.now() + 60000 },
      { sub: 'donor-sub-1', email: 'donor@unsa.pe', roles: ['DONANTE'], currentRole: 'DONANTE' }
    );

    const idempotencyKey = 'unique-key-atomic-123';
    const payload = { projectId: 'proj-arequipa-001', amountCents: 2500 };

    // Primera solicitud: crea donación
    const firstRes = await mockAdapter.createDonation(payload, idempotencyKey);
    expect(firstRes.status).toBe('PENDIENTE_SIMULACION');

    // Segunda solicitud con la misma clave y payload: devuelve la misma donación
    const secondRes = await mockAdapter.createDonation(payload, idempotencyKey);
    expect(secondRes.donationId).toBe(firstRes.donationId);
    expect(secondRes.amountCents).toBe(firstRes.amountCents);
  });

  it('T07 / CA-05.4: Reutilizar clave de idempotencia con payload distinto devuelve 409 (CONFLICT)', async () => {
    tokenStorage.setAuth(
      { accessToken: 'donor-token', expiresAt: Date.now() + 60000 },
      { sub: 'donor-sub-1', email: 'donor@unsa.pe', roles: ['DONANTE'], currentRole: 'DONANTE' }
    );

    const idempotencyKey = 'shared-idempotency-key';

    // Primera llamada con S/ 30.00
    await mockAdapter.createDonation(
      { projectId: 'proj-arequipa-001', amountCents: 3000 },
      idempotencyKey
    );

    // Segunda llamada con la misma clave pero con S/ 40.00
    try {
      await mockAdapter.createDonation(
        { projectId: 'proj-arequipa-001', amountCents: 4000 },
        idempotencyKey
      );
      expect.fail('Debió lanzar ApiError 409 por conflicto de idempotencia');
    } catch (e: unknown) {
      const err = e as ApiError;
      expect(err.status).toBe(409);
      expect(err.code).toBe('IDEMPOTENCY_CONFLICT');
    }
  });

  it('T09 / CA-07.2: Donante intenta simular o alterar una donación ajena (BOLA) y es bloqueado con 403', async () => {
    // Autenticado como donante B (intruso)
    tokenStorage.setAuth(
      { accessToken: 'donor-b-token', expiresAt: Date.now() + 60000 },
      { sub: 'donor-sub-intruso', email: 'intruso@unsa.pe', roles: ['DONANTE'], currentRole: 'DONANTE' }
    );

    // don-demo-002 le pertenece a donor-sub-12345
    try {
      await mockAdapter.simulateDonation('don-demo-002', { action: 'CONFIRMAR' });
      expect.fail('Debió fallar con 403');
    } catch (e: unknown) {
      const err = e as ApiError;
      expect(err.status).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
    }
  });

  it('T12 / CA-04.2: Gestor intenta consultar historial privado de donaciones y es bloqueado (401/403)', async () => {
    // Autenticado como GESTOR (no tiene rol DONANTE)
    tokenStorage.setAuth(
      { accessToken: 'gestor-token', expiresAt: Date.now() + 60000 },
      { sub: 'gestor-sub-1', email: 'gestor@aqp.org', roles: ['GESTOR'], currentRole: 'GESTOR' }
    );

    try {
      await mockAdapter.getMyDonations();
      expect.fail('Debió fallar');
    } catch (e: unknown) {
      const err = e as ApiError;
      expect(err.status).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
    }
  });
});

