import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { isCognitoConfigured } from '../auth/cognitoConfig';
import { isUsingMock } from '../services/apiClient';
import { UserRole } from '../types/auth';
import {
  Shield,
  KeyRound,
  Lock,
  CheckCircle2,
  Users,
  AlertTriangle,
  ArrowRight,
  Cloud,
  FlaskConical,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginWithCognito, loginAsMockUser, isLoading } = useAuth();
  const navigate = useNavigate();
  const [cognitoError, setCognitoError] = useState<string | null>(null);

  const cognitoReady = isCognitoConfigured();
  const mockMode = isUsingMock();

  const handleCognitoClick = async () => {
    setCognitoError(null);
    try {
      await loginWithCognito();
    } catch (err: unknown) {
      setCognitoError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleMockLogin = (role: UserRole) => {
    loginAsMockUser(role);
    if (role === 'GESTOR') {
      navigate('/gestion');
    } else if (role === 'AUDITOR') {
      navigate('/auditoria');
    } else {
      navigate('/mis-donaciones');
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8 animate-in fade-in duration-300">
      {/* Banner: modo AWS real vs. simulación */}
      {mockMode ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-medium">
          <FlaskConical className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
          <span>
            <strong>Modo Simulación Local (mocks)</strong> — Los datos son ficticios.
            Para conectar a AWS configura <code className="bg-amber-100 px-1 rounded">VITE_USE_MOCK=false</code> en tu <code className="bg-amber-100 px-1 rounded">.env</code>.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-medium">
          <Cloud className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>
            <strong>Conectado a AWS us-east-2 (Ohio)</strong> — API Gateway + Amazon Cognito activos.
          </span>
        </div>
      )}
      {/* Encabezado */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-bold">
          <Shield className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Autenticación OIDC • NIST SP 800-207</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900">
          Acceso Seguro AQP-SOLIDARIA
        </h1>
        <p className="text-slate-600 text-sm max-w-lg mx-auto">
          Inicio de sesión basado en Amazon Cognito con flujo{' '}
          <strong>Authorization Code + PKCE obligatorio</strong> (CA-03.1).
        </p>
      </div>

      {cognitoError && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong>Aviso de Configuración Cognito:</strong>
            <p className="mt-0.5">{cognitoError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Opción 1: Amazon Cognito Real (Managed Login / Hosted UI) */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
              <KeyRound className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Amazon Cognito (PKCE)
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Autenticación cloud contra User Pool con intercambio de código seguro y claves efímeras S256.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>Tokens estrictamente en memoria (CA-NF11.1)</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>Access token de vida corta ≤ 15 min (CA-03.3)</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>MFA TOTP para GESTOR y AUDITOR (CA-11.1)</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleCognitoClick}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold rounded-2xl text-xs shadow transition"
          >
            <Lock className="w-4 h-4" aria-hidden="true" />
            <span>
              {isLoading
                ? 'Conectando con Cognito...'
                : cognitoReady
                ? 'Iniciar con Cognito Hosted UI'
                : 'Iniciar con Cognito (Requiere .env)'}
            </span>
          </button>
        </div>

        {/* Opción 2: Selector de Roles de Evaluación (Stage Académico / TAIS LAB4) */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <Users className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Roles de Evaluación Docente
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Prueba instantánea de la matriz de permisos y Zero Trust (T01–T14) en local mientras se despliega la nube.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleMockLogin('DONANTE')}
                className="w-full p-3 text-left rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100/60 transition flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-bold text-rose-900">Rol DONANTE</div>
                  <div className="text-[11px] text-rose-700">
                    Aportes simulados, historial e idempotencia
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-rose-600 group-hover:translate-x-0.5 transition" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => handleMockLogin('GESTOR')}
                className="w-full p-3 text-left rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/60 transition flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-bold text-indigo-900">Rol GESTOR (con MFA)</div>
                  <div className="text-[11px] text-indigo-700">
                    Crear y publicar proyectos sociales
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-indigo-600 group-hover:translate-x-0.5 transition" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => handleMockLogin('AUDITOR')}
                className="w-full p-3 text-left rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/60 transition flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-bold text-amber-900">Rol AUDITOR (con MFA)</div>
                  <div className="text-[11px] text-amber-700">
                    Inspección de eventos de seguridad (HU-10)
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-600 group-hover:translate-x-0.5 transition" aria-hidden="true" />
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            Zero Trust valida la identidad en cada solicitud HTTP protegida.
          </p>
        </div>
      </div>
    </div>
  );
};

