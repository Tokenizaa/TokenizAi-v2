import type { PaperclipHttpClient } from './client.ts';
import { findOpenApiRoute, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import type { PaperclipInboxItemDto } from './types.ts';

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

function normalizeInboxItem(raw: Record<string, unknown>): PaperclipInboxItemDto {
  return {
    id: String(raw.id || ''),
    companyId: raw.companyId ? String(raw.companyId) : null,
    title: typeof raw.title === 'string' ? raw.title : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
    priority: typeof raw.priority === 'string' ? raw.priority : undefined,
    assigneeAgentId: raw.assigneeAgentId ? String(raw.assigneeAgentId) : null,
    assigneeAgentName: typeof raw.assigneeAgentName === 'string' ? raw.assigneeAgentName : null,
    projectId: raw.projectId ? String(raw.projectId) : null,
    projectName: typeof raw.projectName === 'string' ? raw.projectName : null,
    goalId: raw.goalId ? String(raw.goalId) : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    source: typeof raw.source === 'string' ? raw.source : undefined,
    url: typeof raw.url === 'string' ? raw.url : null,
  };
}

export class PaperclipInboxService {
  constructor(
    private readonly client: PaperclipHttpClient,
    private readonly getCompanyId: () => string | null,
    private readonly getOpenApi: () => PaperclipOpenApiSpecSummary | null,
  ) {}

  async listInbox(): Promise<PaperclipInboxItemDto[]> {
    const companyId = this.getCompanyId();
    if (!companyId) return [];
    const openApi = this.getOpenApi();
    const route = findOpenApiRoute(openApi, 'GET', [
      '/api/companies/{companyId}/inbox/mine',
    ]);
    const path =
      route && companyId
        ? `/api/companies/${encodeURIComponent(companyId)}/inbox/mine`
        : '/api/companies/{companyId}/inbox/mine';
    const raw = await this.client.requestJson<unknown>(path, {
      method: 'GET',
      capabilityKey: 'inbox:read',
      cacheTtlMs: 5000,
    });
    // A resposta pode ser um objeto { userId, issues: [...] } ou um array direto.
    let list: Array<Record<string, unknown>> = [];
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const issues = obj.issues;
      if (Array.isArray(issues)) list = issues;
      else if (Array.isArray(obj.items)) list = obj.items;
      else if (Array.isArray(raw)) list = raw as Array<Record<string, unknown>>;
    }
    return list.map(normalizeInboxItem);
  }
}
