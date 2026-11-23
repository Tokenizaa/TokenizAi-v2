import type { PaperclipHttpClient } from './client.ts';
import { assertCompanyScope } from './errors.ts';
import { findOpenApiRoute, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import type { PaperclipAgentDto } from './types.ts';

function extractArray(raw: unknown, keys: string[]): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const k of keys) {
      if (Array.isArray(obj[k])) return obj[k] as Array<Record<string, unknown>>;
    }
  }
  return [];
}

export function normalizeAgent(raw: Record<string, unknown>): PaperclipAgentDto {
  const appearance = (raw.appearance as Record<string, unknown> | undefined) || undefined;
  const runtimeConfig = (raw.runtimeConfig as Record<string, unknown> | undefined) || undefined;
  const access = (raw.access as Record<string, unknown> | undefined) || undefined;
  const capabilities = Array.isArray(raw.capabilities)
    ? raw.capabilities.map(String)
    : typeof raw.capabilities === 'string'
      ? raw.capabilities.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

  return {
    id: String(raw.id || ''),
    name: String(raw.name || raw.title || 'Agente'),
    role: String(raw.role || ''),
    title: typeof raw.title === 'string' ? raw.title : undefined,
    reportsTo: raw.reportsTo !== undefined ? (raw.reportsTo ? String(raw.reportsTo) : null) : null,
    capabilities,
    appearance,
    avatarUrl: typeof raw.avatarUrl === 'string'
      ? raw.avatarUrl
      : typeof appearance?.avatarUrl === 'string'
        ? appearance.avatarUrl
        : null,
    adapterType: typeof raw.adapterType === 'string' ? raw.adapterType : undefined,
    status: String(raw.status || 'unknown'),
    lifecycleState: typeof raw.lifecycleState === 'string' ? raw.lifecycleState : undefined,
    lifecycleError: typeof raw.lifecycleError === 'string' ? raw.lifecycleError : null,
    lifecycleVersion:
      typeof raw.lifecycleVersion === 'string' || typeof raw.lifecycleVersion === 'number'
        ? raw.lifecycleVersion
        : null,
    budgetMonthlyCents: typeof raw.budgetMonthlyCents === 'number' ? raw.budgetMonthlyCents : null,
    spentMonthlyCents: typeof raw.spentMonthlyCents === 'number' ? raw.spentMonthlyCents : null,
    permissions: (raw.permissions as Record<string, unknown> | string[] | undefined) || undefined,
    runtimeConfig,
    chainOfCommand: Array.isArray(raw.chainOfCommand)
      ? (raw.chainOfCommand as Array<Record<string, unknown>>)
      : undefined,
    access,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    lastHeartbeatAt: typeof raw.lastHeartbeatAt === 'string' ? raw.lastHeartbeatAt : undefined,
    runtimeState: (raw.runtimeState as Record<string, unknown> | null | undefined) || null,
  };
}

export class PaperclipAgentsService {
  constructor(
    private readonly client: PaperclipHttpClient,
    private readonly getCompanyId: () => string | null,
    private readonly getOpenApi: () => PaperclipOpenApiSpecSummary | null,
  ) {}

  async listAgents(): Promise<PaperclipAgentDto[]> {
    const companyId = this.getCompanyId();
    const path = companyId ? `/api/companies/${encodeURIComponent(companyId)}/agents` : '/api/agents';
    const raw = await this.client.requestJson<unknown>(path, {
      method: 'GET',
      capabilityKey: 'agents:read',
      cacheTtlMs: 5000,
    });
    return extractArray(raw, ['agents', 'items', 'data']).map(normalizeAgent);
  }

  async getAgent(agentId: string): Promise<PaperclipAgentDto> {
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/agents/${encodeURIComponent(agentId)}`,
      {
        method: 'GET',
        capabilityKey: 'agents:read',
        cacheTtlMs: 3000,
        isEntityLookup: true,
      },
    );
    assertCompanyScope(raw, this.getCompanyId(), 'agente');
    return normalizeAgent(raw);
  }

  async getRuntimeState(agentId: string): Promise<Record<string, unknown>> {
    return this.client.requestJson<Record<string, unknown>>(
      `/api/agents/${encodeURIComponent(agentId)}/runtime-state`,
      {
        method: 'GET',
        capabilityKey: 'agents:manage',
        isEntityLookup: true,
      },
    );
  }

  async wakeup(agentId: string, payload?: Record<string, unknown>): Promise<unknown> {
    return this.client.requestJson(`/api/agents/${encodeURIComponent(agentId)}/wakeup`, {
      method: 'POST',
      body: payload || {},
      capabilityKey: 'agents:manage',
    });
  }

  async invokeHeartbeat(agentId: string, payload?: Record<string, unknown>): Promise<unknown> {
    const openApi = this.getOpenApi();
    const route =
      findOpenApiRoute(openApi, 'POST', [
        '/api/agents/{agentId}/heartbeat/invoke',
        '/api/agents/{agentId}/heartbeat',
      ]) || '/api/agents/{agentId}/heartbeat/invoke';

    const resolved = route.replace(/\{[^}]+\}/, encodeURIComponent(agentId));
    return this.client.requestJson(resolved, {
      method: 'POST',
      body: payload || {},
      capabilityKey: 'agents:manage',
    });
  }

  async pause(agentId: string): Promise<unknown> {
    return this.client.requestJson(`/api/agents/${encodeURIComponent(agentId)}/pause`, {
      method: 'POST',
      capabilityKey: 'agents:manage',
    });
  }

  async resume(agentId: string): Promise<unknown> {
    return this.client.requestJson(`/api/agents/${encodeURIComponent(agentId)}/resume`, {
      method: 'POST',
      capabilityKey: 'agents:manage',
    });
  }

  async createAgent(payload: Record<string, unknown>): Promise<PaperclipAgentDto> {
    const companyId = this.getCompanyId();
    const openApi = this.getOpenApi();
    const preferredRoute = findOpenApiRoute(openApi, 'POST', [
      '/api/companies/{companyId}/agents',
      '/api/agents',
    ]);
    const path =
      preferredRoute === '/api/companies/{companyId}/agents' && companyId
        ? `/api/companies/${encodeURIComponent(companyId)}/agents`
        : companyId && !preferredRoute
          ? `/api/companies/${encodeURIComponent(companyId)}/agents`
          : '/api/agents';

    const created = await this.client.requestJson<Record<string, unknown>>(path, {
      method: 'POST',
      body: payload,
      capabilityKey: 'agents:manage',
    });
    return normalizeAgent(created);
  }

  async terminateAgent(agentId: string): Promise<unknown> {
    return this.client.requestJson(`/api/agents/${encodeURIComponent(agentId)}`, {
      method: 'DELETE',
      capabilityKey: 'agents:manage',
    });
  }

  async updateAgent(agentId: string, payload: Record<string, unknown>): Promise<PaperclipAgentDto> {
    const openApi = this.getOpenApi();
    const route =
      findOpenApiRoute(openApi, 'PATCH', ['/api/agents/{agentId}']) ||
      '/api/agents/{agentId}';
    const resolved = route.replace(/\{[^}]+\}/, encodeURIComponent(agentId));
    const raw = await this.client.requestJson<Record<string, unknown>>(resolved, {
      method: 'PATCH',
      body: payload,
      capabilityKey: 'agents:manage',
    });
    return normalizeAgent(raw);
  }
}
