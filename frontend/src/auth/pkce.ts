/**
 * Utilidades para Authorization Code con PKCE (Proof Key for Code Exchange - RFC 7636).
 * Obligatorio por CA-03.1 y NIST SP 800-207.
 */

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function generateCodeVerifier(length = 64): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, (byte) => possible[byte % possible.length]).join('');
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(hash);
}

// Clave temporal únicamente para el verifier durante la redirección del navegador
const PKCE_VERIFIER_KEY = 'aqp_pkce_verifier_transient';

export function saveTransientVerifier(verifier: string): void {
  // Solo se almacena durante el salto HTTP hacia Cognito y se borra inmediatamente tras el intercambio
  window.sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
}

export function consumeTransientVerifier(): string | null {
  const verifier = window.sessionStorage.getItem(PKCE_VERIFIER_KEY);
  window.sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  return verifier;
}
