import { UserRole } from '../types/auth';

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  domain: string; // e.g. "https://aqp-solidaria.auth.us-east-1.amazoncognito.com"
  redirectUri: string;
  logoutUri: string;
  scopes: string[];
}

export const cognitoConfig: CognitoConfig = {
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
  domain: import.meta.env.VITE_COGNITO_DOMAIN || '',
  redirectUri:
    import.meta.env.VITE_COGNITO_REDIRECT_URI ||
    (typeof window !== 'undefined' ? `${window.location.origin}/callback` : 'http://localhost:5173/callback'),
  logoutUri:
    import.meta.env.VITE_COGNITO_LOGOUT_URI ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173/'),
  scopes: [
    'openid',
    'email',
    'api/projects.write',
    'api/donations.write',
    'api/donations.read',
    'api/audit.read',
  ],
};

export function isCognitoConfigured(): boolean {
  return (
    Boolean(cognitoConfig.clientId) &&
    Boolean(cognitoConfig.domain) &&
    cognitoConfig.domain.startsWith('http')
  );
}

/**
 * Decodifica las claims de un JWT (Access Token o ID Token) de forma segura.
 */
export function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error al decodificar JWT:', e);
    return null;
  }
}

/**
 * Extrae roles a partir del claim "cognito:groups"
 */
export function extractRolesFromToken(claims: Record<string, unknown> | null): UserRole[] {
  if (!claims) return ['VISITANTE'];
  const groups = (claims['cognito:groups'] || claims['groups']) as string[] | undefined;
  if (!Array.isArray(groups)) return ['DONANTE'];

  const roles: UserRole[] = [];
  if (groups.includes('GESTOR')) roles.push('GESTOR');
  if (groups.includes('AUDITOR')) roles.push('AUDITOR');
  if (groups.includes('DONANTE')) roles.push('DONANTE');

  return roles.length > 0 ? roles : ['DONANTE'];
}

