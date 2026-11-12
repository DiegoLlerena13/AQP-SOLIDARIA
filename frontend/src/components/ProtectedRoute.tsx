import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { UserRole } from '../types/auth';
import { ShieldAlert } from 'lucide-react';

interface Props {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<Props> = ({ allowedRoles, children }) => {
  const { isAuthenticated, role, loginAsMockUser } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 text-center shadow-sm space-y-4">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          Control de Acceso Zero Trust (HTTP 403)
        </h2>
        <p className="text-sm text-slate-600">
          Tu rol actual es <strong className="text-slate-900">{role}</strong>. Esta sección requiere uno de los siguientes roles:{' '}
          <strong className="text-slate-900">{allowedRoles.join(', ')}</strong>.
        </p>
        <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
          En Zero Trust (NIST SP 800-207), la autorización se valida en cada recurso por el backend (Lambda / Cedar). El frontend refleja estos permisos para brindar una experiencia de usuario clara.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          {allowedRoles.map((r) => (
            <button
              key={r}
              onClick={() => loginAsMockUser(r)}
              className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl shadow hover:bg-rose-700 transition"
            >
              Cambiar a rol {r} para evaluar
            </button>
          ))}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

