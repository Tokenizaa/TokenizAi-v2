import type { PaperclipHttpClient } from './client.ts';
import { matchesOpenApiRoute, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import type { PaperclipActivityDto } from './types.ts';

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

function normalizeActivity(raw: Record<string, unknown>): PaperclipActivityDto {
  return {
    id: String(raw.id || `act-${Date.now()}`),
    timestamp: String(raw.createdAt || raw.timestamp || new Date().toISOString()),
    actorType: typeof raw.actorType === 'string' ? raw.actorType : undefined,
    actorId: raw.actorId ? String(raw.actorId) : undefined,
    actorName: String(raw.actorName || raw.actor || 'Sistema'),
    action: String(raw.action || raw.eventType || 'event'),
    targetType: typeof raw.entityType === 'string' ? raw.entityType : typeof raw.targetType === 'string' ? raw.targetType : undefined,
    targetId: raw.entityId ? String(raw.entityId) : raw.targetId ? String(raw.targetId) : undefined,
    targetName: typeof raw.entityName === 'string' ? raw.entityName : typeof raw.targetName === 'string' ? raw.targetName : undefined,
    issueId: raw.issueId ? String(raw.issueId) : undefined,
    summary: typeof raw.summary === 'string' ? raw.summary : typeof raw.message === 'string' ? raw.message : undefined,
    details: (raw.details as Record<string, unknown> | undefined) || undefined,
  };
}

export class PaperclipActivityService {
  constructor(
    private readonly client: PaperclipHttpClient,
    private readonly getCompanyId: () => string | null,
    private readonly getOpenApi: () => PaperclipOpenApiSpecSummary | null,
  ) {}

  async listActivity(limit = 50): Promise<PaperclipActivityDto[]> {
    const companyId = this.getCompanyId();
    if (!companyId) return [];
    const raw = await this.client.requestJson<unknown>(
      `/api/companies/${encodeURIComponent(companyId)}/activity`,
      {
        method: 'GET',
        query: { limit },
        capabilityKey: 'activity:read',
        cacheTtlMs: 4000,
      },
    );
    return extractList(raw, ['activity', 'events', 'items']).map(normalizeActivity);
  }

  async listAgentActionsAudit(limit = 50): Promise<PaperclipActivityDto[]> {
    const companyId = this.getCompanyId();
    if (!companyId) return [];
    const openApi = this.getOpenApi();
    if (
      openApi?.available &&
      !matchesOpenApiRoute(openApi, 'GET', '/api/companies/{companyId}/audit/agent-actions')
    ) {
      return [];
    }
    const raw = await this.client.requestJson<unknown>(
      `/api/companies/${encodeURIComponent(companyId)}/audit/agent-actions`,
      {
        method: 'GET',
        query: { limit },
        capabilityKey: 'activity:read',
        cacheTtlMs: 4000,
      },
    );
    return extractList(raw, ['actions', 'items', 'events']).map(normalizeActivity);
  }
}
