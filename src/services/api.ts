import type {
  ClientStatus,
  DealStage,
  DirectorateCode,
  EnterpriseDataState,
  FinanceEntry,
  HermesActivityDto,
  HermesBotDto,
  HermesCapability,
  HermesChatMessageDto,
  HermesChatThreadDto,
  HermesConnectionStatus,
  HermesCostSummaryDto,
  HermesIntegrationStatus,
  HermesOverviewBundle,
  HermesRoutineDto,
  HermesRunDto,
  HermesTaskDto,
  ProductCategory,
  ProductRecord,
  ProjectStage,
} from '../types/platform';
import { getAccessToken } from '../lib/supabase.ts';

// Strictly in-memory admin session token (never persisted to localStorage or sessionStorage)
let adminBearerTokenMemory: string | null = null;

export function setAdminBearerToken(token: string | null) {
  adminBearerTokenMemory = token;
}

export function getAdminBearerToken(): string | null {
  return adminBearerTokenMemory;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatBRLDetailed(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Preserves the exact currency unit returned by the runtime (usually USD cents) without fake conversion.
 */
export function formatCents(cents: number | null | undefined, currency = 'USD'): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return 'N\u00e3o apurado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDateBR(isoDate: string): string {
  if (!isoDate) return '\u2014';
  const dayPart = isoDate.includes('T') ? isoDate.slice(0, 10) : isoDate;
  if (!dayPart.includes('-')) return isoDate;
  const [y, m, d] = dayPart.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function formatDateTimeBR(isoDate?: string | null): string {
  if (!isoDate) return '\u2014';
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return isoDate;
  return new Date(parsed).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || `Erro HTTP ${res.status}`);
  }
  return body as T;
}

async function adminAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const PlatformApi = {
  getHealth: () =>
    request<{
      status: string;
      timestamp: string;
      integrations: {
        hermes: HermesIntegrationStatus;
      };
    }>('/api/health'),

  getEnterpriseState: () =>
    request<{ ok: boolean; data: EnterpriseDataState }>('/api/enterprise/state'),

  createProject: (payload: {
    name: string;
    clientId: string;
    ownerName: string;
    endDate: string;
    budgetBRL: number;
    stage: ProjectStage;
  }) =>
    request('/api/enterprise/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProject: (
    id: string,
    payload: {
      name?: string;
      ownerName?: string;
      endDate?: string;
      budgetBRL?: number;
      spentBRL?: number;
      stage?: ProjectStage;
      deliverableId?: string;
      deliverableDone?: boolean;
      activityNote?: string;
      hermesProjectId?: string | null;
    },
  ) =>
    request(`/api/enterprise/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  createClient: (payload: {
    name: string;
    segment: string;
    cnpj: string;
    primaryContact: string;
    email: string;
    phone: string;
    accountManager?: string;
  }) =>
    request('/api/enterprise/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateClient: (
    id: string,
    payload: {
      name?: string;
      segment?: string;
      cnpj?: string;
      primaryContact?: string;
      email?: string;
      phone?: string;
      accountManager?: string;
      status?: ClientStatus;
      mrrBRL?: number;
    },
  ) =>
    request(`/api/enterprise/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  addClientInteraction: (
    clientId: string,
    payload: { channel: 'Reuni\u00e3o' | 'E-mail' | 'Proposta' | 'Suporte'; note: string },
  ) =>
    request(`/api/enterprise/clients/${clientId}/interactions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUserRole: (
    userId: string,
    role: 'Diretoria Executiva' | 'Gestor Operacional' | 'Comercial & CRM' | 'Financeiro' | 'Auditor',
  ) =>
    request(`/api/enterprise/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  resetDemoData: () =>
    request('/api/enterprise/reset', {
      method: 'POST',
      headers: { 'X-Confirm-Destructive': 'RESET_ENTERPRISE_DATA' },
    }),

  createDeal: (payload: {
    title: string;
    clientId: string;
    valueBRL: number;
    stage: DealStage;
    nextStep: string;
  }) =>
    request('/api/enterprise/deals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateDeal: (
    id: string,
    payload: {
      title?: string;
      stage?: DealStage;
      valueBRL?: number;
      expectedClose?: string;
      nextStep?: string;
      ownerName?: string;
      note?: string;
    },
  ) =>
    request(`/api/enterprise/deals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  createProduct: (payload: {
    name: string;
    category: ProductCategory;
    billingModel: ProductRecord['billingModel'];
    priceBRL: number;
    marginPercent: number;
    description: string;
  }) =>
    request('/api/enterprise/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProduct: (
    id: string,
    payload: {
      name?: string;
      category?: ProductCategory;
      billingModel?: ProductRecord['billingModel'];
      priceBRL?: number;
      marginPercent?: number;
      status?: ProductRecord['status'];
      description?: string;
    },
  ) =>
    request(`/api/enterprise/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateSubscription: (
    id: string,
    payload:
      | 'mark_paid'
      | 'cancel'
      | 'reactivate'
      | {
          action?: 'mark_paid' | 'cancel' | 'reactivate';
          planName?: string;
          cycle?: 'Mensal' | 'Anual';
          mrrBRL?: number;
          nextBillingDate?: string;
        },
  ) => {
    const body = typeof payload === 'string' ? { action: payload } : payload;
    return request(`/api/enterprise/subscriptions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  createFinanceEntry: (payload: Partial<FinanceEntry>) =>
    request('/api/enterprise/finance', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateFinanceEntry: (
    id: string,
    payload: FinanceEntry['status'] | Partial<FinanceEntry>,
  ) => {
    const body = typeof payload === 'string' ? { status: payload } : payload;
    return request(`/api/enterprise/finance/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  toggleAutomation: (id: string, active: boolean) =>
    request(`/api/enterprise/automations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),

  createAutomation: (payload: {
    name: string;
    trigger: string;
    action: string;
    targetAgentName: string;
  }) =>
    request('/api/enterprise/automations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface WorkspaceActorDto {
  userId: string;
  name: string;
  email: string;
  role: 'Diretoria Executiva' | 'Gestor Operacional' | 'Comercial & CRM' | 'Financeiro' | 'Auditor';
  isAdmin: boolean;
  authenticated?: boolean;
}

export const AuthSessionApi = {
  getMe: () => request<{ ok: boolean; actor: WorkspaceActorDto }>('/api/auth/me'),
  switchUserSession: async (userId: string) => {
    const res = await request<{
      ok: boolean;
      token: string;
      expiresAt: number;
      actor: WorkspaceActorDto;
    }>('/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    setAdminBearerToken(res.token);
    return res;
  },
  logout: async () => {
    await request('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAdminBearerToken(null);
  },
};

export const AdminAuthApi = {
  getStatus: () =>
    request<{
      ok: boolean;
      envConfigured: boolean;
      claimed: boolean;
      authenticated: boolean;
      actor?: WorkspaceActorDto;
    }>('/api/admin/auth/status'),

  claim: async (password: string) => {
    const res = await request<{
      ok: boolean;
      token: string;
      expiresAt: number;
      actor?: WorkspaceActorDto;
    }>('/api/admin/auth/claim', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    setAdminBearerToken(res.token);
    return res;
  },

  login: async (password: string) => {
    const res = await request<{
      ok: boolean;
      token: string;
      expiresAt: number;
      actor?: WorkspaceActorDto;
    }>('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    setAdminBearerToken(res.token);
    return res;
  },

  logout: async () => {
    await request('/api/admin/auth/logout', {
      method: 'POST',
    }).catch(() => {});
    setAdminBearerToken(null);
  },
};

export const HermesApi = {
  getStatus: () =>
    request<{ ok: boolean; status: HermesIntegrationStatus }>('/api/hermes/status'),
  refreshConnection: async () =>
    request<{ ok: boolean; status: HermesIntegrationStatus }>('/api/hermes/refresh', {
      method: 'POST',
    }),
  getOverviewBundle: () =>
    request<{ ok: boolean } & HermesOverviewBundle>('/api/hermes/overview'),

  // Agents (Bots)
  listAgents: () =>
    request<{ ok: boolean; agents: HermesBotDto[] }>('/api/hermes/agents'),
  getAgent: (agentId: string) =>
    request<{ ok: boolean; agent: HermesBotDto }>(
      `/api/hermes/agents/${encodeURIComponent(agentId)}`,
    ),
  hireBot: (payload: {
    slug: string;
    name: string;
    division?: string;
    model?: string;
  }) =>
    request<{ ok: boolean; agent: HermesBotDto }>('/api/hermes/agents/hire', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAgent: (agentId: string, payload: Record<string, unknown>) =>
    request<{ ok: boolean; agent: HermesBotDto }>(
      `/api/hermes/agents/${encodeURIComponent(agentId)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    ),
  deleteAgent: (agentId: string) =>
    request(`/api/hermes/agents/${encodeURIComponent(agentId)}`, {
      method: 'DELETE',
      headers: { 'X-Confirm-Destructive': 'TERMINATE_AGENT' },
    }),
  // Agentes: comandos de ciclo de vida (runtime Hermes)
  wakeupAgent: (agentId: string) =>
    request(`/api/hermes/agents/${encodeURIComponent(agentId)}/wakeup`, { method: 'POST' }),
  invokeHeartbeat: (agentId: string) =>
    request(`/api/hermes/agents/${encodeURIComponent(agentId)}/heartbeat`, { method: 'POST' }),
  pauseAgent: (agentId: string) =>
    request(`/api/hermes/agents/${encodeURIComponent(agentId)}/pause`, { method: 'POST' }),
  resumeAgent: (agentId: string) =>
    request(`/api/hermes/agents/${encodeURIComponent(agentId)}/resume`, { method: 'POST' }),
  getAgentRuntimeState: (agentId: string) =>
    request<{ ok: boolean; runtimeState: Record<string, unknown> }>(
      `/api/hermes/agents/${encodeURIComponent(agentId)}/runtime-state`,
    ),

  // Chats
  listChats: () =>
    request<{ ok: boolean; chats: HermesChatThreadDto[] }>('/api/hermes/chats'),
  getChat: (agentRef: string) =>
    request<{ ok: boolean; thread: HermesChatThreadDto; messages: HermesChatMessageDto[] }>(
      `/api/hermes/chats/${encodeURIComponent(agentRef)}`,
    ),
  sendChatMessage: (agentRef: string, payload: { body: string }) =>
    request<{ ok: boolean; message: HermesChatMessageDto }>(
      `/api/hermes/chats/${encodeURIComponent(agentRef)}`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  // Tasks (Kanban)
  listTasks: () =>
    request<{ ok: boolean; tasks: HermesTaskDto[] }>('/api/hermes/tasks'),
  createTask: (payload: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    assigneeAgentId?: string;
    projectId?: string;
    parentId?: string;
  }) =>
    request<{ ok: boolean; task: HermesTaskDto }>('/api/hermes/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTask: (taskId: string, payload: Record<string, unknown>) =>
    request<{ ok: boolean; task: HermesTaskDto }>(
      `/api/hermes/tasks/${encodeURIComponent(taskId)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    ),

  // Runs
  listRuns: (filters?: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== '') qs.set(k, String(v));
      }
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ ok: boolean; runs: HermesRunDto[] }>(`/api/hermes/runs${suffix}`);
  },

  // Routines
  listRoutines: () =>
    request<{ ok: boolean; routines: HermesRoutineDto[] }>(
      '/api/hermes/routines',
    ),
  createRoutine: (payload: {
    name: string;
    description?: string;
    cron?: string;
    agentId?: string;
  }) =>
    request<{ ok: boolean; routine: HermesRoutineDto }>(
      '/api/hermes/routines',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  // Costs
  getCostsSummary: () =>
    request<{ ok: boolean; summary: HermesCostSummaryDto }>(
      '/api/hermes/costs/summary',
    ),

  // Activity
  listActivity: (limit = 50) =>
    request<{ ok: boolean; activity: HermesActivityDto[] }>(
      `/api/hermes/activity?limit=${limit}`,
    ),

  // Org
  getOrganization: () =>
    request<{
      ok: boolean;
      tree: HermesBotDto[];
      agents: HermesBotDto[];
    }>('/api/hermes/org'),

  // Skills
  getSkills: () =>
    request<{ ok: boolean; skills: HermesSkillDto[] }>('/api/hermes/skills'),

  // Routines (comandos adicionais)
  getRoutineRuns: (routineId: string) =>
    request<{ ok: boolean; runs: Array<Record<string, unknown>> }>(
      `/api/hermes/routines/${encodeURIComponent(routineId)}/runs`,
    ),
  runRoutine: (routineId: string) =>
    request(`/api/hermes/routines/${encodeURIComponent(routineId)}/run`, {
      method: 'POST',
    }),
  createRoutineTrigger: (routineId: string, payload: Record<string, unknown>) =>
    request(`/api/hermes/routines/${encodeURIComponent(routineId)}/triggers`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRoutineTrigger: (
    routineId: string,
    triggerId: string,
    payload: Record<string, unknown>,
  ) =>
    request(
      `/api/hermes/routines/${encodeURIComponent(routineId)}/triggers/${encodeURIComponent(triggerId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    ),

  // Activity (audit)
  listAgentActionsAudit: (limit = 50) =>
    request<{ ok: boolean; actions: HermesActivityDto[] }>(
      `/api/hermes/activity/agent-actions?limit=${limit}`,
    ),


};

export interface HermesSkillDto {
  id: string;
  name: string;
  description?: string;
  version?: string;
  status?: string;
  installedAt?: string | null;
}

export interface BootstrapAdminResult {
  ok: boolean;
  claimed: boolean;
  user: {
    id: string;
    email: string | null;
    platformRole: string | null;
    isPlatformAdmin: boolean;
  };
  message?: string;
}

export const AuthApi = {
  bootstrapAdmin: async () => {
    const token = await getAccessToken();
    return request<BootstrapAdminResult>('/api/auth/bootstrap-admin', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
};

