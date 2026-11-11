export type UserRole = 'VISITANTE' | 'DONANTE' | 'GESTOR' | 'AUDITOR';

export interface AuthTokens {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp in ms
}

export interface AuthUser {
  sub: string;
  email: string;
  roles: UserRole[];
  currentRole: UserRole;
}

