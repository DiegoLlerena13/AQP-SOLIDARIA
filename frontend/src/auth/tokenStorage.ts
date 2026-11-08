import { AuthTokens, AuthUser } from '../types/auth';

/**
 * Token Storage estrictamente en MEMORIA (Zero Trust / CA-NF11.1).
 * Nunca almacena tokens ni credenciales en localStorage ni sessionStorage
 * para mitigar riesgos de exfiltración por ataques XSS.
 */
let inMemoryTokens: AuthTokens | null = null;
let inMemoryUser: AuthUser | null = null;

// Event listener para notificar cambios de autenticación
type AuthChangeListener = (user: AuthUser | null) => void;
const listeners = new Set<AuthChangeListener>();

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener(inMemoryUser);
    } catch (e) {
      console.error('Error in auth change listener:', e);
    }
  }
}

export const tokenStorage = {
  getAccessToken(): string | null {
    if (!inMemoryTokens) return null;
    if (this.isExpired()) {
      this.clear();
      return null;
    }
    return inMemoryTokens.accessToken;
  },

  getIdToken(): string | null {
    if (!inMemoryTokens) return null;
    return inMemoryTokens.idToken || null;
  },

  getRefreshToken(): string | null {
    if (!inMemoryTokens) return null;
    return inMemoryTokens.refreshToken || null;
  },

  getUser(): AuthUser | null {
    return inMemoryUser;
  },

  setAuth(tokens: AuthTokens, user: AuthUser): void {
    inMemoryTokens = tokens;
    inMemoryUser = user;
    notifyListeners();
  },

  clear(): void {
    inMemoryTokens = null;
    inMemoryUser = null;
    notifyListeners();
  },

  isAuthenticated(): boolean {
    return inMemoryTokens !== null && !this.isExpired();
  },

  isExpired(): boolean {
    if (!inMemoryTokens) return true;
    return Date.now() >= inMemoryTokens.expiresAt;
  },

  subscribe(listener: AuthChangeListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Método de verificación de seguridad para pruebas:
   * Demuestra que no existen tokens en almacenamiento persistente del navegador.
   */
  assertNoTokensInPersistentStorage(): boolean {
    const dangerousKeys = [
      'token',
      'accessToken',
      'idToken',
      'refreshToken',
      'jwt',
      'cognito',
      'auth',
    ];
    for (const key of dangerousKeys) {
      if (typeof window !== 'undefined') {
        if (window.localStorage && window.localStorage.getItem(key)) return false;
        if (window.sessionStorage && window.sessionStorage.getItem(key)) return false;
      }
    }
    return true;
  },
};
