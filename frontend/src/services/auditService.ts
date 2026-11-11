import { AuditEvent } from '../types/audit';
import { apiFetch, isUsingMock } from './apiClient';
import { mockAdapter } from './mock/mockAdapter';

export const auditService = {
  async getAuditEvents(): Promise<AuditEvent[]> {
    if (isUsingMock()) {
      return mockAdapter.getAuditEvents();
    }
    return apiFetch<AuditEvent[]>('/v1/audit');
  },
};

