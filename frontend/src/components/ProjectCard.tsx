import React from 'react';
import { Link } from 'react-router-dom';
import { Target, Heart, ArrowRight, ShieldCheck } from 'lucide-react';
import { Project } from '../types/project';

interface Props {
  project: Project;
  onDonateClick?: (project: Project) => void;
}

export function formatPEN(cents: number): string {
  const soles = cents / 100;
  return soles.toLocaleString('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const ProjectCard: React.FC<Props> = ({ project, onDonateClick }) => {
  const percentage =
    project.goalAmountCents > 0
      ? Math.min(100, Math.round((project.confirmedAmountCents / project.goalAmountCents) * 100))
      : 0;

  return (
    <article className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col h-full focus-within:ring-2 focus-within:ring-rose-500">
      <div className="p-6 flex flex-col flex-1">
        {/* Header con Badge de Estado y Moneda */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Campaña Activa
          </span>
          <span className="text-xs font-medium text-slate-500 font-mono">
            ID: {project.projectId.slice(0, 16)}
          </span>
        </div>

        {/* Título */}
        <h3 className="text-lg font-bold text-slate-900 group-hover:text-rose-600 transition-colors line-clamp-2 mb-2">
          <Link
            to={`/proyectos/${project.projectId}`}
            className="focus:outline-none"
          >
            {project.title}
          </Link>
        </h3>

        {/* Descripción */}
        <p className="text-sm text-slate-600 line-clamp-3 mb-6 flex-1 leading-relaxed">
          {project.description}
        </p>

        {/* Progreso de Recaudación */}
        <div className="space-y-2 mb-6 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
          <div className="flex justify-between items-baseline text-xs text-slate-600">
            <span className="font-medium flex items-center gap-1 text-slate-700">
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" aria-hidden="true" />
              Recaudado simulado
            </span>
            <span className="font-bold text-slate-900 font-mono">
              {formatPEN(project.confirmedAmountCents)}
            </span>
          </div>

          {/* Barra de Progreso Accesible */}
          <div
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progreso de financiamiento: ${percentage}%`}
            className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden"
          >
            <div
              className="bg-gradient-to-r from-rose-500 to-rose-600 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="flex justify-between items-baseline text-xs text-slate-500">
            <span className="font-semibold text-rose-600">{percentage}% alcanzado</span>
            <span className="flex items-center gap-1 font-mono">
              <Target className="w-3.5 h-3.5" aria-hidden="true" />
              Meta: {formatPEN(project.goalAmountCents)}
            </span>
          </div>
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
          <Link
            to={`/proyectos/${project.projectId}`}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <span>Detalles</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>

          <button
            type="button"
            onClick={() => onDonateClick && onDonateClick(project)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm hover:shadow transition focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <Heart className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Donar</span>
          </button>
        </div>
      </div>
    </article>
  );
};
