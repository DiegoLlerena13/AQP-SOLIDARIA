import { Project, CreateProjectDto, ProjectStats } from '../types/project';
import { apiFetch, isUsingMock } from './apiClient';
import { mockAdapter } from './mock/mockAdapter';

export const projectsService = {
  async getProjects(): Promise<Project[]> {
    if (isUsingMock()) {
      return mockAdapter.getProjects();
    }
    const data = await apiFetch<any[]>('/v1/projects');
    return data.map((item) => ({
      ...item,
      title: item.title || item.name || 'Causa Social',
    }));
  },

  async getAllProjectsForGestor(): Promise<Project[]> {
    if (isUsingMock()) {
      return mockAdapter.getAllProjectsForGestor();
    }
    // En backend real HTTP API, el gestor consulta con su token
    return apiFetch<Project[]>('/v1/projects');
  },

  async getProjectById(projectId: string): Promise<Project> {
    if (isUsingMock()) {
      return mockAdapter.getProjectById(projectId);
    }
    return apiFetch<Project>(`/v1/projects/${projectId}`);
  },

  async getProjectStats(projectId: string): Promise<ProjectStats> {
    if (isUsingMock()) {
      return mockAdapter.getProjectStats(projectId);
    }
    return apiFetch<ProjectStats>(`/v1/projects/${projectId}/stats`);
  },

  async createProject(dto: CreateProjectDto): Promise<Project> {
    if (isUsingMock()) {
      return mockAdapter.createProject(dto);
    }
    return apiFetch<Project>('/v1/projects', {
      method: 'POST',
      body: JSON.stringify({
        ...dto,
        name: dto.title,
      }),
    });
  },

  async publishProject(projectId: string): Promise<Project> {
    if (isUsingMock()) {
      return mockAdapter.publishProject(projectId);
    }
    return apiFetch<Project>(`/v1/projects/${projectId}/publish`, {
      method: 'PATCH',
    });
  },
};

