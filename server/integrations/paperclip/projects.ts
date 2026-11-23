import type { PaperclipHttpClient } from './client.ts';
import { assertCompanyScope } from './errors.ts';
import { matchesOpenApiRoute, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import type { PaperclipGoalDto, PaperclipProjectDto } from './types.ts';

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

function normalizeProject(raw: Record<string, unknown>): PaperclipProjectDto {
  return {
    id: String(raw.id || ''),
    name: String(raw.name || raw.title || 'Projeto Paperclip'),
    description: typeof raw.description === 'string' ? raw.description : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
    leadAgentId: raw.leadAgentId ? String(raw.leadAgentId) : null,
    goalIds: Array.isArray(raw.goalIds) ? raw.goalIds.map(String) : undefined,
    targetDate: typeof raw.targetDate === 'string' ? raw.targetDate : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

function normalizeGoal(raw: Record<string, unknown>): PaperclipGoalDto {
  return {
    id: String(raw.id || ''),
    title: String(raw.title || raw.name || 'Meta operacional'),
    description: typeof raw.description === 'string' ? raw.description : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
    level: typeof raw.level === 'string' ? raw.level : undefined,
    progressPercent: typeof raw.progressPercent === 'number'
      ? raw.progressPercent
      : typeof raw.progress === 'number'
        ? raw.progress
        : null,
    ownerAgentId: raw.ownerAgentId ? String(raw.ownerAgentId) : null,
    parentGoalId: raw.parentGoalId ? String(raw.parentGoalId) : null,
  };
}

export class PaperclipProjectsService {
  constructor(
    private readonly client: PaperclipHttpClient,
    private readonly getCompanyId: () => string | null,
    private readonly getOpenApi: () => PaperclipOpenApiSpecSummary | null,
  ) {}

  async listProjects(): Promise<PaperclipProjectDto[]> {
    const companyId = this.getCompanyId();
    if (!companyId) return [];
    const raw = await this.client.requestJson<unknown>(
      `/api/companies/${encodeURIComponent(companyId)}/projects`,
      {
        method: 'GET',
        capabilityKey: 'projects:read',
        cacheTtlMs: 8000,
      },
    );
    return extractList(raw, ['projects', 'items']).map(normalizeProject);
  }

  async getProject(projectId: string): Promise<PaperclipProjectDto> {
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/projects/${encodeURIComponent(projectId)}`,
      {
        method: 'GET',
        capabilityKey: 'projects:read',
        isEntityLookup: true,
      },
    );
    assertCompanyScope(raw, this.getCompanyId(), 'projeto');
    return normalizeProject(raw);
  }

  async createProject(payload: Record<string, unknown>): Promise<PaperclipProjectDto> {
    const companyId = this.getCompanyId();
    if (!companyId) throw new Error('Empresa Paperclip não selecionada.');
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/companies/${encodeURIComponent(companyId)}/projects`,
      {
        method: 'POST',
        body: payload,
        capabilityKey: 'projects:write',
      },
    );
    return normalizeProject(raw);
  }

  async updateProject(projectId: string, payload: Record<string, unknown>): Promise<PaperclipProjectDto> {
    await this.getProject(projectId);
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/projects/${encodeURIComponent(projectId)}`,
      {
        method: 'PATCH',
        body: payload,
        capabilityKey: 'projects:write',
        isEntityLookup: true,
      },
    );
    assertCompanyScope(raw, this.getCompanyId(), 'projeto');
    return normalizeProject(raw);
  }

  async listGoals(): Promise<PaperclipGoalDto[]> {
    const companyId = this.getCompanyId();
    if (!companyId) return [];
    const openApi = this.getOpenApi();
    if (openApi?.available && !matchesOpenApiRoute(openApi, 'GET', '/api/companies/{companyId}/goals')) {
      return [];
    }
    const raw = await this.client.requestJson<unknown>(
      `/api/companies/${encodeURIComponent(companyId)}/goals`,
      {
        method: 'GET',
        capabilityKey: 'projects:read',
        cacheTtlMs: 8000,
      },
    );
    return extractList(raw, ['goals', 'items']).map(normalizeGoal);
  }

  async getGoal(goalId: string): Promise<PaperclipGoalDto> {
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/goals/${encodeURIComponent(goalId)}`,
      {
        method: 'GET',
        capabilityKey: 'projects:read',
        isEntityLookup: true,
      },
    );
    assertCompanyScope(raw, this.getCompanyId(), 'meta');
    return normalizeGoal(raw);
  }

  async createGoal(payload: Record<string, unknown>): Promise<PaperclipGoalDto> {
    const companyId = this.getCompanyId();
    if (!companyId) throw new Error('Empresa Paperclip não selecionada.');
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/companies/${encodeURIComponent(companyId)}/goals`,
      {
        method: 'POST',
        body: payload,
        capabilityKey: 'projects:write',
      },
    );
    return normalizeGoal(raw);
  }

  async updateGoal(goalId: string, payload: Record<string, unknown>): Promise<PaperclipGoalDto> {
    await this.getGoal(goalId);
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/goals/${encodeURIComponent(goalId)}`,
      {
        method: 'PATCH',
        body: payload,
        capabilityKey: 'projects:write',
        isEntityLookup: true,
      },
    );
    assertCompanyScope(raw, this.getCompanyId(), 'meta');
    return normalizeGoal(raw);
  }
}
