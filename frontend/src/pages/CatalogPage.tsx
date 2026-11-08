import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectsService } from '../services/projectsService';
import { ProjectCard } from '../components/ProjectCard';
import { ProjectStats } from '../components/ProjectStats';
import { DonationModal } from '../components/DonationModal';
import { LoadingSpinner, Skeleton } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { Project } from '../types/project';
import { Heart, Search, Filter } from 'lucide-react';

export const CatalogPage: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const {
    data: projects,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.getProjects(),
  });

  const filteredProjects = (projects || []).filter(
    (p) =>
      p.status === 'PUBLICADO' && // CA-01.2: Un borrador no aparece en el catálogo público
      (p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 text-white p-8 sm:p-12 shadow-xl border border-rose-900/40">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <Heart className="w-3.5 h-3.5 fill-rose-400" aria-hidden="true" />
            <span>Fundación AQP-SOLIDARIA • Arequipa</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
            Solidaridad transparente para nuestra comunidad
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Plataforma cloud-native con arquitectura Zero Trust (NIST SP 800-207). Explora causas
            sociales activas y experimenta con aportes simulados verificables y auditables.
          </p>
        </div>
      </section>

      {/* Indicadores Agregados de Transparencia (HU-09) */}
      {projects && <ProjectStats projects={projects} />}

      {/* Barra de Filtros y Búsqueda */}
      <section
        aria-label="Filtros de búsqueda de proyectos"
        className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar proyectos por causa o distrito..."
            aria-label="Buscar proyectos por causa o distrito"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 transition shadow-xs"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 self-end sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>Mostrando únicamente campañas con estado <strong>PUBLICADO</strong></span>
        </div>
      </section>

      {/* Estados de Carga y Error */}
      {isLoading && (
        <div className="space-y-4">
          <LoadingSpinner message="Consultando proyectos publicados en el servicio..." />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </div>
      )}

      <ErrorMessage error={error} onRetry={() => refetch()} />

      {/* Catálogo de Proyectos (HU-01) */}
      {!isLoading && !error && (
        <>
          {filteredProjects.length === 0 ? (
            /* CA-01.3: Estado vacío comprensible */
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300 p-8">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                No hay proyectos disponibles en este momento
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                {searchTerm
                  ? 'No se encontraron proyectos publicados que coincidan con los términos de búsqueda.'
                  : 'Actualmente no existen proyectos en estado PUBLICADO. Vuelve a consultar más tarde o ingresa con rol GESTOR para publicar uno nuevo.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.projectId}
                  project={project}
                  onDonateClick={(p) => setSelectedProject(p)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal de Donación Simulada (HU-05) */}
      <DonationModal
        project={selectedProject}
        isOpen={selectedProject !== null}
        onClose={() => setSelectedProject(null)}
        onDonationCreated={() => refetch()}
      />
    </div>
  );
};
