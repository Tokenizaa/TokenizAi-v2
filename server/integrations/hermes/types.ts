export type HermesConnectionStatus =
  | 'not_configured'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface HermesCapability {
  key: string;
  label: string;
  domain:
    | 'agents'
    | 'chats'
    | 'tasks'
    | 'runs'
    | 'routines'
    | 'approvals'
    | 'costs'
    | 'activity'
    | 'org'
    | 'skills'
    | 'artifacts'
    | 'inbox'
    | 'attention';
  route: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  available: boolean;
  requiredPermission: string;
  errorMessage: string | null;
}

export interface HermesIntegrationStatus {
  configured: boolean;
  connected: boolean;
  availableCapabilities: HermesCapability[];
  lastError: string | null;
  connectionStatus: HermesConnectionStatus;
  connectionLabel: string;
}

export interface HermesBotDto {
  id: string;
  name: string;
  title?: string;
  role?: string;
  profileName?: string;
  model?: string;
  division?: string;
  description?: string;
  capabilities?: string[];
  status: string;
  createdAt?: string;
  lastActivityAt?: string | null;
}

export interface HermesChatThreadDto {
  id: string;
  agentId: string;
  agentName: string;
  agentRole?: string;
  title?: string;
  unreadCount?: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  canSend?: boolean;
}

export interface HermesChatMessageDto {
  id: string;
  threadId: string;
  authorType: 'user' | 'agent';
  authorName: string;
  body: string;
  createdAt: string;
  attachments?: HermesAttachmentDto[];
}

export interface HermesTaskDto {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  assigneeAgentId?: string | null;
  assigneeAgentName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  parentId?: string | null;
  blockedByIssueIds?: string[];
  labels?: Array<{ id?: string; name: string; color?: string }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface HermesRunDto {
  id: string;
  agentId?: string;
  agentName?: string;
  taskId?: string;
  taskIdentifier?: string;
  status: string;
  triggerSource?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number | null;
  resultSummary?: string;
  errorMessage?: string | null;
  logs?: string[];
  costCents?: number | null;
  currency?: string;
}

export interface HermesRoutineDto {
  id: string;
  name: string;
  description?: string;
  status?: string;
  enabled?: boolean;
  agentId?: string | null;
  agentName?: string | null;
  cron?: string;
  triggerType?: string;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
}

export interface HermesApprovalDto {
  id: string;
  type?: string;
  title: string;
  description?: string;
  status: string;
  requestedByAgentId?: string | null;
  requestedByName?: string | null;
  approverUserId?: string | null;
  createdAt?: string;
  decidedAt?: string | null;
  decisionNote?: string | null;
}

export interface HermesCostSummaryDto {
  totalCostCents: number;
  currency: string;
  budgetMonthlyCents?: number | null;
  byAgent?: Array<{
    agentId: string;
    agentName: string;
    costCents: number;
    runsCount?: number;
  }>;
}

export interface HermesActivityDto {
  id: string;
  timestamp: string;
  actorName: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  summary?: string;
}

export interface HermesAttachmentDto {
  id: string;
  filename: string;
  contentType?: string;
  sizeBytes?: number;
  createdAt?: string;
}

export interface HermesSkillDto {
  id: string;
  name: string;
  description?: string;
  version?: string;
  status?: string;
  installedAt?: string | null;
}

export interface HermesOverviewBundle {
  status: HermesIntegrationStatus;
  bots: HermesBotDto[];
  tasks: HermesTaskDto[];
  runs: HermesRunDto[];
  routines: HermesRoutineDto[];
  approvals: HermesApprovalDto[];
  costs: HermesCostSummaryDto | null;
  activity: HermesActivityDto[];
  skills: HermesSkillDto[];
  chats: HermesChatThreadDto[];
}
