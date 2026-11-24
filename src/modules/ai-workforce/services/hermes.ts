import { HermesApi, PlatformApi } from '../../../services/api';
import type { HermesIntegrationStatus, HermesBotDto, HermesOverviewBundle, HermesChatThreadDto, HermesChatMessageDto, HermesTaskDto, HermesRunDto, HermesRoutineDto, HermesApprovalDto, HermesCostSummaryDto, HermesActivityDto, HermesSkillDto, HermesIssueDto } from '../../../types/platform';
import type { WorkforceStatus } from '../types';

/**
 * Camada de serviço da Força de Trabalho IA (Runtime Hermes).
 *
 * Toda comunicação com o Hermes passa pelo backend da TokenizAi
 * (src/services/api.ts → rotas /api/hermes/* → HermesGateway → Hermes CLI).
 * O navegador nunca acessa o runtime operacional diretamente.
 */
export const hermesService = {
  /** Status da integração e matriz de capacidades. */
  getStatus: () => HermesApi.getStatus(),
  /** Refresh da conexão com o runtime Hermes. */
  refreshConnection: () => HermesApi.refreshConnection(),
  /** Bundle consolidado para dashboards / visões gerais. */
  getOverviewBundle: () => HermesApi.getOverviewBundle(),

  // --- Agents (Bots) ---
  listAgents: () => HermesApi.listAgents(),
  getAgent: (agentId: string) => HermesApi.getAgent(agentId),
  hireBot: (payload: {
    slug: string;
    name: string;
    division?: string;
    model?: string;
  }) => HermesApi.hireBot(payload),
  updateAgent: (agentId: string, payload: Record<string, unknown>) =>
    HermesApi.updateAgent(agentId, payload),
  deleteAgent: (agentId: string) =>
    HermesApi.deleteAgent(agentId),

  // --- Chats ---
  listChats: () => HermesApi.listChats(),
  sendChatMessage: (agentRef: string, payload: { body: string }) =>
    HermesApi.sendChatMessage(agentRef, payload),

  // --- Tasks (Kanban) ---
  listTasks: () => HermesApi.listTasks(),
  createTask: (payload: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    assigneeAgentId?: string;
    projectId?: string;
    parentId?: string;
  }) => HermesApi.createTask(payload),
  updateTask: (taskId: string, payload: Record<string, unknown>) =>
    HermesApi.updateTask(taskId, payload),

  // --- Runs ---
  listRuns: (filters?: Record<string, string | number | undefined>) =>
    HermesApi.listRuns(filters),

  // --- Routines ---
  listRoutines: () => HermesApi.listRoutines(),
  createRoutine: (payload: {
    name: string;
    description?: string;
    cron?: string;
    agentId?: string;
  }) => HermesApi.createRoutine(payload),

  // --- Approvals ---
  listApprovals: () => HermesApi.listApprovals(),
  createApproval: (payload: {
    title: string;
    description?: string;
    reason?: string;
  }) => HermesApi.createApproval(payload),
  getApproval: (approvalId: string) => HermesApi.getApproval(approvalId),
  approveApproval: (approvalId: string, note?: string) =>
    HermesApi.approveApproval(approvalId, note),
  rejectApproval: (approvalId: string, note?: string) =>
    HermesApi.rejectApproval(approvalId, note),
  requestApprovalRevision: (approvalId: string, note: string) =>
    HermesApi.requestApprovalRevision(approvalId, note),

  // --- Costs ---
  getCostsSummary: () => HermesApi.getCostsSummary(),
  getDashboard: () => HermesApi.getDashboard(),

  // --- Activity ---
  listActivity: (limit = 50) => HermesApi.listActivity(limit),
  getInbox: () => HermesApi.getInbox(),
  getAttention: () => HermesApi.getAttention(),

  // --- Artifacts ---
  getArtifacts: () => HermesApi.getArtifacts(),
  getAttachmentContentUrl: (attachmentId: string) =>
    HermesApi.getAttachmentContentUrl(attachmentId),

  // --- Goals ---
  listGoals: () => HermesApi.listGoals(),

  // --- Runs ---
  runRoutine: (routineId: string) => HermesApi.runRoutine(routineId),

  // --- Issues (tasks) ---
  listIssues: async (filters?: Record<string, string | number | undefined>) => {
    const res = await HermesApi.listRuns(filters);
    const issues: HermesIssueDto[] = (res.runs || []).map((run) => ({
      id: run.id,
      title: run.issueIdentifier || run.agentName || 'Tarefa',
      status: run.status,
      priority: undefined,
      assigneeAgentId: run.agentId,
      assigneeAgentName: run.agentName,
      projectId: undefined,
      projectName: undefined,
      unresolvedBlockerCount: undefined,
      blockerReason: undefined,
      goalId: undefined,
      blockedByIssueIds: undefined,
      createdAt: run.startedAt,
      updatedAt: run.finishedAt,
    }));
    return { ok: res.ok, issues };
  },
  getIssue: (issueId: string) => HermesApi.getIssue(issueId),
  getIssueComments: (issueId: string) => HermesApi.getIssueComments(issueId),
  getIssueRuns: (issueId: string) => HermesApi.getIssueRuns(issueId),
  getIssueAttachments: (issueId: string) => HermesApi.getIssueAttachments(issueId),
  addIssueComment: (issueId: string, body: string) =>
    HermesApi.addIssueComment(issueId, body),
  updateIssue: (issueId: string, payload: Record<string, unknown>) =>
    HermesApi.updateIssue(issueId, payload),

  // --- Org ---
  getOrganization: () => HermesApi.getOrganization(),

  // --- Skills ---
  getSkills: () => HermesApi.getSkills(),

  // --- Enterprise Projects (via PlatformApi) ---
  listProjects: () => PlatformApi.getEnterpriseState().then((r) => r.data.projects),
  createProject: (payload: {
    name: string;
    clientId: string;
    ownerName: string;
    endDate: string;
    budgetBRL: number;
    stage: import('../../../types/platform').ProjectStage;
  }) => PlatformApi.createProject(payload),
  updateProject: (id: string, payload: Record<string, unknown>) =>
    PlatformApi.updateProject(id, payload),

  // --- Enterprise Clients ---
  listClients: () => PlatformApi.getEnterpriseState().then((r) => r.data.clients),
  createClient: (payload: {
    name: string;
    segment: string;
    cnpj: string;
    primaryContact: string;
    email: string;
    phone: string;
    accountManager?: string;
  }) => PlatformApi.createClient(payload),
  updateClient: (id: string, payload: Record<string, unknown>) =>
    PlatformApi.updateClient(id, payload),
};

export function isHermesConnected(status: HermesIntegrationStatus | null | undefined): boolean {
  return Boolean(status?.configured && status?.connected);
}

export function toWorkforceStatus(
  status: HermesIntegrationStatus | null | undefined,
): WorkforceStatus {
  const connected = isHermesConnected(status);
  return {
    connected,
    status: status ?? null,
    error: connected ? null : status?.lastError || 'Runtime Hermes não conectado.',
  };
}

