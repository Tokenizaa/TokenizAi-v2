export type HermesErrorKind =
  | 'not_configured'
  | 'not_connected'
  | 'forbidden'
  | 'resource_unavailable'
  | 'timeout'
  | 'communication_error'
  | 'validation_error'
  | 'internal_error';

export function sanitizeDiagnosticMessage(raw: string): string {
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, 'Bearer [REDACTED]')
    .replace(/(Authorization\s*:\s*)[^\r\n]+/gi, '$1[REDACTED]')
    .replace(/(api[_-]?key|token|secret|password|passcode)\s*[:=]\s*[^\s,;'\"&]+/gi, '$1=[REDACTED]');
}

export class HermesIntegrationError extends Error {
  readonly kind: HermesErrorKind;
  readonly statusCode: number;
  readonly capabilityKey?: string;
  readonly endpoint?: string;

  constructor(options: {
    kind: HermesErrorKind;
    statusCode: number;
    message: string;
    capabilityKey?: string;
    endpoint?: string;
  }) {
    super(sanitizeDiagnosticMessage(options.message));
    this.name = 'HermesIntegrationError';
    this.kind = options.kind;
    this.statusCode = options.statusCode;
    this.capabilityKey = options.capabilityKey;
    this.endpoint = options.endpoint;
  }
}

export function classifyHttpError(
  status: number,
  bodyText: string,
  endpoint: string,
  capabilityKey?: string,
): HermesIntegrationError {
  const snippet = sanitizeDiagnosticMessage(bodyText).slice(0, 240);

  if (status === 401) {
    return new HermesIntegrationError({
      kind: 'not_connected',
      statusCode: 401,
      endpoint,
      capabilityKey,
      message: snippet || 'Credencial Hermes inválida ou expirada (HTTP 401).',
    });
  }

  if (status === 403) {
    return new HermesIntegrationError({
      kind: 'forbidden',
      statusCode: 403,
      endpoint,
      capabilityKey,
      message: snippet || 'Sem permissão para este recurso no Hermes (HTTP 403).',
    });
  }

  if (status === 404) {
    return new HermesIntegrationError({
      kind: 'resource_unavailable',
      statusCode: 404,
      endpoint,
      capabilityKey,
      message: snippet || `Recurso ou endpoint indisponível no Hermes (${endpoint}).`,
    });
  }

  if (status === 400 || status === 422) {
    return new HermesIntegrationError({
      kind: 'validation_error',
      statusCode: status,
      endpoint,
      capabilityKey,
      message: snippet || `Requisição recusada pelo Hermes (HTTP ${status}).`,
    });
  }

  if (status === 502 || status === 503 || status === 504) {
    return new HermesIntegrationError({
      kind: 'communication_error',
      statusCode: status,
      endpoint,
      capabilityKey,
      message: snippet || `Instância Hermes temporariamente indisponível (HTTP ${status}).`,
    });
  }

  return new HermesIntegrationError({
    kind: 'internal_error',
    statusCode: status >= 400 ? status : 502,
    endpoint,
    capabilityKey,
    message: snippet || `Hermes retornou HTTP ${status} em ${endpoint}.`,
  });
}

export function classifyTransportError(
  err: unknown,
  endpoint: string,
  capabilityKey?: string,
): HermesIntegrationError {
  if (err instanceof HermesIntegrationError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';

  if (name === 'TimeoutError' || name === 'AbortError' || /timeout|aborted/i.test(message)) {
    return new HermesIntegrationError({
      kind: 'timeout',
      statusCode: 504,
      endpoint,
      capabilityKey,
      message: `Tempo limite excedido ao comunicar com o Hermes (${endpoint}).`,
    });
  }

  if (/ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|EAI_AGAIN|fetch failed/i.test(message)) {
    return new HermesIntegrationError({
      kind: 'communication_error',
      statusCode: 503,
      endpoint,
      capabilityKey,
      message: `Não foi possível alcançar o Hermes (${sanitizeDiagnosticMessage(message)}).`,
    });
  }

  return new HermesIntegrationError({
    kind: 'communication_error',
    statusCode: 502,
    endpoint,
    capabilityKey,
    message: `Erro de comunicação com o Hermes: ${sanitizeDiagnosticMessage(message)}`,
  });
}
