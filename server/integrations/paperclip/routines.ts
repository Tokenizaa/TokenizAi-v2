import type { PaperclipHttpClient } from './client.ts';
import { assertCompanyScope } from './errors.ts';
import { findOpenApiRoute, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import type { PaperclipRoutineDto, PaperclipRoutineTriggerDto } from './types.ts';

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

function normalizeTrigger(raw: Record<string, unknown>): PaperclipRoutineTriggerDto {
  return {
    id: String(raw.id || ''),
    type: String(raw.kind || raw.type || 'schedule'),
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : raw.status !== 'disabled',
    schedule: typeof raw.schedule === 'string' ? raw.schedule : typeof raw.cronExpression === 'string' ? raw.cronExpression : undefined,
    cron: typeof raw.cron === 'string' ? raw.cron : undefined,
    webhookUrl: typeof raw.webhookUrl === 'string' ? raw.webhookUrl : undefined,
    config: (raw.config as Record<string, unknown> | undefined) || undefined,
    lastFiredAt: typeof raw.lastFiredAt === 'string' ? raw.lastFiredAt : null,
  };
}

function normalizeRoutine(raw: Record<string, unknown>): PaperclipRoutineDto {
  const triggersRaw = Array.isArray(raw.triggers) ? raw.triggers : [];
  return {
    id: String(raw.id || ''),
    name: String(raw.name || raw.title || 'Rotina'),
    description: typeof raw.description === 'string' ? raw.description : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : raw.status !== 'paused' && raw.status !== 'disabled',
    agentId: raw.assigneeAgentId ? String(raw.assigneeAgentId) : raw.agentId ? String(raw.agentId) : null,
    agentName: typeof raw.agentName === 'string' ? raw.agentName : null,
    projectId: raw.projectId ? String(raw.projectId) : null,
    triggers: triggersRaw.map((t) => normalizeTrigger(t as Record<string, unknown>)),
    lastRunAt: typeof raw.lastRunAt === 'string' ? raw.lastRunAt : null,
    lastRunStatus: typeof raw.lastRunStatus === 'string' ? raw.lastRunStatus : null,
  };
}

export class PaperclipRoutinesService {
  constructor(
    private readonly client: PaperclipHttpClient,
    private readonly getCompanyId: () => string | null,
    private readonly getOpenApi: () => PaperclipOpenApiSpecSummary | null,
  ) {}

  async listRoutines(): Promise<PaperclipRoutineDto[]> {
    const companyId = this.getCompanyId();
    if (!companyId) return [];
    const raw = await this.client.requestJson<unknown>(
      `/api/companies/${encodeURIComponent(companyId)}/routines`,
      {
        method: 'GET',
        capabilityKey: 'routines:read',
        cacheTtlMs: 5000,
      },
    );
    return extractList(raw, ['routines', 'items']).map(normalizeRoutine);
  }

  async getRoutine(routineId: string): Promise<PaperclipRoutineDto> {
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/routines/${encodeURIComponent(routineId)}`,
      {
        method: 'GET',
        capabilityKey: 'routines:read',
        isEntityLookup: true,
      },
    );
    assertCompanyScope(raw, this.getCompanyId(), 'rotina');
    return normalizeRoutine(raw);
  }

  async createRoutine(payload: Record<string, unknown>): Promise<PaperclipRoutineDto> {
    const companyId = this.getCompanyId();
    if (!companyId) throw new Error('Empresa Paperclip não selecionada.');
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/companies/${encodeURIComponent(companyId)}/routines`,
      {
        method: 'POST',
        body: payload,
        capabilityKey: 'routines:manage',
      },
    );
    return normalizeRoutine(raw);
  }

  async updateRoutine(routineId: string, payload: Record<string, unknown>): Promise<PaperclipRoutineDto> {
    await this.getRoutine(routineId);
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/routines/${encodeURIComponent(routineId)}`,
      {
        method: 'PATCH',
        body: payload,
        capabilityKey: 'routines:manage',
        isEntityLookup: true,
      },
    );
    assertCompanyScope(raw, this.getCompanyId(), 'rotina');
    return normalizeRoutine(raw);
  }

  async getRoutineRuns(routineId: string): Promise<Array<Record<string, unknown>>> {
    const raw = await this.client.requestJson<unknown>(
      `/api/routines/${encodeURIComponent(routineId)}/runs`,
      {
        method: 'GET',
        capabilityKey: 'routines:read',
        isEntityLookup: true,
      },
    );
    return extractList(raw, ['runs', 'items']);
  }

  async runManually(routineId: string, payload?: Record<string, unknown>): Promise<unknown> {
    await this.getRoutine(routineId);
    const openApi = this.getOpenApi();
    const route =
      findOpenApiRoute(openApi, 'POST', [
        '/api/routines/{routineId}/run',
        '/api/routines/{routineId}/trigger',
      ]) || '/api/routines/{routineId}/run';
    const resolved = route.replace(/\{[^}]+\}/, encodeURIComponent(routineId));
    return this.client.requestJson(resolved, {
      method: 'POST',
      body: payload || {},
      capabilityKey: 'routines:manage',
      isEntityLookup: true,
    });
  }

  async createTrigger(routineId: string, payload: Record<string, unknown>): Promise<unknown> {
    await this.getRoutine(routineId);
    return this.client.requestJson(`/api/routines/${encodeURIComponent(routineId)}/triggers`, {
      method: 'POST',
      body: payload,
      capabilityKey: 'routines:manage',
      isEntityLookup: true,
    });
  }

  async updateTrigger(routineId: string, triggerId: string, payload: Record<string, unknown>): Promise<unknown> {
    await this.getRoutine(routineId);
    const openApi = this.getOpenApi();
    const route = findOpenApiRoute(openApi, 'PATCH', [
      '/api/routine-triggers/{triggerId}',
      '/api/routines/{routineId}/triggers/{triggerId}',
    ]);

    const resolved =
      route && route.includes('{routineId}')
        ? `/api/routines/${encodeURIComponent(routineId)}/triggers/${encodeURIComponent(triggerId)}`
        : `/api/routine-triggers/${encodeURIComponent(triggerId)}`;

    return this.client.requestJson(resolved, {
      method: 'PATCH',
      body: payload,
      capabilityKey: 'routines:manage',
      isEntityLookup: true,
    });
  }
}
