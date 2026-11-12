import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditService } from '../services/auditService';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { AuditEvent } from '../types/audit';
import { Shield, CheckCircle2, AlertTriangle, Key } from 'lucide-react';

export const AuditPage: React.FC = () => {
  const {
    data: events,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['audit-events'],
    queryFn: () => auditService.getAuditEvents(),
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-xs tracking-wider uppercase mb-1">
            <Shield className="w-4 h-4 text-amber-600" aria-hidden="true" />
            <span>Extensión HU-10 • Rol AUDITOR (MFA Obligatorio)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            Registro de Auditoría y Trazabilidad Zero Trust
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Eventos inmutables para monitoreo de seguridad. Seudonimización de identidades conforme a CA-10.2.
          </p>
        </div>
      </div>

      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
        <Key className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <strong>Mínimo Privilegio y Protección de Datos (CA-10.2):</strong>
          <p className="mt-0.5">
            Los registros de auditoría excluyen estrictamente tokens JWT, secretos, firmas y datos
            financieros reales. Cada evento incluye timestamp, requestId único y actor seudonimizado.
          </p>
        </div>
      </div>

      <ErrorMessage error={error} onRetry={() => refetch()} />

      {isLoading && <LoadingSpinner message="Consultando registro seguro de auditoría..." />}

      {!isLoading && events && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-6 py-4">Fecha y Hora</th>
                  <th scope="col" className="px-6 py-4">Request ID</th>
                  <th scope="col" className="px-6 py-4">Actor Seudonimizado</th>
                  <th scope="col" className="px-6 py-4">Acción</th>
                  <th scope="col" className="px-6 py-4">Recurso</th>
                  <th scope="col" className="px-6 py-4">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {events.map((evt: AuditEvent) => (
                  <tr key={evt.eventId} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-900 font-medium">
                      {new Date(evt.timestamp).toLocaleString('es-PE')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-500">
                      {evt.requestId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-indigo-700">
                      {evt.actorRef}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-xs text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {evt.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-600">
                      {evt.resourceRef}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {evt.outcome === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          EXITOSO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                          <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                          {evt.outcome}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
