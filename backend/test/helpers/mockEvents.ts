/**
 * @file mockEvents.ts
 * @description Generador de eventos simulados para API Gateway HTTP API Payload v2.
 */

export interface MockEventOptions {
  sub?: string;
  groups?: unknown;
  scopes?: unknown;
  clientId?: string;
  rawClaims?: Record<string, unknown>;
  method?: string;
  path?: string;
  routeKey?: string;
  stage?: string;
  body?: unknown;
  headers?: Record<string, string>;
  requestId?: string;
  omitJwt?: boolean;
}

export function createMockV2Event(options: MockEventOptions = {}) {
  const method = options.method || 'POST';
  const path = options.path || '/v1/donations';
  const routeKey = options.routeKey || `${method} ${path}`;
  const requestId = options.requestId || 'req-test-1234';
  const stage = options.stage || 'academic';

  let claims: Record<string, unknown> | undefined = undefined;

  if (!options.omitJwt) {
    claims = {
      ...(options.rawClaims || {})
    };

    if (options.sub !== undefined) {
      claims.sub = options.sub;
    }

    if (options.groups !== undefined) {
      claims['cognito:groups'] = options.groups;
    }

    if (options.clientId !== undefined) {
      claims.client_id = options.clientId;
    }
  }

  const jwt = options.omitJwt
    ? undefined
    : {
        claims,
        scopes: options.scopes
      };

  return {
    version: '2.0',
    routeKey,
    rawPath: path,
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
      'host': 'api.aqp-solidaria.org',
      ...(options.headers || {})
    },
    requestContext: {
      accountId: '123456789012',
      apiId: 'http-api-test',
      domainName: 'api.aqp-solidaria.org',
      domainPrefix: 'api',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '190.232.10.5',
        userAgent: 'Mozilla/5.0'
      },
      requestId,
      routeKey,
      stage,
      time: '09/Nov/2026:06:00:00 +0000',
      timeEpoch: 1794204000000,
      authorizer: options.omitJwt
        ? undefined
        : {
            jwt
          }
    },
    body: options.body !== undefined
      ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
      : undefined,
    isBase64Encoded: false
  };
}
