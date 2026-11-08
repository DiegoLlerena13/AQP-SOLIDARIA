import React from 'react';
import { TrendingUp, Award, Layers, Shield } from 'lucide-react';
import { Project } from '../types/project';
import { formatPEN } from './ProjectCard';

interface Props {
  projects: Project[];
}

export const ProjectStats: React.FC<Props> = ({ projects }) => {
  // CA-09.1: Suma total confirmada excluye pendientes y rechazadas
  const publishedProjects = projects.filter((p) => p.status === 'PUBLICADO');
  const totalConfirmedCents = publishedProjects.reduce(
    (acc, p) => acc + (p.confirmedAmountCents || 0),
    0
  );
  const totalGoalCents = publishedProjects.reduce(
    (acc, p) => acc + (p.goalAmountCents || 0),
    0
  );
  const globalProgress =
    totalGoalCents > 0 ? Math.min(100, Math.round((totalConfirmedCents / totalGoalCents) * 100)) : 0;

  return (
    <section
      aria-label="Indicadores agregados de transparencia social"
      className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm mb-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-rose-600 font-semibold text-xs tracking-wider uppercase mb-1">
            <Shield className="w-4 h-4" aria-hidden="true" />
            <span>Métricas de Transparencia Comunitaria (HU-09)</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Impacto Social Consolidado — Arequipa
          </h2>
        </div>
        <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 self-start md:self-auto">
          Actualizado en tiempo real | Moneda: <strong>PEN (S/)</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Recaudado Confirmado */}
        <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Recaudación Confirmada</span>
            <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg">
              <TrendingUp className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
            {formatPEN(totalConfirmedCents)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Excluye intenciones pendientes y rechazadas
          </p>
        </div>

        {/* Meta Total Proyectada */}
        <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Meta Global Requerida</span>
            <div className="p-1.5 bg-sky-100 text-sky-600 rounded-lg">
              <Award className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
            {formatPEN(totalGoalCents)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Objetivo social acumulado en la región
          </p>
        </div>

        {/* Campañas Publicadas */}
        <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Campañas Activas</span>
            <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
              <Layers className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
            {publishedProjects.length}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Causas sociales auditadas y abiertas
          </p>
        </div>

        {/* Progreso Consolidado */}
        <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Avance General</span>
            <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
              <TrendingUp className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
            {globalProgress}%
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${globalProgress}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

