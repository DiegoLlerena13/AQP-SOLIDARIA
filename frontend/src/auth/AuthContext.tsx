import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser, UserRole, AuthTokens } from '../types/auth';
import { tokenStorage } from './tokenStorage';
import {
  cognitoConfig,
  isCognitoConfigured,
  decodeJwtClaims,
  extractRolesFromToken,
} from './cognitoConfig';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  saveTransientVerifier,
  consumeTransientVerifier,
} from './pkce';

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithCognito: () => Promise<void>;
  handleAuthCallback: (code: string) => Promise<boolean>;
  loginAsMockUser: (mockRole: UserRole) => void;
  logout: () => void;
  isMockAuth: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(tokenStorage.getUser());
  const [isLoading, setIsLoading] = useState(false);
  const [isMockAuth, setIsMockAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = tokenStorage.subscribe((updatedUser) => {
      setUser(updatedUser);
    });
    return () => unsubscribe();
  }, []);

  const role: UserRole = user?.currentRole || 'VISITANTE';
  const isAuthenticated = tokenStorage.isAuthenticated();

  const loginWithCognito = async () => {
    if (!isCognitoConfigured()) {
      throw new Error(
        'Amazon Cognito no está configurado en las variables de entorno (.env). Usa el selector de roles de prueba para evaluar la SPA.'
      );
    }

    const verifier = generateCodeVerifier();
    saveTransientVerifier(verifier);
    const challenge = await generateCodeChallenge(verifier);

    const queryParams = new URLSearchParams({
      response_type: 'code',
      client_id: cognitoConfig.clientId,
      redirect_uri: cognitoConfig.redirectUri,
      scope: cognitoConfig.scopes.join(' '),
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    const loginUrl = `${cognitoConfig.domain}/oauth2/authorize?${queryParams.toString()}`;
    window.location.assign(loginUrl);
  };

  const handleAuthCallback = async (code: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const verifier = consumeTransientVerifier();
      if (!verifier) {
        throw new Error('No se encontró el code_verifier de PKCE en la sesión de redirección.');
      }

      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: cognitoConfig.clientId,
        code: code,
        redirect_uri: cognitoConfig.redirectUri,
        code_verifier: verifier,
      });

      const response = await fetch(`${cognitoConfig.domain}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || 'Fallo en intercambio de código por tokens');
      }

      const tokenData = await response.json();
      const accessToken = tokenData.access_token;
      const idToken = tokenData.id_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = (tokenData.expires_in || 900) * 1000;

      const claims = decodeJwtClaims(accessToken) || decodeJwtClaims(idToken) || {};
      const sub = (claims.sub as string) || `user-${Date.now()}`;
      const email = (claims.email as string) || 'usuario@aqp-solidaria.pe';
      const roles = extractRolesFromToken(claims);

      const tokens: AuthTokens = {
        accessToken,
        idToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn,
      };

      const authUser: AuthUser = {
        sub,
        email,
        roles,
        currentRole: roles[0] || 'DONANTE',
      };

      tokenStorage.setAuth(tokens, authUser);
      setIsMockAuth(false);
      return true;
    } catch (err) {
      console.error('Error durante intercambio PKCE:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsMockUser = (mockRole: UserRole) => {
    if (mockRole === 'VISITANTE') {
      tokenStorage.clear();
      setIsMockAuth(true);
      return;
    }

    const mockSub =
      mockRole === 'DONANTE'
        ? 'donor-sub-12345'
        : mockRole === 'GESTOR'
        ? 'gestor-sub-67890'
        : 'auditor-sub-54321';

    const mockEmail =
      mockRole === 'DONANTE'
        ? 'donante.ejemplo@epis.unsa.edu.pe'
        : mockRole === 'GESTOR'
        ? 'gestor.social@aqp-solidaria.org'
        : 'auditor.seguridad@unsa.edu.pe';

    // Token simulado con estructura válida JWT
    const mockToken = `mock-token-${mockRole.toLowerCase()}-${Date.now()}`;

    const tokens: AuthTokens = {
      accessToken: mockToken,
      idToken: `mock-id-token-${mockRole.toLowerCase()}`,
      refreshToken: `mock-refresh-token-${mockRole.toLowerCase()}`,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutos exactos según CA-03.3
    };

    const mockUser: AuthUser = {
      sub: mockSub,
      email: mockEmail,
      roles: [mockRole],
      currentRole: mockRole,
    };

    tokenStorage.setAuth(tokens, mockUser);
    setIsMockAuth(true);
  };

  const logout = () => {
    const refreshToken = tokenStorage.getRefreshToken();
    tokenStorage.clear();

    // Si se usó Cognito real, invocar revocación o redirección de logout
    if (!isMockAuth && isCognitoConfigured() && refreshToken) {
      try {
        const logoutUrl = `${cognitoConfig.domain}/logout?client_id=${cognitoConfig.clientId}&logout_uri=${encodeURIComponent(
          cognitoConfig.logoutUri
        )}`;
        window.location.assign(logoutUrl);
      } catch (e) {
        console.error('Error en redirección de logout Cognito:', e);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        isLoading,
        loginWithCognito,
        handleAuthCallback,
        loginAsMockUser,
        logout,
        isMockAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
