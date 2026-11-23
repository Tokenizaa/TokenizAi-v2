export type PaperclipConnectionStatus =
  | 'not_configured'
  | 'awaiting_credentials'
  | 'connecting'
  | 'connected'
  | 'authenticated_no_company'
  | 'partially_available'
  | 'forbidden'
  | 'instance_unavailable'
  | 'communication_error'
  | 'invalid_credentials';

export type CapabilityAuthState = 'authenticated' | 'unauthenticated' | 'forbidden' | 'unknown';
export type CapabilityImplState = 'implemented' | 'partial' | 'unavailable';

export interface PaperclipCapability {
  key: string;
  label: string;
  domain:
    | 'agents'
    | 'artifacts'
    | 'attention'
    | 'chat'
    | 'issues'
    | 'inbox'
    | 'org'
    | 'projects'
    | 'routines'
    | 'runs'
    | 'approvals'
    | 'costs'
    | 'activity'
    | 'attachments'
    | 'skills';
  route: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  availableInVersion: boolean | null;
  requiredPermission: string;
  authState: CapabilityAuthState;
  implementationState: CapabilityImplState;
  errorMessage: string | null;
}

export interface PaperclipIntegrationStatus {
  configured: boolean;
  reachable: boolean;
  authenticated: boolean;
  companyId: string | null;
  companyName: string | null;
  serverVersion: string | null;
  openApiAvailable: boolean;
  lastSuccessfulSync: string | null;
  lastError: string | null;
  connectionStatus: PaperclipConnectionStatus;
  connectionLabel: string;
  requestTimeoutMs: number;
  syncIntervalMs: number;
  host: string | null;
  availableCapabilities: PaperclipCapability[];
}

export interface PaperclipAgentDto {
  id: string;
  name: string;
  role: string;
  title?: string;
  reportsTo?: string | null;
  capabilities?: string[];
  appearance?: Record<string, unknown>;
  avatarUrl?: string | null;
  adapterType?: string;
  status: string;
  lifecycleState?: string;
  lifecycleError?: string | null;
  lifecycleVersion?: string | number | null;
  budgetMonthlyCents?: number | null;
  spentMonthlyCents?: number | null;
  permissions?: Record<string, unknown> | string[];
  runtimeConfig?: Record<string, unknown>;
  chainOfCommand?: Array<Record<string, unknown>>;
  access?: Record<string, unknown>;
  updatedAt?: string;
  lastHeartbeatAt?: string;
  runtimeState?: Record<string, unknown> | null;
}

export interface PaperclipOrgNodeDto {
  id: string;
  name: string;
  title?: string;
  role?: string;
  status?: string;
  reportsTo?: string | null;
  avatarUrl?: string | null;
  team?: string | null;
  capabilities?: string[];
  children: PaperclipOrgNodeDto[];
}

export interface PaperclipChatThreadDto {
  id: string;
  agentId: string;
  agentRef: string;
  agentName: string;
  agentRole?: string;
  agentAvatarUrl?: string | null;
  issueId?: string;
  issueIdentifier?: string;
  title?: string;
  unreadCount?: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  ownerUserId?: string;
  canSend?: boolean;
  raw?: Record<string, unknown>;
}

export interface PaperclipCommentDto {
  id: string;
  issueId?: string;
  authorType?: string;
  authorId?: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  body: string;
  createdAt: string;
  updatedAt?: string;
  linkedIssueIds?: string[];
  attachments?: PaperclipAttachmentDto[];
}

export interface PaperclipAttachmentDto {
  id: string;
  filename: string;
  contentType?: string;
  sizeBytes?: number;
  createdAt?: string;
  uploadedBy?: string;
}

export interface PaperclipIssueDto {
  id: string;
  identifier?: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  assigneeAgentId?: string | null;
  assigneeAgentName?: string | null;
  assigneeUserId?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  goalId?: string | null;
  parentId?: string | null;
  blockedByIssueIds?: string[];
  labels?: Array<{ id?: string; name: string; color?: string }>;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
  activeRun?: Record<string, unknown> | null;
  dependencyReady?: boolean;
  unresolvedBlockerCount?: number;
  originKind?: string;
  originId?: string;
  blockerReason?: string;
}

export interface PaperclipRunDto {
  id: string;
  agentId?: string;
  agentName?: string;
  issueId?: string;
  issueIdentifier?: string;
  status: string;
  triggerSource?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number | null;
  resultSummary?: string;
  errorMessage?: string | null;
  logs?: string[];
  events?: Array<Record<string, unknown>>;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  model?: string | null;
  provider?: string | null;
  costCents?: number | null;
  currency?: string;
  workspaceOps?: Array<Record<string, unknown>>;
}

export interface PaperclipProjectDto {
  id: string;
  name: string;
  description?: string;
  status?: string;
  leadAgentId?: string | null;
  goalIds?: string[];
  targetDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaperclipGoalDto {
  id: string;
  title: string;
  description?: string;
  status?: string;
  level?: string;
  progressPercent?: number | null;
  ownerAgentId?: string | null;
  parentGoalId?: string | null;
}

export interface PaperclipRoutineTriggerDto {
  id: string;
  type: string;
  enabled: boolean;
  schedule?: string;
  cron?: string;
  webhookUrl?: string;
  config?: Record<string, unknown>;
  lastFiredAt?: string | null;
}

export interface PaperclipRoutineDto {
  id: string;
  name: string;
  description?: string;
  status?: string;
  enabled?: boolean;
  agentId?: string | null;
  agentName?: string | null;
  projectId?: string | null;
  triggers: PaperclipRoutineTriggerDto[];
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
}

export interface PaperclipApprovalDto {
  id: string;
  type?: string;
  title: string;
  description?: string;
  status: string;
  requestedByAgentId?: string | null;
  requestedByName?: string | null;
  approverUserId?: string | null;
  issueId?: string | null;
  createdAt?: string;
  decidedAt?: string | null;
  decisionNote?: string | null;
  payload?: Record<string, unknown>;
}

export interface PaperclipCostSummaryDto {
  totalCostCents: number;
  currency: string;
  periodStart?: string;
  periodEnd?: string;
  budgetMonthlyCents?: number | null;
  byAgent?: Array<{
    agentId: string;
    agentName: string;
    costCents: number;
    budgetMonthlyCents?: number | null;
    tokens?: number;
    runsCount?: number;
    model?: string;
  }>;
  byProject?: Array<{
    projectId: string;
    projectName: string;
    costCents: number;
    issuesCount?: number;
  }>;
  dataQuality?: {
    unpricedRunsCount?: number;
    missingCostEventsCount?: number;
    coveragePercent?: number | null;
    notes?: string[];
  } | null;
}

export interface PaperclipActivityDto {
  id: string;
  timestamp: string;
  actorType?: string;
  actorId?: string;
  actorName: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  issueId?: string;
  summary?: string;
  details?: Record<string, unknown>;
}

export interface PaperclipOverviewBundle {
  status: PaperclipIntegrationStatus;
  agents: PaperclipAgentDto[];
  issues: PaperclipIssueDto[];
  runs: PaperclipRunDto[];
  projects: PaperclipProjectDto[];
  goals: PaperclipGoalDto[];
  approvals: PaperclipApprovalDto[];
  routines: PaperclipRoutineDto[];
  costs: PaperclipCostSummaryDto | null;
  activity: PaperclipActivityDto[];
}

/* --- Novos DTOs para endpoints oficiais do Paperclip ainda não expostos --- */

export interface PaperclipArtifactDto {
  id: string;
  source?: string;
  mediaKind?: string;
  title?: string;
  previewText?: string | null;
  description?: string | null;
  issueId?: string | null;
  authorName?: string | null;
  createdAt?: string | null;
  sizeBytes?: number | null;
  contentType?: string | null;
  url?: string | null;
}

export interface PaperclipCompanySkillDto {
  id: string;
  companyId?: string | null;
  folderId?: string | null;
  folderPath?: string | null;
  key?: string | null;
  slug?: string | null;
  name?: string | null;
  description?: string | null;
  version?: string | null;
  status?: string | null;
  installedAt?: string | null;
  source?: string | null;
}

export interface PaperclipInboxItemDto {
  id: string;
  companyId?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  assigneeAgentId?: string | null;
  assigneeAgentName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  goalId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  source?: string | null;
  url?: string | null;
}

export interface PaperclipAttentionDto {
  companyId?: string | null;
  generatedAt?: string | null;
  totalCount?: number | null;
  deskBadgeCount?: number | null;
  countsBySourceKind?: Record<string, number> | null;
  items?: Array<Record<string, unknown>> | null;
}

