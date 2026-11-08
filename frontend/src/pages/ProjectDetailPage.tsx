import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsService } from '../services/projectsService';
import { DonationModal } from '../components/DonationModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { formatPEN } from '../components/ProjectCard';
import {
  ArrowLeft,
  Heart,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

export const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [isDonateOpen, setIsDonateOpen] = useState(false);

  const {
    data: project,
    isLoading: loadingProject,
    error: projectError,
    refetch: refetchProject,
  } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsService.getProjectById(projectId!),
    enabled: Boolean(projectId),
  });

  const { data: stats } = useQuery({
    queryKey: ['project-stats', projectId],
    queryFn: () => projectsService.getProjectStats(projectId!),
    enabled: Boolean(projectId),
  });

  if (loadingProject) {
    return <LoadingSpinner message="Consultando detalles de la campaña en backend seguro..." />;
  }

  if (projectError || !project) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-rose-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al catálogo</span>
        </Link>
        <ErrorMessage
          error={projectError || new Error('Proyecto no encontrado')}
          onRetry={() => refetchProject()}
        />
      </div>
    );
  }

  const percentage =
    project.goalAmountCents > 0
      ? Math.min(100, Math.round((project.confirmedAmountCents / project.goalAmountCents) * 100))
      : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-4xl mx-auto">
      {/* Navegación de retorno */}
      <nav aria-label="Ruta de navegación">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-rose-600 transition p-1 rounded focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Volver al catálogo de proyectos</span>
        </Link>
      </nav>

      {/* Tarjeta Principal de Detalle */}
      <article className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-10 space-y-8">
          {/* Header con Badges y Fechas */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                Estado: {project.status}
              </span>
              <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2.5 py-1 rounded-full">
                {project.currency}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                Publicado:{' '}
                {new Date(project.createdAt).toLocaleDateString('es-PE', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Título y Descripción */}
          <div className="space-y-4">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
              {project.title}
            </h1>
            <p className="text-slate-700 text-base sm:text-lg leading-relaxed whitespace-pre-line">
              {project.description}
            </p>
          </div>

          {/* Indicadores de Financiamiento y Progreso */}
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Recaudado Confirmado
                </span>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {formatPEN(project.confirmedAmountCents)}
                </div>
                <span className="text-[11px] text-slate-500">Simulación académica</span>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Meta del Proyecto
                </span>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {formatPEN(project.goalAmountCents)}
                </div>
                <span className="text-[11px] text-slate-500">Fondo social proyectado</span>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Aportes Registrados
                </span>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {stats ? stats.confirmedDonationsCount : '—'}
                </div>
                <span className="text-[11px] text-slate-500">Donaciones confirmadas</span>
              </div>
            </div>

            {/* Barra de Progreso */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Avance hacia la meta: {percentage}%</span>
                <span>Objetivo: {formatPEN(project.goalAmountCents)}</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progreso de financiamiento: ${percentage}%`}
                className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden"
              >
                <div
                  className="bg-gradient-to-r from-rose-500 to-rose-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Bloque de Privacidad y Zero Trust (CA-02.1) */}
          <div className="flex items-start gap-3 p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100 text-xs text-emerald-900">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong className="font-bold">Privacidad y Protección de Datos (CA-02.1):</strong>
              <p className="mt-0.5 text-emerald-800">
                La plataforma no expone identificadores, correos ni datos personales de los donantes
                en ninguna vista pública, en estricto cumplimiento con el principio de mínimo privilegio.
              </p>
            </div>
          </div>

          {/* Botón de Acción de Donación */}
          <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="text-xs text-slate-500 font-mono">
              Identificador del Recurso: {project.projectId}
            </div>

            <button
              type="button"
              onClick={() => setIsDonateOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md hover:shadow-lg transition focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
            >
              <Heart className="w-5 h-5 fill-white" aria-hidden="true" />
              <span>Realizar Aporte Simulado</span>
            </button>
          </div>
        </div>
      </article>

      {/* Modal de Donación */}
      <DonationModal
        project={project}
        isOpen={isDonateOpen}
        onClose={() => setIsDonateOpen(false)}
        onDonationCreated={() => {
          refetchProject();
        }}
      />
    </div>
  );
};
