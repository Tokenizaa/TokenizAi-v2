import { PaperclipApi } from '../../../services/api';
import type { PaperclipIntegrationStatus } from '../../../types/platform';
import type { WorkforceStatus } from '../types';

/**
 * Camada de serviço da Força de Trabalho IA.
 *
 * Toda comunicação com o Paperclip passa pelo backend da TokenizAi
 * (src/services/api.ts → rotas /api/paperclip/* → PaperclipGateway → API do Paperclip).
 * O navegador nunca acessa a API operacional do Paperclip diretamente.
 */
export const paperclipService = {
  /** Status da integração e matriz de capacidades. */
  getStatus: () => PaperclipApi.getStatus(),
  /** Refresh da conexão com a instância Paperclip. */
  refreshConnection: () => PaperclipApi.refreshConnection(),
  /** Bundle consolidado para dashboards / visões gerais. */
  getOverviewBundle: () => PaperclipApi.getOverviewBundle(),

  // --- Agents ---
  listAgents: () => PaperclipApi.listAgents(),
  getAgent: (agentId: string) => PaperclipApi.getAgent(agentId),
  getAgentRuntimeState: (agentId: string) => PaperclipApi.getAgentRuntimeState(agentId),
  wakeupAgent: (agentId: string) => PaperclipApi.wakeupAgent(agentId),
  invokeHeartbeat: (agentId: string) => PaperclipApi.invokeHeartbeat(agentId),
  pauseAgent: (agentId: string) => PaperclipApi.pauseAgent(agentId),
  resumeAgent: (agentId: string) => PaperclipApi.resumeAgent(agentId),
  hireSpecialist: (payload: Record<string, unknown>) =>
    PaperclipApi.hireSpecialist(payload as any),

  // --- Organization ---
  getOrganization: () => PaperclipApi.getOrganization(),

  // --- Agent Chat ---
  listChats: () => PaperclipApi.listChats(),
  getChat: (agentRef: string) => PaperclipApi.getChat(agentRef),
  sendChatMessage: (agentRef: string, payload: { body: string; issueId?: string }) =>
    PaperclipApi.sendChatMessage(agentRef, payload),

  // --- Issues / Tasks ---
  listIssues: (filters?: Record<string, string | number | undefined>) =>
    PaperclipApi.listIssues(filters),
  getIssue: (issueId: string) => PaperclipApi.getIssue(issueId),
  createIssue: (payload: Record<string, unknown>) => PaperclipApi.createIssue(payload),
  updateIssue: (issueId: string, payload: Record<string, unknown>) =>
    PaperclipApi.updateIssue(issueId, payload),
  getIssueComments: (issueId: string) => PaperclipApi.getIssueComments(issueId),
  addIssueComment: (issueId: string, body: string) =>
    PaperclipApi.addIssueComment(issueId, body),
  getIssueRuns: (issueId: string) => PaperclipApi.getIssueRuns(issueId),
  getIssueDocuments: (issueId: string) => PaperclipApi.getIssueDocuments(issueId),
  getIssueAttachments: (issueId: string) => PaperclipApi.getIssueAttachments(issueId),
  uploadIssueAttachment: (issueId: string, payload: Record<string, unknown>) =>
    PaperclipApi.uploadIssueAttachment(issueId, payload as any),
  getIssueInteractions: (issueId: string) => PaperclipApi.getIssueInteractions(issueId),

  // --- Runs ---
  listRuns: (filters?: Record<string, string | number | undefined>) =>
    PaperclipApi.listRuns(filters),
  getRun: (runId: string) => PaperclipApi.getRun(runId),
  getRunEvents: (runId: string) => PaperclipApi.getRunEvents(runId),
  cancelRun: (runId: string) => PaperclipApi.cancelRun(runId),

  // --- Projects & Goals ---
  listProjects: () => PaperclipApi.listProjects(),
  getProject: (projectId: string) => PaperclipApi.getProject(projectId),
  createProject: (payload: Record<string, unknown>) => PaperclipApi.createProject(payload),
  updateProject: (projectId: string, payload: Record<string, unknown>) =>
    PaperclipApi.updateProject(projectId, payload as any),
  listGoals: () => PaperclipApi.listGoals(),
  getGoal: (goalId: string) => PaperclipApi.getGoal(goalId),
  createGoal: (payload: Record<string, unknown>) => PaperclipApi.createGoal(payload),
  updateGoal: (goalId: string, payload: Record<string, unknown>) =>
    PaperclipApi.updateGoal(goalId, payload as any),

  // --- Routines ---
  listRoutines: () => PaperclipApi.listRoutines(),
  getRoutine: (routineId: string) => PaperclipApi.getRoutine(routineId),
  createRoutine: (payload: Record<string, unknown>) => PaperclipApi.createRoutine(payload),
  updateRoutine: (routineId: string, payload: Record<string, unknown>) =>
    PaperclipApi.updateRoutine(routineId, payload as any),
  getRoutineRuns: (routineId: string) => PaperclipApi.getRoutineRuns(routineId),
  runRoutine: (routineId: string) => PaperclipApi.runRoutine(routineId),
  createRoutineTrigger: (routineId: string, payload: Record<string, unknown>) =>
    PaperclipApi.createRoutineTrigger(routineId, payload),
  updateRoutineTrigger: (routineId: string, triggerId: string, payload: Record<string, unknown>) =>
    PaperclipApi.updateRoutineTrigger(routineId, triggerId, payload),

  // --- Approvals ---
  listApprovals: () => PaperclipApi.listApprovals(),
  getApproval: (approvalId: string) => PaperclipApi.getApproval(approvalId),
  createApproval: (payload: Record<string, unknown>) => PaperclipApi.createApproval(payload),
  approveApproval: (approvalId: string, note?: string) =>
    PaperclipApi.approveApproval(approvalId, note),
  rejectApproval: (approvalId: string, note?: string) =>
    PaperclipApi.rejectApproval(approvalId, note),
  requestApprovalRevision: (approvalId: string, note: string) =>
    PaperclipApi.requestApprovalRevision(approvalId, note),

  // --- Costs, Dashboard, Activity ---
  getCostsSummary: () => PaperclipApi.getCostsSummary(),
  getDashboard: () => PaperclipApi.getDashboard(),
  listActivity: (limit?: number) => PaperclipApi.listActivity(limit),
  listAgentActionsAudit: (limit?: number) => PaperclipApi.listAgentActionsAudit(limit),

  // --- Attachments ---
  getAttachmentContentUrl: (attachmentId: string) =>
    PaperclipApi.getAttachmentContentUrl(attachmentId),

  // --- Artifacts, Skills (company), Inbox, Attention ---
  getArtifacts: () => PaperclipApi.getArtifacts(),
  getSkills: () => PaperclipApi.getSkills(),
  getInbox: () => PaperclipApi.getInbox(),
  getAttention: () => PaperclipApi.getAttention(),

  // --- Agent updates ---
  updateAgent: (agentId: string, payload: Record<string, unknown>) =>
    PaperclipApi.updateAgent(agentId, payload),
};

export function isPaperclipConnected(status: PaperclipIntegrationStatus | null | undefined): boolean {
  return Boolean(status?.configured && status?.reachable && status?.authenticated && status?.companyId);
}

export function toWorkforceStatus(
  status: PaperclipIntegrationStatus | null | undefined,
): WorkforceStatus {
  const connected = isPaperclipConnected(status);
  return {
    connected,
    status: status ?? null,
    error: connected ? null : status?.lastError || 'Instância Paperclip não conectada.',
  };
}
