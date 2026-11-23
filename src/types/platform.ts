export type NavSectionId =
  | 'executivo'
  | 'projetos'
  | 'clientes'
  | 'comercial'
  | 'produtos'
  | 'assinaturas'
  | 'financeiro'
  | 'relatorios'
  | 'ia-visao'
  | 'ia-chat'
  | 'ia-agentes'
  | 'ia-equipes'
  | 'ia-tarefas'
  | 'ia-execucoes'
  | 'ia-rotinas'
  | 'ia-aprovacoes'
  | 'ia-custos'
  | 'biblioteca'
  | 'admin';

export type NavGroup =
  | 'Gestão Empresarial'
  | 'Operações de IA'
  | 'Biblioteca'
  | 'Administração';

export type ProjectStage = 'Descoberta' | 'Em Execução' | 'Revisão' | 'Entregue';

export interface ProjectDeliverable {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  done: boolean;
}

export interface ProjectActivity {
  id: string;
  author: string;
  date: string;
  summary: string;
}

export interface ProjectRecord {
  id: string;
  code: string;
  name: string;
  clientId: string;
  clientName: string;
  stage: ProjectStage;
  ownerName: string;
  ownerAvatar?: string;
  startDate: string;
  endDate: string;
  progress: number;
  budgetBRL: number;
  spentBRL: number;
  paperclipProjectId?: string;
  paperclipProjectName?: string;
  deliverables: ProjectDeliverable[];
  activities: ProjectActivity[];
}

export type ClientStatus = 'Ativo' | 'Em Implantação' | 'Em Risco' | 'Inativo';

export interface ClientInteraction {
  id: string;
  date: string;
  channel: 'Reunião' | 'E-mail' | 'Proposta' | 'Suporte';
  author: string;
  note: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  segment: string;
  cnpj: string;
  primaryContact: string;
  email: string;
  phone: string;
  accountManager: string;
  status: ClientStatus;
  mrrBRL: number;
  ltvBRL: number;
  since: string;
  products: string[];
  interactions: ClientInteraction[];
}

export type DealStage = 'Prospecção' | 'Qualificação' | 'Proposta' | 'Negociação' | 'Ganho' | 'Perdido';

export interface DealRecord {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  stage: DealStage;
  valueBRL: number;
  probability: number;
  ownerName: string;
  expectedClose: string;
  nextStep: string;
  notes: string[];
}

export type ProductCategory = 'Software SaaS' | 'Automação IA' | 'Consultoria' | 'Suporte Gerenciado';

export interface ProductRecord {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  billingModel: 'Recorrente Mensal' | 'Recorrente Anual' | 'Projeto Fechado' | 'Hora Técnica';
  priceBRL: number;
  marginPercent: number;
  activeClients: number;
  status: 'Ativo' | 'Em Revisão' | 'Inativo';
  description: string;
}

export type SubscriptionStatus = 'Ativa' | 'Inadimplente' | 'Em Teste' | 'Cancelada';

export interface SubscriptionPayment {
  id: string;
  date: string;
  amountBRL: number;
  method: 'Pix' | 'Boleto' | 'Cartão Corporativo';
  status: 'Pago' | 'Pendente' | 'Falhou';
}

export interface SubscriptionRecord {
  id: string;
  clientId: string;
  clientName: string;
  planName: string;
  cycle: 'Mensal' | 'Anual';
  mrrBRL: number;
  status: SubscriptionStatus;
  nextBillingDate: string;
  overdueDays: number;
  payments: SubscriptionPayment[];
}

export type FinanceEntryType = 'Receber' | 'Pagar';
export type FinanceEntryStatus = 'Liquidado' | 'Agendado' | 'Em Atraso';

export interface FinanceEntry {
  id: string;
  date: string;
  description: string;
  counterparty: string;
  category: 'Assinaturas' | 'Projetos' | 'Infraestrutura Cloud' | 'Operação IA' | 'Folha & Parceiros' | 'Impostos';
  type: FinanceEntryType;
  status: FinanceEntryStatus;
  amountBRL: number;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  trigger: string;
  action: string;
  targetAgentName: string;
  active: boolean;
  runsLast30d: number;
  lastRunAt: string;
}

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  role: 'Diretoria Executiva' | 'Gestor Operacional' | 'Comercial & CRM' | 'Financeiro' | 'Auditor';
  department: string;
  status: 'Ativo' | 'Convidado';
  lastAccess: string;
  avatar?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  origin: 'Plataforma' | 'Paperclip Proxy' | 'Segurança';
}

export interface EnterpriseDataState {
  projects: ProjectRecord[];
  clients: ClientRecord[];
  deals: DealRecord[];
  products: ProductRecord[];
  subscriptions: SubscriptionRecord[];
  financeEntries: FinanceEntry[];
  automations: AutomationWorkflow[];
  users: AdminUserRecord[];
  auditLogs: AuditLogEntry[];
}

/* Paperclip Native Integration Types */
export type DirectorateCode = 'CEO' | 'CCO' | 'CFO' | 'CMO' | 'COO' | 'CPO' | 'CTO';

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

export interface PaperclipCapability {
  key: string;
  label: string;
  domain:
    | 'agents'
    | 'chat'
    | 'issues'
    | 'runs'
    | 'org'
    | 'projects'
    | 'routines'
    | 'approvals'
    | 'costs'
    | 'activity'
    | 'attachments';
  route: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  availableInVersion: boolean | null;
  requiredPermission: string;
  authState: 'authenticated' | 'unauthenticated' | 'forbidden' | 'unknown';
  implementationState: 'implemented' | 'partial' | 'unavailable';
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

export interface PaperclipAttachmentDto {
  id: string;
  filename: string;
  contentType?: string;
  sizeBytes?: number;
  createdAt?: string;
  uploadedBy?: string;
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

/* Legacy/Optional helper types kept cleanly if referenced by Agency library */
export interface PaperclipDirectorate {
  code: DirectorateCode;
  title: string;
  area: string;
  directorName: string;
  directorKind: 'Humano' | 'Agente Executivo';
  responsibilities: string[];
  subordinateTeams: string[];
}


/* Agency Agents Library Types */
export type SpecialistDivision =
  | 'Engenharia de Software'
  | 'Inteligência Artificial & ML'
  | 'Arquitetura & Cloud'
  | 'Segurança & AppSec'
  | 'Dados & Analytics'
  | 'Produto & Estratégia'
  | 'Design & UX'
  | 'Qualidade & QA'
  | 'Operações & SRE'
  | 'Finanças & Controladoria'
  | 'Comercial & Revenue Ops'
  | 'Governança & Jurídico';

export interface AgencySpecialist {
  id: string;
  slug: string;
  code: string;
  name: string;
  division: SpecialistDivision;
  archetype: string;
  summary: string;
  competencies: string[];
  knowledgeAreas: string[];
  skills: string[];
  tools: string[];
  runbook: string[];
  limitations: string[];
  recommendedAdapter: string;
}
