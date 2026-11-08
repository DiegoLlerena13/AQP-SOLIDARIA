import { describe, it, expect, beforeEach } from 'vitest';
import { tokenStorage } from '../auth/tokenStorage';
import { AuthTokens, AuthUser } from '../types/auth';

describe('tokenStorage - Seguridad Zero Trust en Navegador (CA-NF11.1)', () => {
  beforeEach(() => {
    tokenStorage.clear();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('debe mantener los tokens estrictamente en memoria y nunca escribirlos en localStorage (CA-NF11.1)', () => {
    const mockTokens: AuthTokens = {
      accessToken: 'access-token-zero-trust-sample',
      idToken: 'id-token-sample',
      refreshToken: 'refresh-token-sample',
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutos (CA-03.3)
    };

    const mockUser: AuthUser = {
      sub: 'user-sub-abc-123',
      email: 'donante@epis.unsa.edu.pe',
      roles: ['DONANTE'],
      currentRole: 'DONANTE',
    };

    tokenStorage.setAuth(mockTokens, mockUser);

    // 1. Debe estar disponible en memoria
    expect(tokenStorage.getAccessToken()).toBe('access-token-zero-trust-sample');
    expect(tokenStorage.getUser()?.sub).toBe('user-sub-abc-123');
    expect(tokenStorage.isAuthenticated()).toBe(true);

    // 2. Comprobación crítica: NADA en localStorage ni sessionStorage
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('jwt')).toBeNull();
    expect(localStorage.getItem('auth')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();

    // Verificación automatizada
    expect(tokenStorage.assertNoTokensInPersistentStorage()).toBe(true);
  });

  it('debe limpiar los tokens de memoria al invocar clear() (CA-03.3)', () => {
    const mockTokens: AuthTokens = {
      accessToken: 'temp-token',
      expiresAt: Date.now() + 60000,
    };
    const mockUser: AuthUser = {
      sub: 'user-sub',
      email: 'user@test.pe',
      roles: ['DONANTE'],
      currentRole: 'DONANTE',
    };

    tokenStorage.setAuth(mockTokens, mockUser);
    expect(tokenStorage.isAuthenticated()).toBe(true);

    tokenStorage.clear();

    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getUser()).toBeNull();
    expect(tokenStorage.isAuthenticated()).toBe(false);
  });

  it('debe invalidar el token cuando ha superado su tiempo de vida (expiresAt) (CA-03.3)', () => {
    const expiredTokens: AuthTokens = {
      accessToken: 'expired-token',
      expiresAt: Date.now() - 1000, // Expirado hace 1 segundo
    };
    const mockUser: AuthUser = {
      sub: 'user-sub',
      email: 'user@test.pe',
      roles: ['DONANTE'],
      currentRole: 'DONANTE',
    };

    tokenStorage.setAuth(expiredTokens, mockUser);

    expect(tokenStorage.isExpired()).toBe(true);
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.isAuthenticated()).toBe(false);
  });
});

