export type ProjectStatus = 'BORRADOR' | 'PUBLICADO';

export interface Project {
  projectId: string;
  title: string;
  description: string;
  goalAmountCents: number;
  confirmedAmountCents: number;
  currency: 'PEN';
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStats {
  projectId: string;
  confirmedAmountCents: number;
  goalAmountCents: number;
  progressPercentage: number;
  confirmedDonationsCount: number;
}

export interface CreateProjectDto {
  title: string;
  description: string;
  goalAmountCents: number;
}

export interface AggregateKpis {
  totalConfirmedCents: number;
  totalGoalCents: number;
  activeProjectsCount: number;
  confirmedDonationsCount: number;
}

