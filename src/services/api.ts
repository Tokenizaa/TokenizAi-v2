import type {
  ClientStatus,
  DealStage,
  DirectorateCode,
  EnterpriseDataState,
  FinanceEntry,
  PaperclipActivityDto,
  PaperclipAgentDto,
  PaperclipApprovalDto,
  PaperclipAttachmentDto,
  PaperclipChatThreadDto,
  PaperclipCommentDto,
  PaperclipCostSummaryDto,
  PaperclipGoalDto,
  PaperclipIntegrationStatus,
  PaperclipIssueDto,
  PaperclipOrgNodeDto,
  PaperclipOverviewBundle,
  PaperclipProjectDto,
  PaperclipRoutineDto,
  PaperclipRunDto,
  ProductCategory,
  ProductRecord,
  ProjectStage,
} from '../types/platform';

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
 * Preserves the exact currency unit returned by Paperclip (usually USD cents) without fake conversion.
 */
export function formatCents(cents: number | null | undefined, currency = 'USD'): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return 'Não apurado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDateBR(isoDate: string): string {
  if (!isoDate) return '—';
  const dayPart = isoDate.includes('T') ? isoDate.slice(0, 10) : isoDate;
  if (!dayPart.includes('-')) return isoDate;
  const [y, m, d] = dayPart.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function formatDateTimeBR(isoDate?: string | null): string {
  if (!isoDate) return '—';
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
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...adminAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || `Erro HTTP ${res.status}`);
  }
  return body as T;
}

function adminAuthHeaders(): Record<string, string> {
  return adminBearerTokenMemory ? { Authorization: `Bearer ${adminBearerTokenMemory}` } : {};
}

export const PlatformApi = {
  getHealth: () =>
    request<{
      status: string;
      timestamp: string;
      integrations: {
        paperclip: PaperclipIntegrationStatus;
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
      paperclipProjectId?: string | null;
      paperclipProjectName?: string | null;
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
    payload: { channel: 'Reunião' | 'E-mail' | 'Proposta' | 'Suporte'; note: string },
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

export const PaperclipApi = {
  getStatus: () =>
    request<{ ok: boolean; status: PaperclipIntegrationStatus }>('/api/integrations/paperclip/status'),

  refreshConnection: () =>
    request<{ ok: boolean; status: PaperclipIntegrationStatus }>('/api/integrations/paperclip/refresh', {
      method: 'POST',
      headers: adminAuthHeaders(),
    }),

  getOverviewBundle: () =>
    request<{ ok: boolean } & PaperclipOverviewBundle>('/api/integrations/paperclip/overview'),

  // Agents
  listAgents: () => request<{ ok: boolean; agents: PaperclipAgentDto[] }>('/api/paperclip/agents'),
  getAgent: (agentId: string) => request<{ ok: boolean; agent: PaperclipAgentDto }>(`/api/paperclip/agents/${encodeURIComponent(agentId)}`),
  getAgentRuntimeState: (agentId: string) =>
    request<{ ok: boolean; runtimeState: Record<string, unknown> }>(
      `/api/paperclip/agents/${encodeURIComponent(agentId)}/runtime-state`,
    ),
  wakeupAgent: (agentId: string) =>
    request(`/api/paperclip/agents/${encodeURIComponent(agentId)}/wakeup`, { method: 'POST' }),
  invokeHeartbeat: (agentId: string) =>
    request(`/api/paperclip/agents/${encodeURIComponent(agentId)}/heartbeat`, { method: 'POST' }),
  pauseAgent: (agentId: string) =>
    request(`/api/paperclip/agents/${encodeURIComponent(agentId)}/pause`, { method: 'POST' }),
  resumeAgent: (agentId: string) =>
    request(`/api/paperclip/agents/${encodeURIComponent(agentId)}/resume`, { method: 'POST' }),

  hireSpecialist: (payload: {
    specialistId: string;
    slug: string;
    name: string;
    division: string;
    adapter: string;
    monthlyBudgetBRL: number;
    team: string;
    directorate?: DirectorateCode;
  }) =>
    request<{ ok: boolean; agent: PaperclipAgentDto }>('/api/paperclip/agents/hire', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Org
  getOrganization: () =>
    request<{ ok: boolean; tree: PaperclipOrgNodeDto[]; agents: PaperclipAgentDto[] }>('/api/paperclip/org'),

  // Agent Chat
  listChats: () => request<{ ok: boolean; chats: PaperclipChatThreadDto[] }>('/api/paperclip/chats'),
  getChat: (agentRef: string) =>
    request<{ ok: boolean; thread: PaperclipChatThreadDto; messages: PaperclipCommentDto[] }>(
      `/api/paperclip/chats/${encodeURIComponent(agentRef)}`,
    ),
  sendChatMessage: (agentRef: string, payload: { body: string; issueId?: string }) =>
    request<{ ok: boolean; thread?: PaperclipChatThreadDto; message?: PaperclipCommentDto }>(
      `/api/paperclip/chats/${encodeURIComponent(agentRef)}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  // Issues / Tasks
  listIssues: (filters: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ ok: boolean; issues: PaperclipIssueDto[] }>(`/api/paperclip/issues${suffix}`);
  },
  getIssue: (issueId: string) =>
    request<{ ok: boolean; issue: PaperclipIssueDto }>(`/api/paperclip/issues/${encodeURIComponent(issueId)}`),
  createIssue: (payload: Record<string, unknown>) =>
    request<{ ok: boolean; issue: PaperclipIssueDto }>('/api/paperclip/issues', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateIssue: (issueId: string, payload: Record<string, unknown>) =>
    request<{ ok: boolean; issue: PaperclipIssueDto }>(`/api/paperclip/issues/${encodeURIComponent(issueId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getIssueComments: (issueId: string) =>
    request<{ ok: boolean; comments: PaperclipCommentDto[] }>(
      `/api/paperclip/issues/${encodeURIComponent(issueId)}/comments`,
    ),
  addIssueComment: (issueId: string, body: string) =>
    request<{ ok: boolean; comment: PaperclipCommentDto }>(
      `/api/paperclip/issues/${encodeURIComponent(issueId)}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ body }),
      },
    ),
  getIssueRuns: (issueId: string) =>
    request<{ ok: boolean; runs: PaperclipRunDto[] }>(
      `/api/paperclip/issues/${encodeURIComponent(issueId)}/runs`,
    ),
  getIssueDocuments: (issueId: string) =>
    request<{ ok: boolean; documents: Array<Record<string, unknown>> }>(
      `/api/paperclip/issues/${encodeURIComponent(issueId)}/documents`,
    ),
  getIssueAttachments: (issueId: string) =>
    request<{ ok: boolean; attachments: PaperclipAttachmentDto[] }>(
      `/api/paperclip/issues/${encodeURIComponent(issueId)}/attachments`,
    ),
  uploadIssueAttachment: (
    issueId: string,
    payload: { filename: string; contentType: string; base64Content: string },
  ) =>
    request<{ ok: boolean; attachment: PaperclipAttachmentDto }>(
      `/api/paperclip/issues/${encodeURIComponent(issueId)}/attachments`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
  getIssueInteractions: (issueId: string) =>
    request<{ ok: boolean; interactions: Array<Record<string, unknown>> }>(
      `/api/paperclip/issues/${encodeURIComponent(issueId)}/interactions`,
    ),

  // Runs
  listRuns: (filters: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ ok: boolean; runs: PaperclipRunDto[] }>(`/api/paperclip/runs${suffix}`);
  },
  getRun: (runId: string) =>
    request<{ ok: boolean; run: PaperclipRunDto }>(`/api/paperclip/runs/${encodeURIComponent(runId)}`),
  getRunEvents: (runId: string) =>
    request<{ ok: boolean; events: Array<Record<string, unknown>>; logs: string[] }>(
      `/api/paperclip/runs/${encodeURIComponent(runId)}/events`,
    ),
  cancelRun: (runId: string) =>
    request(`/api/paperclip/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' }),

  // Operational Projects & Goals
  listProjects: () => request<{ ok: boolean; projects: PaperclipProjectDto[] }>('/api/paperclip/projects'),
  createProject: (payload: Record<string, unknown>) =>
    request<{ ok: boolean; project: PaperclipProjectDto }>('/api/paperclip/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listGoals: () => request<{ ok: boolean; goals: PaperclipGoalDto[] }>('/api/paperclip/goals'),
  createGoal: (payload: Record<string, unknown>) =>
    request<{ ok: boolean; goal: PaperclipGoalDto }>('/api/paperclip/goals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Routines
  listRoutines: () => request<{ ok: boolean; routines: PaperclipRoutineDto[] }>('/api/paperclip/routines'),
  createRoutine: (payload: Record<string, unknown>) =>
    request<{ ok: boolean; routine: PaperclipRoutineDto }>('/api/paperclip/routines', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRoutine: (routineId: string, payload: Record<string, unknown>) =>
    request<{ ok: boolean; routine: PaperclipRoutineDto }>(
      `/api/paperclip/routines/${encodeURIComponent(routineId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    ),
  getRoutineRuns: (routineId: string) =>
    request<{ ok: boolean; runs: Array<Record<string, unknown>> }>(
      `/api/paperclip/routines/${encodeURIComponent(routineId)}/runs`,
    ),
  runRoutine: (routineId: string) =>
    request(`/api/paperclip/routines/${encodeURIComponent(routineId)}/run`, { method: 'POST' }),
  createRoutineTrigger: (routineId: string, payload: Record<string, unknown>) =>
    request(`/api/paperclip/routines/${encodeURIComponent(routineId)}/triggers`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRoutineTrigger: (routineId: string, triggerId: string, payload: Record<string, unknown>) =>
    request(
      `/api/paperclip/routines/${encodeURIComponent(routineId)}/triggers/${encodeURIComponent(triggerId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    ),

  // Approvals
  listApprovals: () => request<{ ok: boolean; approvals: PaperclipApprovalDto[] }>('/api/paperclip/approvals'),
  approveApproval: (approvalId: string, note?: string) =>
    request(`/api/paperclip/approvals/${encodeURIComponent(approvalId)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  rejectApproval: (approvalId: string, note?: string) =>
    request(`/api/paperclip/approvals/${encodeURIComponent(approvalId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  requestApprovalRevision: (approvalId: string, note: string) =>
    request(`/api/paperclip/approvals/${encodeURIComponent(approvalId)}/request-revision`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  // Costs, Dashboard & Activity
  getCostsSummary: () =>
    request<{ ok: boolean; summary: PaperclipCostSummaryDto }>('/api/paperclip/costs/summary'),
  getDashboard: () => request<{ ok: boolean; dashboard: Record<string, unknown> }>('/api/paperclip/dashboard'),
  listActivity: (limit = 50) =>
    request<{ ok: boolean; activity: PaperclipActivityDto[] }>(`/api/paperclip/activity?limit=${limit}`),
  listAgentActionsAudit: (limit = 50) =>
    request<{ ok: boolean; actions: PaperclipActivityDto[] }>(
      `/api/paperclip/activity/agent-actions?limit=${limit}`,
    ),

  getAttachmentContentUrl: (attachmentId: string) =>
    `/api/paperclip/attachments/${encodeURIComponent(attachmentId)}/content`,
};
