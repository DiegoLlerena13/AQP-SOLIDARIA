"use strict";
/**
 * @file errors.ts
 * @description Clases de error de autorizacin y formateador de respuesta uniforme.
 * Implementa el formato uniforme de respuesta { code, message, requestId }
 * estipulado en design.md 4 sin exponer detalles internos ni informacin sensible.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthzError = void 0;
exports.formatErrorResponse = formatErrorResponse;
/**
 * Error de autorizacin/autenticacin que encapsula el cdigo HTTP y cdigo de error de negocio.
 */
class AuthzError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message);
        this.name = 'AuthzError';
        this.status = status;
        this.code = code;
        Object.setPrototypeOf(this, AuthzError.prototype);
    }
}
exports.AuthzError = AuthzError;
/**
 * Convierte un error en una respuesta HTTP uniforme para API Gateway.
 * Nunca expone la traza (stack), tokens, ni claims completos en la respuesta al cliente.
 *
 * @param error Error capturado durante la ejecucin
 * @param requestId Identificador de la peticin para trazabilidad
 * @returns Respuesta HTTP conforme al estndar del proyecto
 */
function formatErrorResponse(error, requestId = 'unknown') {
    if (error instanceof AuthzError) {
        const errorBody = {
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
    const defaultBody = {
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
