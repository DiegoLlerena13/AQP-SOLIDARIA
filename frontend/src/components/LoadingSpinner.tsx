import React from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  message?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<Props> = ({
  message = 'Cargando información segura...',
  className = '',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-8 gap-3 text-slate-500 ${className}`}
    >
      <Loader2 className="w-8 h-8 text-rose-600 animate-spin" aria-hidden="true" />
      <span className="text-sm font-medium">{message}</span>
      <span className="sr-only">Cargando</span>
    </div>
  );
};

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-slate-200/80 rounded-lg ${className}`}
    />
  );
};
