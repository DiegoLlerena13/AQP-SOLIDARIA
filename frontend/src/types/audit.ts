export interface AuditEvent {
  eventId: string;
  timestamp: string;
  requestId: string;
  actorRef: string; // Pseudonymized
  action: string;
  resourceRef: string;
  outcome: 'SUCCESS' | 'DENIED' | 'ERROR';
  details?: Record<string, unknown>;
}

