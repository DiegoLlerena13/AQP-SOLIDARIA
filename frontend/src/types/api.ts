export interface ApiErrorResponse {
  code: string;
  message: string;
  requestId: string;
}

export class ApiError extends Error {
  code: string;
  requestId: string;
  status: number;

  constructor(status: number, data: ApiErrorResponse) {
    super(data.message || `Error HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = data.code || 'UNKNOWN_ERROR';
    this.requestId = data.requestId || 'req-local-undefined';
  }
}
