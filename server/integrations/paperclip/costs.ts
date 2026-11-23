import type { PaperclipHttpClient } from './client.ts';
import { matchesOpenApiRoute, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import type { PaperclipCostSummaryDto } from './types.ts';

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

export class PaperclipCostsService {
  constructor(
    private readonly client: PaperclipHttpClient,
    private readonly getCompanyId: () => string | null,
    private readonly getOpenApi: () => PaperclipOpenApiSpecSummary | null,
  ) {}

  async getSummary(query?: { from?: string; to?: string }): Promise<PaperclipCostSummaryDto> {
    const companyId = this.getCompanyId();
    if (!companyId) {
      return { totalCostCents: 0, currency: 'USD' };
    }
    const basePath = `/api/companies/${encodeURIComponent(companyId)}/costs`;
    const openApi = this.getOpenApi();
    const hasRoute = (template: string) => !openApi?.available || matchesOpenApiRoute(openApi, 'GET', template);

    const [summaryRes, byAgentRes, byProjectRes, qualityRes] = await Promise.allSettled([
      this.client.requestJson<Record<string, unknown>>(`${basePath}/summary`, {
        method: 'GET',
        query,
        capabilityKey: 'costs:read',
        cacheTtlMs: 8000,
      }),
      hasRoute('/api/companies/{companyId}/costs/by-agent')
        ? this.client.requestJson<unknown>(`${basePath}/by-agent`, {
            method: 'GET',
            query,
            capabilityKey: 'costs:read',
            cacheTtlMs: 8000,
          })
        : Promise.resolve([]),
      hasRoute('/api/companies/{companyId}/costs/by-project')
        ? this.client.requestJson<unknown>(`${basePath}/by-project`, {
            method: 'GET',
            query,
            capabilityKey: 'costs:read',
            cacheTtlMs: 8000,
          })
        : Promise.resolve([]),
      hasRoute('/api/companies/{companyId}/costs/data-quality')
        ? this.client.requestJson<Record<string, unknown>>(`${basePath}/data-quality`, {
            method: 'GET',
            query,
            capabilityKey: 'costs:read',
            cacheTtlMs: 8000,
          })
        : Promise.resolve(null),
    ]);

    const summary = summaryRes.status === 'fulfilled' ? summaryRes.value : {};
    const byAgentRaw = byAgentRes.status === 'fulfilled' ? extractList(byAgentRes.value, ['items', 'agents', 'byAgent']) : [];
    const byProjectRaw = byProjectRes.status === 'fulfilled' ? extractList(byProjectRes.value, ['items', 'projects', 'byProject']) : [];
    const quality = qualityRes.status === 'fulfilled' ? qualityRes.value : null;

    if (summaryRes.status === 'rejected') {
      throw summaryRes.reason;
    }

    return {
      totalCostCents: Number(summary.totalCostCents ?? summary.spentCents ?? 0),
      currency: typeof summary.currency === 'string' ? summary.currency : 'USD',
      periodStart: typeof summary.periodStart === 'string' ? summary.periodStart : undefined,
      periodEnd: typeof summary.periodEnd === 'string' ? summary.periodEnd : undefined,
      budgetMonthlyCents: typeof summary.budgetMonthlyCents === 'number' ? summary.budgetMonthlyCents : null,
      byAgent: byAgentRaw.map((row) => ({
        agentId: String(row.agentId || row.id || ''),
        agentName: String(row.agentName || row.name || 'Agente'),
        costCents: Number(row.costCents ?? row.spentCents ?? 0),
        budgetMonthlyCents: typeof row.budgetMonthlyCents === 'number' ? row.budgetMonthlyCents : null,
        tokens: typeof row.totalTokens === 'number' ? row.totalTokens : typeof row.tokens === 'number' ? row.tokens : undefined,
        runsCount: typeof row.runsCount === 'number' ? row.runsCount : undefined,
        model: typeof row.model === 'string' ? row.model : undefined,
      })),
      byProject: byProjectRaw.map((row) => ({
        projectId: String(row.projectId || row.id || ''),
        projectName: String(row.projectName || row.name || 'Projeto'),
        costCents: Number(row.costCents ?? row.spentCents ?? 0),
        issuesCount: typeof row.issuesCount === 'number' ? row.issuesCount : undefined,
      })),
      dataQuality: quality
        ? {
            unpricedRunsCount: typeof quality.unpricedRunsCount === 'number' ? quality.unpricedRunsCount : undefined,
            missingCostEventsCount: typeof quality.missingCostEventsCount === 'number' ? quality.missingCostEventsCount : undefined,
            coveragePercent: typeof quality.coveragePercent === 'number' ? quality.coveragePercent : null,
            notes: Array.isArray(quality.notes) ? quality.notes.map(String) : undefined,
          }
        : null,
    };
  }

  async getByAgent(query?: { from?: string; to?: string }) {
    const companyId = this.getCompanyId();
    if (!companyId) return [];
    return this.client.requestJson(`/api/companies/${encodeURIComponent(companyId)}/costs/by-agent`, {
      method: 'GET',
      query,
      capabilityKey: 'costs:read',
    });
  }

  async getByProject(query?: { from?: string; to?: string }) {
    const companyId = this.getCompanyId();
    if (!companyId) return [];
    return this.client.requestJson(`/api/companies/${encodeURIComponent(companyId)}/costs/by-project`, {
      method: 'GET',
      query,
      capabilityKey: 'costs:read',
    });
  }

  async getDataQuality() {
    const companyId = this.getCompanyId();
    if (!companyId) return {};
    return this.client.requestJson(`/api/companies/${encodeURIComponent(companyId)}/costs/data-quality`, {
      method: 'GET',
      capabilityKey: 'costs:read',
    });
  }

  async getDashboard() {
    const companyId = this.getCompanyId();
    if (!companyId) return {};
    return this.client.requestJson(`/api/companies/${encodeURIComponent(companyId)}/dashboard`, {
      method: 'GET',
      capabilityKey: 'activity:read',
      cacheTtlMs: 5000,
    });
  }
}
