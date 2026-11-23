import type { PaperclipHttpClient } from './client.ts';
import { findOpenApiRoute, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import type { PaperclipAttentionDto } from './types.ts';

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

function normalizeAttention(raw: Record<string, unknown>): PaperclipAttentionDto {
  return {
    companyId: raw.companyId ? String(raw.companyId) : null,
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : null,
    totalCount: typeof raw.totalCount === 'number' ? raw.totalCount : null,
    deskBadgeCount: typeof raw.deskBadgeCount === 'number' ? raw.deskBadgeCount : null,
    countsBySourceKind:
      raw.countsBySourceKind && typeof raw.countsBySourceKind === 'object'
        ? (raw.countsBySourceKind as Record<string, number>)
        : null,
    items: extractList(raw, ['items', 'actions', 'events']),
  };
}

export class PaperclipAttentionService {
  constructor(
    private readonly client: PaperclipHttpClient,
    private readonly getCompanyId: () => string | null,
    private readonly getOpenApi: () => PaperclipOpenApiSpecSummary | null,
  ) {}

  async listAttention(): Promise<PaperclipAttentionDto> {
    const companyId = this.getCompanyId();
    if (!companyId) {
      return {
        companyId: null,
        generatedAt: null,
        totalCount: 0,
        deskBadgeCount: 0,
        countsBySourceKind: {},
        items: [],
      };
    }
    const openApi = this.getOpenApi();
    const route = findOpenApiRoute(openApi, 'GET', [
      '/api/companies/{companyId}/attention',
    ]);
    const path =
      route && companyId
        ? `/api/companies/${encodeURIComponent(companyId)}/attention`
        : '/api/companies/{companyId}/attention';
    const raw = await this.client.requestJson<Record<string, unknown>>(path, {
      method: 'GET',
      capabilityKey: 'attention:read',
      cacheTtlMs: 5000,
    });
    return normalizeAttention(raw);
  }
}
