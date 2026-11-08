import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
  variant?: 'banner' | 'card' | 'inline';
  className?: string;
}

export const SimulationNotice: React.FC<Props> = ({ variant = 'banner', className = '' }) => {
  if (variant === 'inline') {
    return (
      <div
        role="alert"
        className={`flex items-center gap-2 p-2.5 text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-md ${className}`}
      >
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
        <span>
          <strong>Simulación académica:</strong> no se ha realizado ningún cobro ni transacción bancaria real.
        </span>
      </div>
    );
  }

  return (
    <aside
      aria-label="Aviso de simulación académica Zero Trust"
      className={`bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-sm px-4 py-2.5 text-xs sm:text-sm font-medium ${className}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1 bg-white/20 rounded-full shrink-0">
            <AlertTriangle className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <p className="leading-tight">
            <strong className="font-bold underline decoration-amber-200">Simulación académica:</strong>{' '}
            no se ha realizado ningún cobro real. Prototipo educativo bajo principios Zero Trust (NIST SP 800-207). Prohibido ingresar números de tarjeta o CVV.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-xs bg-black/20 px-2.5 py-1 rounded-full shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
          <span>Filtro Zero Trust Activo</span>
        </div>
      </div>
    </aside>
  );
};

