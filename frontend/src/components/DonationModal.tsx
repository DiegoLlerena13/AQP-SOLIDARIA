import React, { useState } from 'react';
import { X, Heart, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { Project } from '../types/project';
import { Donation } from '../types/donation';
import { useAuth } from '../auth/AuthContext';
import { donationsService } from '../services/donationsService';
import { SimulationNotice } from './SimulationNotice';
import { ErrorMessage } from './ErrorMessage';
import { formatPEN } from './ProjectCard';
import { Link } from 'react-router-dom';

interface Props {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onDonationCreated?: (donation: Donation) => void;
}

export const DonationModal: React.FC<Props> = ({
  project,
  isOpen,
  onClose,
  onDonationCreated,
}) => {
  const { user, isAuthenticated, loginAsMockUser } = useAuth();
  const [solesInput, setSolesInput] = useState<string>('20.00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdDonation, setCreatedDonation] = useState<Donation | null>(null);
  const [error, setError] = useState<unknown>(null);

  if (!isOpen || !project) return null;

  const quickAmounts = ['10.00', '20.00', '50.00', '100.00', '250.00'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validación de entrada
    const parsed = parseFloat(solesInput);
    if (isNaN(parsed) || parsed < 1 || parsed > 1000) {
      setError(new Error('El importe debe estar comprendido entre S/ 1.00 y S/ 1,000.00 PEN'));
      return;
    }

    // Convertir a céntimos enteros (CA-05.1)
    const amountCents = Math.round(parsed * 100);

    // Generar Idempotency-Key única (UUID v4)
    const idempotencyKey =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setIsSubmitting(true);
    try {
      const result = await donationsService.createDonation(
        {
          projectId: project.projectId,
          amountCents,
        },
        idempotencyKey
      );

      setCreatedDonation(result);
      if (onDonationCreated) onDonationCreated(result);
    } catch (err) {
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setCreatedDonation(null);
    setError(null);
    setSolesInput('20.00');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Encabezado del Modal */}
        <div className="bg-gradient-to-r from-rose-500 to-rose-600 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Heart className="w-6 h-6 fill-white" aria-hidden="true" />
            </div>
            <div>
              <h2 id="modal-title" className="text-lg font-bold">
                Aporte Solidario Simulado
              </h2>
              <p className="text-xs text-rose-100 line-clamp-1">{project.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetForm}
            aria-label="Cerrar ventana"
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition focus:outline-none focus:ring-2 focus:ring-white"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Aviso de Simulación Académica Obligatorio (CA-06.4, CA-05.5) */}
        <SimulationNotice variant="banner" />

        <div className="p-6 space-y-6">
          {createdDonation ? (
            /* Estado de Donación Creada con Éxito (PENDIENTE_SIMULACION) */
            <div className="space-y-5 text-center py-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  ¡Intención de Donación Registrada!
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Tu aporte de{' '}
                  <strong className="text-slate-900 font-mono font-bold">
                    {formatPEN(createdDonation.amountCents)}
                  </strong>{' '}
                  ha sido creado en estado:{' '}
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    {createdDonation.status}
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-2 font-mono">
                  ID: {createdDonation.donationId}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left text-xs text-slate-600 space-y-2">
                <p className="font-semibold text-slate-800">
                  Próximo paso pedagógico (HU-06):
                </p>
                <p>
                  Para verificar el modelo Zero Trust y la actualización atómica del acumulado, ve
                  a tu historial y simula la <strong>Confirmación</strong> o el <strong>Rechazo</strong> del aporte.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  to="/mis-donaciones"
                  onClick={resetForm}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 text-white font-semibold rounded-xl text-sm shadow hover:bg-rose-700 transition"
                >
                  <span>Ir a Mis Donaciones</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl text-sm hover:bg-slate-200 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : !isAuthenticated || !user?.roles.includes('DONANTE') ? (
            /* Bloque de Autenticación Requerida */
            <div className="text-center py-6 space-y-4">
              <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200/80 inline-block">
                <ShieldAlert className="w-8 h-8 mx-auto" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Autenticación Zero Trust Requerida
                </h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto mt-1">
                  Para registrar donaciones conforme a CA-03.2 y CA-05.1, debes iniciar sesión con
                  el rol de <strong>DONANTE</strong>.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2.5 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => loginAsMockUser('DONANTE')}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow"
                >
                  Iniciar sesión de prueba como DONANTE
                </button>
                <Link
                  to="/login"
                  onClick={onClose}
                  className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition text-center"
                >
                  Ver opciones de inicio de sesión Cognito
                </Link>
              </div>
            </div>
          ) : (
            /* Formulario de Donación Simulada */
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              <ErrorMessage error={error} />

              <div>
                <label
                  htmlFor="amount-input"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Importe simulado en Soles (PEN)
                </label>
                <div className="relative rounded-2xl shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <span className="text-slate-500 font-bold text-base">S/</span>
                  </div>
                  <input
                    id="amount-input"
                    type="number"
                    step="0.01"
                    min="1.00"
                    max="1000.00"
                    required
                    value={solesInput}
                    onChange={(e) => setSolesInput(e.target.value)}
                    placeholder="20.00"
                    className="block w-full rounded-2xl border border-slate-200 pl-11 pr-4 py-3.5 text-lg font-bold font-mono text-slate-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500 transition focus:outline-none"
                    aria-describedby="amount-hint"
                  />
                </div>
                <p id="amount-hint" className="text-xs text-slate-500 mt-1.5">
                  Mínimo S/ 1.00 | Máximo S/ 1,000.00 (equivalente a 100 a 100,000 céntimos).
                </p>
              </div>

              {/* Botones de Selección Rápida */}
              <div>
                <span className="block text-xs font-medium text-slate-500 mb-2">
                  Montos sugeridos:
                </span>
                <div className="grid grid-cols-5 gap-2">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setSolesInput(amt)}
                      className={`py-2 px-1 text-xs font-bold rounded-xl border transition ${
                        solesInput === amt
                          ? 'bg-rose-50 border-rose-500 text-rose-700 ring-1 ring-rose-500'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      S/ {amt.split('.')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detalle de Identidad y Seguridad Zero Trust */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Donante autenticado:</span>
                  <span className="font-medium text-slate-900">{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sub (identidad Cognito):</span>
                  <span className="font-mono text-slate-700">{user.sub}</span>
                </div>
                <div className="flex justify-between">
                  <span>Protección XSS:</span>
                  <span className="text-emerald-700 font-semibold">Tokens en memoria</span>
                </div>
              </div>

              {/* Botón de Envío */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-2xl shadow-md hover:shadow-lg transition focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {isSubmitting ? (
                  <span>Registrando intención con Idempotency-Key...</span>
                ) : (
                  <>
                    <Heart className="w-4 h-4 fill-white" aria-hidden="true" />
                    <span>Registrar Intención de Donación</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
