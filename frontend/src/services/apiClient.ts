import { ApiError, ApiErrorResponse } from '../types/api';
import { tokenStorage } from '../auth/tokenStorage';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const USE_MOCK =
  import.meta.env.MODE === 'test' ||
  import.meta.env.VITE_USE_MOCK === 'true' ||
  import.meta.env.VITE_USE_MOCK === undefined ||
  !BASE_URL;

export function isUsingMock(): boolean {
  return USE_MOCK;
}

interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
}

export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Token en memoria (CA-NF11.1)
  const token = tokenStorage.getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Cabecera Idempotency-Key
  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: ApiErrorResponse;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        code: `HTTP_${response.status}`,
        message: response.statusText || 'Error en la solicitud al servidor',
        requestId: response.headers.get('x-amzn-requestid') || 'req-unknown',
      };
    }
    throw new ApiError(response.status, errorData);
  }

  // Si la respuesta no tiene cuerpo (ej. 204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

