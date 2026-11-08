import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { ShieldCheck } from 'lucide-react';

export const AuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { handleAuthCallback } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const oauthError = searchParams.get('error_description') || searchParams.get('error');

    if (oauthError) {
      setError(`Error recibido de Cognito: ${oauthError}`);
      return;
    }

    if (!code) {
      setError('No se recibió el código de autorización en la respuesta de Cognito.');
      return;
    }

    let isMounted = true;

    async function processCode() {
      try {
        const success = await handleAuthCallback(code!);
        if (isMounted) {
          if (success) {
            navigate('/', { replace: true });
          } else {
            setError('Fallo al validar las credenciales OIDC con el servidor.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    processCode();

    return () => {
      isMounted = false;
    };
  }, [searchParams, handleAuthCallback, navigate]);

  return (
    <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
      <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
        <ShieldCheck className="w-8 h-8" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-bold text-slate-900">
        Verificando Identidad Zero Trust
      </h1>

      {error ? (
        <div className="space-y-4">
          <ErrorMessage error={new Error(error)} />
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl"
          >
            Volver a inicio de sesión
          </button>
        </div>
      ) : (
        <LoadingSpinner message="Intercambiando código con Cognito PKCE (tokens en memoria)..." />
      )}
    </div>
  );
};
