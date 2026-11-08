import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { donationsService } from '../services/donationsService';
import { useAuth } from '../auth/AuthContext';
import { SimulationNotice } from '../components/SimulationNotice';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { formatPEN } from '../components/ProjectCard';
import { Donation, DonationStatus } from '../types/donation';
import {
  Heart,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const MyDonationsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<unknown>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const {
    data: donations,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['my-donations'],
    queryFn: () => donationsService.getMyDonations(),
  });

  const simulateMutation = useMutation({
    mutationFn: ({ donationId, action }: { donationId: string; action: 'CONFIRMAR' | 'RECHAZAR' }) =>
      donationsService.simulateDonation(donationId, action),
    onMutate: ({ donationId }) => {
      setProcessingId(donationId);
      setActionError(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-donations'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      setActionError(err);
    },
    onSettled: () => {
      setProcessingId(null);
    },
  });

  const handleSimulate = (donationId: string, action: 'CONFIRMAR' | 'RECHAZAR') => {
    simulateMutation.mutate({ donationId, action });
  };

  const getStatusBadge = (status: DonationStatus) => {
    switch (status) {
      case 'CONFIRMADA_SIMULADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            CONFIRMADA SIMULADA
          </span>
        );
      case 'RECHAZADA_SIMULADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
            RECHAZADA SIMULADA
          </span>
        );
      case 'PENDIENTE_SIMULACION':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 animate-pulse text-amber-600" aria-hidden="true" />
            PENDIENTE SIMULACIÓN
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-600 font-semibold text-xs tracking-wider uppercase mb-1">
            <Shield className="w-4 h-4" aria-hidden="true" />
            <span>Módulo de Donante • HU-07</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            Mi Historial de Donaciones Simuladas
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Visualiza tus aportes registrados y simula transiciones de estado para validar la consistencia Zero Trust.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 p-2.5 rounded-2xl border border-slate-200 text-xs">
          <span className="text-slate-500">Identidad (sub):</span>
          <span className="font-mono font-bold text-slate-800">{user?.sub}</span>
        </div>
      </div>

      {/* Aviso de Simulación Académica Destacado (CA-06.4) */}
      <SimulationNotice variant="banner" />

      {/* Errores */}
      <ErrorMessage error={error} onRetry={() => refetch()} />
      <ErrorMessage error={actionError} />

      {/* Explicación Pedagógica del Stage Académico */}
      <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 text-xs text-sky-900 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <strong className="font-bold text-sky-950">
            Simulación de Ciclo de Vida (HU-06 — Stage Académico):
          </strong>
          <p>
            Al pulsar <strong>«Simular Confirmación»</strong>, la donación pasa a{' '}
            <code className="bg-sky-100/80 px-1 py-0.5 rounded font-mono font-bold">
              CONFIRMADA_SIMULADA
            </code>{' '}
            y se incrementa el acumulado del proyecto de forma atómica en DynamoDB. Si seleccionas{' '}
            <strong>«Simular Rechazo»</strong>, pasa a{' '}
            <code className="bg-sky-100/80 px-1 py-0.5 rounded font-mono font-bold">
              RECHAZADA_SIMULADA
            </code>{' '}
            sin alterar los fondos globales.
          </p>
        </div>
      </div>

      {isLoading && <LoadingSpinner message="Obteniendo historial seguro de donaciones..." />}

      {!isLoading && !error && (
        <>
          {(!donations || donations.length === 0) ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300 p-8">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Aún no has registrado donaciones simuladas
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                Explora los proyectos sociales publicados y realiza tu primer aporte solidario de prueba.
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-rose-600 text-white text-xs font-bold rounded-xl shadow hover:bg-rose-700 transition"
              >
                <span>Explorar Proyectos</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <tr>
                        <th scope="col" className="px-6 py-4">Fecha / ID</th>
                        <th scope="col" className="px-6 py-4">Proyecto</th>
                        <th scope="col" className="px-6 py-4">Importe (PEN)</th>
                        <th scope="col" className="px-6 py-4">Estado</th>
                        <th scope="col" className="px-6 py-4 text-right">Acción Pedagógica</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal">
                      {donations.map((d: Donation) => (
                        <tr key={d.donationId} className="hover:bg-slate-50/50 transition">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-semibold text-slate-900">
                              {new Date(d.createdAt).toLocaleDateString('es-PE', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {d.donationId}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-slate-800 line-clamp-1">
                              {d.projectTitle || d.projectId}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-bold text-slate-900 font-mono text-base">
                              {formatPEN(d.amountCents)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(d.status)}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            {d.status === 'PENDIENTE_SIMULACION' ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={processingId === d.donationId}
                                  onClick={() => handleSimulate(d.donationId, 'CONFIRMAR')}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-xs transition"
                                  title="Confirmar aporte e incrementar el acumulado del proyecto"
                                >
                                  <Play className="w-3.5 h-3.5 fill-white" aria-hidden="true" />
                                  <span>Confirmar</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={processingId === d.donationId}
                                  onClick={() => handleSimulate(d.donationId, 'RECHAZAR')}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-rose-100 hover:text-rose-700 disabled:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                                  title="Rechazar simulación (no incrementa totales)"
                                >
                                  <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Rechazar</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                Estado finalizado
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
