import type { PaperclipHttpClient } from './client.ts';
import { assertCompanyScope } from './errors.ts';
import { findOpenApiRoute, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import type { PaperclipRunDto } from './types.ts';

function extractList(raw: unknown, keys: string[]): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const k of keys) {
      if (Array.isArray(obj[k])) return obj[k] as Array<Record<string, unknown>>;
    }
  }
  return [];
}

export function normalizeRun(raw: Record<string, unknown>): PaperclipRunDto {
  const agent = (raw.agent as Record<string, unknown> | undefined) || {};
  const usage = (raw.usage as Record<string, unknown> | undefined) || {};
  const startedAt = typeof raw.startedAt === 'string' ? raw.startedAt : typeof raw.createdAt === 'string' ? raw.createdAt : undefined;
  const finishedAt = typeof raw.finishedAt === 'string' ? raw.finishedAt : typeof raw.completedAt === 'string' ? raw.completedAt : undefined;

  let durationMs = typeof raw.durationMs === 'number' ? raw.durationMs : null;
  if (durationMs === null && startedAt && finishedAt) {
    const diff = Date.parse(finishedAt) - Date.parse(startedAt);
    if (Number.isFinite(diff) && diff >= 0) durationMs = diff;
  }

  return {
    id: String(raw.id || ''),
    agentId: raw.agentId ? String(raw.agentId) : agent.id ? String(agent.id) : undefined,
    agentName: typeof raw.agentName === 'string'
      ? raw.agentName
      : typeof agent.name === 'string'
        ? agent.name
        : undefined,
    issueId: raw.issueId ? String(raw.issueId) : undefined,
    issueIdentifier: typeof raw.issueIdentifier === 'string' ? raw.issueIdentifier : undefined,
    status: String(raw.status || 'unknown'),
    triggerSource: typeof raw.triggerSource === 'string'
      ? raw.triggerSource
      : typeof raw.invocationSource === 'string'
        ? raw.invocationSource
        : typeof raw.source === 'string'
          ? raw.source
          : undefined,
    startedAt,
    finishedAt,
    durationMs,
    resultSummary: typeof raw.resultSummary === 'string'
      ? raw.resultSummary
      : typeof raw.summary === 'string'
        ? raw.summary
        : undefined,
    errorMessage: typeof raw.error === 'string'
      ? raw.error
      : typeof raw.errorMessage === 'string'
        ? raw.errorMessage
        : null,
    logs: Array.isArray(raw.logs) ? raw.logs.map(String) : undefined,
    events: Array.isArray(raw.events) ? (raw.events as Array<Record<string, unknown>>) : undefined,
    inputTokens: typeof raw.inputTokens === 'number'
      ? raw.inputTokens
      : typeof usage.inputTokens === 'number'
        ? usage.inputTokens
        : null,
    outputTokens: typeof raw.outputTokens === 'number'
      ? raw.outputTokens
      : typeof usage.outputTokens === 'number'
        ? usage.outputTokens
        : null,
    totalTokens: typeof raw.totalTokens === 'number'
      ? raw.totalTokens
      : typeof usage.totalTokens === 'number'
        ? usage.totalTokens
        : null,
    model: typeof raw.model === 'string' ? raw.model : null,
    provider: typeof raw.provider === 'string' ? raw.provider : null,
    costCents: typeof raw.costCents === 'number' ? raw.costCents : null,
    currency: typeof raw.currency === 'string' ? raw.currency : 'USD',
    workspaceOps: Array.isArray(raw.workspaceOps)
      ? (raw.workspaceOps as Array<Record<string, unknown>>)
      : undefined,
  };
}

export class PaperclipRunsService {
  constructor(
    private readonly client: PaperclipHttpClient,
    private readonly getCompanyId: () => string | null,
    private readonly getOpenApi: () => PaperclipOpenApiSpecSummary | null,
  ) {}

  async listRuns(query?: Record<string, string | number | undefined>): Promise<PaperclipRunDto[]> {
    const companyId = this.getCompanyId();
    if (!companyId) return [];
    const raw = await this.client.requestJson<unknown>(
      `/api/companies/${encodeURIComponent(companyId)}/heartbeat-runs`,
      {
        method: 'GET',
        query,
        capabilityKey: 'runs:read',
        cacheTtlMs: 3000,
      },
    );
    return extractList(raw, ['runs', 'heartbeatRuns', 'items']).map(normalizeRun);
  }

  async getRun(runId: string): Promise<PaperclipRunDto> {
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/heartbeat-runs/${encodeURIComponent(runId)}`,
      {
        method: 'GET',
        capabilityKey: 'runs:read',
        isEntityLookup: true,
      },
    );
    assertCompanyScope(raw, this.getCompanyId(), 'execução');
    return normalizeRun(raw);
  }

  async getRunIssues(runId: string): Promise<Array<Record<string, unknown>>> {
    const raw = await this.client.requestJson<unknown>(
      `/api/heartbeat-runs/${encodeURIComponent(runId)}/issues`,
      {
        method: 'GET',
        capabilityKey: 'runs:read',
        isEntityLookup: true,
      },
    );
    return extractList(raw, ['issues', 'items']);
  }

  async getRunEvents(runId: string): Promise<{ events: Array<Record<string, unknown>>; logs: string[] }> {
    const openApi = this.getOpenApi();
    const eventsRoute = findOpenApiRoute(openApi, 'GET', [
      '/api/heartbeat-runs/{runId}/events',
      '/api/heartbeat-runs/{runId}/log',
      '/api/heartbeat-runs/{runId}/logs',
    ]);

    if (!eventsRoute) {
      const detail = await this.getRun(runId);
      return { events: detail.events || [], logs: detail.logs || [] };
    }

    const resolved = eventsRoute.replace(/\{[^}]+\}/, encodeURIComponent(runId));
    const raw = await this.client.requestJson<unknown>(resolved, {
      method: 'GET',
      capabilityKey: 'runs:read',
      isEntityLookup: true,
    });

    const events = extractList(raw, ['events', 'items']);
    const logs = Array.isArray((raw as Record<string, unknown>)?.logs)
      ? ((raw as Record<string, unknown>).logs as unknown[]).map(String)
      : [];

    return { events, logs };
  }

  async cancelRun(runId: string): Promise<unknown> {
    await this.getRun(runId);
    const openApi = this.getOpenApi();
    const cancelRoute =
      findOpenApiRoute(openApi, 'POST', ['/api/heartbeat-runs/{runId}/cancel']) ||
      '/api/heartbeat-runs/{runId}/cancel';
    const resolved = cancelRoute.replace(/\{[^}]+\}/, encodeURIComponent(runId));
    return this.client.requestJson(resolved, {
      method: 'POST',
      capabilityKey: 'runs:cancel',
      isEntityLookup: true,
    });
  }
}
