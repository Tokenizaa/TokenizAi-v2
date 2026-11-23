import type { PaperclipHttpClient } from './client.ts';
import { findOpenApiRoute, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import type { PaperclipCompanySkillDto } from './types.ts';

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

function normalizeSkill(raw: Record<string, unknown>): PaperclipCompanySkillDto {
  return {
    id: String(raw.id || ''),
    companyId: raw.companyId ? String(raw.companyId) : null,
    folderId: raw.folderId ? String(raw.folderId) : null,
    folderPath: typeof raw.folderPath === 'string' ? raw.folderPath : null,
    key: typeof raw.key === 'string' ? raw.key : null,
    slug: typeof raw.slug === 'string' ? raw.slug : null,
    name: typeof raw.name === 'string' ? raw.name : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    version: typeof raw.version === 'string' ? raw.version : null,
    status: typeof raw.status === 'string' ? raw.status : undefined,
    installedAt: typeof raw.installedAt === 'string' ? raw.installedAt : null,
    source: typeof raw.source === 'string' ? raw.source : null,
  };
}

export class PaperclipSkillsService {
  constructor(
    private readonly client: PaperclipHttpClient,
    private readonly getCompanyId: () => string | null,
    private readonly getOpenApi: () => PaperclipOpenApiSpecSummary | null,
  ) {}

  async listCompanySkills(): Promise<PaperclipCompanySkillDto[]> {
    const companyId = this.getCompanyId();
    if (!companyId) return [];
    const openApi = this.getOpenApi();
    const route = findOpenApiRoute(openApi, 'GET', [
      '/api/companies/{companyId}/skills',
    ]);
    const path =
      route && companyId
        ? `/api/companies/${encodeURIComponent(companyId)}/skills`
        : '/api/companies/{companyId}/skills';
    const raw = await this.client.requestJson<unknown>(path, {
      method: 'GET',
      capabilityKey: 'skills:read',
      cacheTtlMs: 5000,
    });
    return extractList(raw, ['skills', 'items', 'data']).map(normalizeSkill);
  }
}
