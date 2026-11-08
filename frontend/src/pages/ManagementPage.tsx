import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsService } from '../services/projectsService';
import { formatPEN } from '../components/ProjectCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { Project } from '../types/project';
import {
  FolderPlus,
  Send,
  ShieldCheck,
  FileEdit,
  CheckCircle2,
  Layers,
} from 'lucide-react';

export const ManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalSoles, setGoalSoles] = useState('5000.00');
  const [formError, setFormError] = useState<unknown>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const {
    data: projects,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['gestor-projects'],
    queryFn: () => projectsService.getAllProjectsForGestor(),
  });

  const createMutation = useMutation({
    mutationFn: (dto: { title: string; description: string; goalAmountCents: number }) =>
      projectsService.createProject(dto),
    onSuccess: (newProj) => {
      queryClient.invalidateQueries({ queryKey: ['gestor-projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setTitle('');
      setDescription('');
      setGoalSoles('5000.00');
      setFormError(null);
      setActionSuccess(`Proyecto «${newProj.title}» creado en estado BORRADOR con éxito.`);
    },
    onError: (err) => {
      setFormError(err);
      setActionSuccess(null);
    },
  });

  const publishMutation = useMutation({
    mutationFn: (projectId: string) => projectsService.publishProject(projectId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['gestor-projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setActionSuccess(`Proyecto «${updated.title}» publicado. Ahora es visible en el catálogo público.`);
    },
    onError: (err) => {
      setFormError(err);
      setActionSuccess(null);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setActionSuccess(null);
    setFormError(null);

    const goal = parseFloat(goalSoles);
    if (isNaN(goal) || goal <= 0) {
      setFormError(new Error('La meta debe ser un número positivo en Soles (PEN)'));
      return;
    }

    const goalAmountCents = Math.round(goal * 100);

    createMutation.mutate({
      title,
      description,
      goalAmountCents,
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs tracking-wider uppercase mb-1">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>Módulo de Gestión • Rol GESTOR (HU-08)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            Panel de Gestión de Proyectos Sociales
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Registra nuevas campañas en borrador y publícalas para habilitar intenciones de donación.
          </p>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>{actionSuccess}</span>
        </div>
      )}

      <ErrorMessage error={formError || error} onRetry={() => refetch()} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario de Registro de Proyecto (HU-08, CA-08.1) */}
        <section
          aria-labelledby="form-heading"
          className="lg:col-span-1 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6 self-start"
        >
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <FolderPlus className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="form-heading" className="text-base font-bold text-slate-900">
                Nuevo Proyecto Social
              </h2>
              <p className="text-xs text-slate-500">Inicia siempre en estado BORRADOR</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label
                htmlFor="proj-title"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                Título de la causa
              </label>
              <input
                id="proj-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Apoyo alimentario para..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="proj-desc"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                Descripción y objetivo social
              </label>
              <textarea
                id="proj-desc"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalla los beneficiarios, ubicación en Arequipa y plan de entrega..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="proj-goal"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                Meta en Soles (PEN)
              </label>
              <div className="relative rounded-xl">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 font-bold text-sm">
                  S/
                </span>
                <input
                  id="proj-goal"
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={goalSoles}
                  onChange={(e) => setGoalSoles(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs shadow transition"
            >
              <FileEdit className="w-4 h-4" aria-hidden="true" />
              <span>
                {createMutation.isPending ? 'Guardando en DynamoDB...' : 'Crear Proyecto (BORRADOR)'}
              </span>
            </button>
          </form>
        </section>

        {/* Listado de Gestión (Borradores y Publicados) */}
        <section
          aria-labelledby="list-heading"
          className="lg:col-span-2 space-y-4"
        >
          <div className="flex items-center justify-between pb-2">
            <h2 id="list-heading" className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" aria-hidden="true" />
              <span>Catálogo Maestro de Proyectos</span>
            </h2>
            <span className="text-xs text-slate-500">
              Total: {projects ? projects.length : 0} registrados
            </span>
          </div>

          {isLoading && <LoadingSpinner message="Cargando proyectos de gestión..." />}

          {!isLoading && projects && (
            <div className="space-y-3">
              {projects.map((p: Project) => (
                <div
                  key={p.projectId}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          p.status === 'PUBLICADO'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {p.status}
                      </span>
                      <span className="text-xs font-mono text-slate-400">{p.projectId}</span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base">{p.title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2">{p.description}</p>

                    <div className="flex items-center gap-4 text-xs font-mono pt-1 text-slate-500">
                      <span>Meta: <strong>{formatPEN(p.goalAmountCents)}</strong></span>
                      <span>Recaudado: <strong>{formatPEN(p.confirmedAmountCents)}</strong></span>
                    </div>
                  </div>

                  <div className="sm:self-center shrink-0">
                    {p.status === 'BORRADOR' ? (
                      <button
                        type="button"
                        disabled={publishMutation.isPending}
                        onClick={() => publishMutation.mutate(p.projectId)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-xs transition"
                        title="Publicar proyecto para que reciba intenciones de donación"
                      >
                        <Send className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Publicar Proyecto</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Público y Activo
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
