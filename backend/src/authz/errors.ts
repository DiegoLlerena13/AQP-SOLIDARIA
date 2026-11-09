/**
 * @file errors.ts
 * @description Clases de error de autorizacin y formateador de respuesta uniforme.
 * Implementa el formato uniforme de respuesta { code, message, requestId }
 * estipulado en design.md 4 sin exponer detalles internos ni informacin sensible.
 */

export type AuthzErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INTERNAL_SERVER_ERROR';

export interface UniformErrorBody {
  code: string;
  message: string;
  requestId: string;
}

export interface UniformResponse {
  statusCode: number;
  headers: {
    'Content-Type': string;
    [header: string]: string;
  };
  body: string;
}

/**
 * Error de autorizacin/autenticacin que encapsula el cdigo HTTP y cdigo de error de negocio.
 */
export class AuthzError extends Error {
  public readonly status: 401 | 403 | 404;
  public readonly code: AuthzErrorCode;

  constructor(status: 401 | 403 | 404, code: AuthzErrorCode, message: string) {
    super(message);
    this.name = 'AuthzError';
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, AuthzError.prototype);
  }
}

/**
 * Convierte un error en una respuesta HTTP uniforme para API Gateway.
 * Nunca expone la traza (stack), tokens, ni claims completos en la respuesta al cliente.
 *
 * @param error Error capturado durante la ejecucin
 * @param requestId Identificador de la peticin para trazabilidad
 * @returns Respuesta HTTP conforme al estndar del proyecto
 */
export function formatErrorResponse(
  error: unknown,
  requestId = 'unknown'
): UniformResponse {
  if (error instanceof AuthzError) {
    const errorBody: UniformErrorBody = {
      code: error.code,
      message: error.message,
      requestId
    };
    return {
      statusCode: error.status,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(errorBody)
    };
  }

  // Respuesta por defecto para fallos internos no controlados (Fail-closed)
  const defaultBody: UniformErrorBody = {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Error interno del servidor',
    requestId
  };
  return {
    statusCode: 500,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(defaultBody)
  };
}
