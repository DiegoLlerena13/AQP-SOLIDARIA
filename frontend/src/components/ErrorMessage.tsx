import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ApiError } from '../types/api';

interface Props {
  error: Error | ApiError | null | unknown;
  onRetry?: () => void;
  className?: string;
}

export const ErrorMessage: React.FC<Props> = ({ error, onRetry, className = '' }) => {
  if (!error) return null;

  const isApiError = error instanceof ApiError;
  const status = isApiError ? error.status : null;
  const code = isApiError ? error.code : 'CLIENT_ERROR';
  const requestId = isApiError ? error.requestId : null;
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div
      role="alert"
      className={`p-4 rounded-xl border border-rose-200 bg-rose-50/80 text-rose-900 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-rose-800">
              {status ? `Error HTTP ${status} (${code})` : `Error: ${code}`}
            </span>
            {requestId && (
              <span className="text-xs bg-rose-200/70 text-rose-800 font-mono px-2 py-0.5 rounded">
                Ref: {requestId}
              </span>
            )}
          </div>
          <p className="text-sm text-rose-700">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Reintentar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

