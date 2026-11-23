export type PaperclipErrorKind =
  | 'not_configured'
  | 'invalid_credentials'
  | 'forbidden'
  | 'resource_unavailable'
  | 'timeout'
  | 'instance_unavailable'
  | 'communication_error'
  | 'upstream_error'
  | 'validation_error';

export function sanitizeDiagnosticMessage(raw: string): string {
  // Never echo Bearer tokens, API keys, URL tokens, or Authorization header fragments
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, 'Bearer [REDACTED]')
    .replace(/(Authorization\s*:\s*)[^\r\n]+/gi, '$1[REDACTED]')
    .replace(/(api[_-]?key|token|secret|password|passcode)\s*[:=]\s*[^\s,;'"&]+/gi, '$1=[REDACTED]');
}

export function assertCompanyScope(
  raw: Record<string, unknown> | null | undefined,
  expectedCompanyId: string | null,
  resourceLabel: string,
): void {
  if (!raw || !expectedCompanyId) return;
  const returnedCompanyId =
    typeof raw.companyId === 'string'
      ? raw.companyId
      : typeof (raw.company as Record<string, unknown> | undefined)?.id === 'string'
        ? String((raw.company as Record<string, unknown>).id)
        : null;
  if (returnedCompanyId && returnedCompanyId !== expectedCompanyId) {
    throw new PaperclipIntegrationError({
      kind: 'forbidden',
      statusCode: 403,
      message: `Acesso bloqueado: ${resourceLabel} pertence a outra organização no Paperclip.`,
    });
  }
}

export class PaperclipIntegrationError extends Error {
  readonly kind: PaperclipErrorKind;
  readonly statusCode: number;
  readonly capabilityKey?: string;
  readonly endpoint?: string;

  constructor(options: {
    kind: PaperclipErrorKind;
    statusCode: number;
    message: string;
    capabilityKey?: string;
    endpoint?: string;
  }) {
    super(sanitizeDiagnosticMessage(options.message));
    this.name = 'PaperclipIntegrationError';
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
): PaperclipIntegrationError {
  const snippet = sanitizeDiagnosticMessage(bodyText).slice(0, 240);

  if (status === 401) {
    return new PaperclipIntegrationError({
      kind: 'invalid_credentials',
      statusCode: 401,
      endpoint,
      capabilityKey,
      message: snippet || 'Credencial Paperclip inválida ou expirada (HTTP 401).',
    });
  }

  if (status === 403) {
    return new PaperclipIntegrationError({
      kind: 'forbidden',
      statusCode: 403,
      endpoint,
      capabilityKey,
      message: snippet || 'A Board API Key atual não possui permissão para este recurso (HTTP 403).',
    });
  }

  if (status === 404) {
    return new PaperclipIntegrationError({
      kind: 'resource_unavailable',
      statusCode: 404,
      endpoint,
      capabilityKey,
      message: snippet || `Recurso ou endpoint indisponível nesta versão do Paperclip (${endpoint}).`,
    });
  }

  if (status === 400 || status === 422) {
    return new PaperclipIntegrationError({
      kind: 'validation_error',
      statusCode: status,
      endpoint,
      capabilityKey,
      message: snippet || `Requisição recusada pelo Paperclip (HTTP ${status}).`,
    });
  }

  if (status === 502 || status === 503 || status === 504) {
    return new PaperclipIntegrationError({
      kind: 'instance_unavailable',
      statusCode: status,
      endpoint,
      capabilityKey,
      message: snippet || `Instância Paperclip temporariamente indisponível (HTTP ${status}).`,
    });
  }

  return new PaperclipIntegrationError({
    kind: 'upstream_error',
    statusCode: status >= 400 ? status : 502,
    endpoint,
    capabilityKey,
    message: snippet || `Paperclip retornou HTTP ${status} em ${endpoint}.`,
  });
}

export function classifyTransportError(err: unknown, endpoint: string, capabilityKey?: string): PaperclipIntegrationError {
  if (err instanceof PaperclipIntegrationError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';

  if (name === 'TimeoutError' || name === 'AbortError' || /timeout|aborted/i.test(message)) {
    return new PaperclipIntegrationError({
      kind: 'timeout',
      statusCode: 504,
      endpoint,
      capabilityKey,
      message: `Tempo limite excedido ao comunicar com o Paperclip (${endpoint}).`,
    });
  }

  if (/ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|EAI_AGAIN|fetch failed/i.test(message)) {
    return new PaperclipIntegrationError({
      kind: 'instance_unavailable',
      statusCode: 503,
      endpoint,
      capabilityKey,
      message: `Não foi possível alcançar a instância Paperclip configurada (${sanitizeDiagnosticMessage(message)}).`,
    });
  }

  return new PaperclipIntegrationError({
    kind: 'communication_error',
    statusCode: 502,
    endpoint,
    capabilityKey,
    message: `Erro de comunicação com o Paperclip: ${sanitizeDiagnosticMessage(message)}`,
  });
}
