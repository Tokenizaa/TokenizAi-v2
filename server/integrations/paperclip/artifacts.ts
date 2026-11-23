import type { PaperclipHttpClient } from './client.ts';
import { findOpenApiRoute, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import type { PaperclipArtifactDto } from './types.ts';

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

function normalizeArtifact(raw: Record<string, unknown>): PaperclipArtifactDto {
  return {
    id: String(raw.id || ''),
    source: typeof raw.source === 'string' ? raw.source : undefined,
    mediaKind: typeof raw.mediaKind === 'string' ? raw.mediaKind : undefined,
    title: typeof raw.title === 'string' ? raw.title : undefined,
    previewText: typeof raw.previewText === 'string' ? raw.previewText : null,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    issueId: raw.issueId ? String(raw.issueId) : null,
    authorName: typeof raw.authorName === 'string' ? raw.authorName : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : null,
    sizeBytes: typeof raw.sizeBytes === 'number' ? raw.sizeBytes : null,
    contentType: typeof raw.contentType === 'string' ? raw.contentType : null,
    url: typeof raw.url === 'string' ? raw.url : null,
  };
}

export class PaperclipArtifactsService {
  constructor(
    private readonly client: PaperclipHttpClient,
    private readonly getCompanyId: () => string | null,
    private readonly getOpenApi: () => PaperclipOpenApiSpecSummary | null,
  ) {}

  async listArtifacts(): Promise<PaperclipArtifactDto[]> {
    const companyId = this.getCompanyId();
    if (!companyId) return [];
    const openApi = this.getOpenApi();
    const route = findOpenApiRoute(openApi, 'GET', [
      '/api/companies/{companyId}/artifacts',
    ]);
    const path =
      route && companyId
        ? `/api/companies/${encodeURIComponent(companyId)}/artifacts`
        : '/api/companies/{companyId}/artifacts';
    const raw = await this.client.requestJson<unknown>(path, {
      method: 'GET',
      capabilityKey: 'artifacts:read',
      cacheTtlMs: 5000,
    });
    return extractList(raw, ['artifacts', 'items', 'data']).map(normalizeArtifact);
  }
}
