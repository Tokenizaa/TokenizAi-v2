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
  | 'ia-inbox'
  | 'ia-chat'
  | 'ia-agentes'
  | 'ia-agente-detalhe'
  | 'ia-equipes'
  | 'ia-tarefas'
  | 'ia-tarefa-detalhe'
  | 'ia-execucoes'
  | 'ia-rotinas'
  | 'ia-aprovacoes'
  | 'ia-aprovacao-detalhe'
  | 'ia-custos'
  | 'ia-metas'
  | 'ia-skills'
  | 'ia-conectores'
  | 'ia-atividade'
  | 'ia-artefatos'
  | 'biblioteca'
  | 'admin';

export type NavGroup =
  | 'Empresa'
  | 'Portfólio'
  | 'Mercado'
  | 'Gestão'
  | 'Operações de IA'
  | 'Conhecimento'
  | 'Sistema';

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
  hermesProjectId?: string;
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
  origin: 'Plataforma' | 'Hermes Adapter' | 'Segurança';
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
  runs: RunRecord[];
  activities: ActivityRecord[];
}

export interface RunRecord {
  id: string;
  agentId?: string;
  agentName?: string;
  taskId?: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
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

export interface ActivityRecord {
  id: string;
  timestamp: string;
  actorName: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  summary?: string;
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

/* --- Novos DTOs para endpoints oficiais do Paperclip ainda não expostos --- */

/* Legacy/Optional helper types kept cleanly if referenced by Agency library */
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

/* Hermes Native Integration Types */
export type HermesConnectionStatus =
  | 'not_configured'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface HermesCapability {
  key: string;
  label: string;
  domain: string;
  route: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  available: boolean;
  requiredPermission: string;
  errorMessage: string | null;
  availableInVersion?: string;
  authState?: string;
  implementationState?: string;
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
  avatarUrl?: string;
  team?: string;
  children?: HermesBotDto[];
  lifecycleState?: string;
  adapterType?: string;
  budgetMonthlyCents?: number | null;
  spentMonthlyCents?: number | null;
  lastHeartbeatAt?: string;
  updatedAt?: string;
  lifecycleVersion?: string | number | null;
  lifecycleError?: string | null;
  reportsTo?: string | null;
  chainOfCommand?: Array<Record<string, unknown>>;
  runtimeConfig?: Record<string, unknown>;
  permissions?: Record<string, unknown> | string[];
  access?: Record<string, unknown>;
  runtimeState?: Record<string, unknown> | null;
}

export interface HermesChatThreadDto {
  id: string;
  agentId: string;
  agentRef?: string;
  agentName: string;
  agentRole?: string;
  title?: string;
  unreadCount?: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  canSend?: boolean;
  conversationAgentId?: string;
  conversationState?: string;
  status?: string;
}

export interface HermesChatMessageDto {
  id: string;
  threadId: string;
  authorType: 'user' | 'agent';
  authorName: string;
  body: string;
  createdAt: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface HermesRunDto {
  id: string;
  agentId?: string;
  agentName?: string;
  model?: string;
  provider?: string;
  taskId?: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  resultSummary?: string;
  errorMessage?: string | null;
  costCents?: number | null;
  currency?: string;
  durationMs?: number | null;
  triggerSource?: string | null;
  issueIdentifier?: string | null;
  totalTokens?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  logs?: string[];
  events?: Array<Record<string, unknown>>;
}

export interface HermesRoutineDto {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  agentId?: string | null;
  agentName?: string;
  cron?: string;
  triggers?: Array<Record<string, unknown>>;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
  projectId?: string | null;
}

export interface HermesCostSummaryDto {
  totalCostCents: number;
  currency: string;
  budgetMonthlyCents?: number | null;
  dataQuality?: {
    coveragePercent?: number;
    unpricedRunsCount?: number;
  };
  byAgent?: Array<{ agentId: string; agentName: string; model?: string; costCents: number; runsCount?: number }>;
  byProject?: Array<{ projectId: string; projectName: string; costCents: number; issuesCount?: number }>;
  eventCount?: number;
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
  issueId?: string | null;
  actorType?: string;
  totalCount?: number;
  deskBadgeCount?: number;
  title?: string;
  source?: string;
  status?: string;
  assigneeAgentName?: string;
  description?: string;
  countsBySourceKind?: Record<string, number>;
}

export interface HermesIssueDto {
  id: string;
  identifier?: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  assigneeAgentId?: string | null;
  assigneeAgentName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  unresolvedBlockerCount?: number;
  blockerReason?: string;
  goalId?: string | null;
  blockedByIssueIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface HermesApprovalDto {
  id: string;
  type?: string;
  title: string;
  description?: string;
  status: string;
  requestedByName?: string | null;
  requestedByAgentId?: string | null;
  createdAt?: string;
  approverUserId?: string | null;
  issueId?: string | null;
  decisionNote?: string | null;
  decidedAt?: string | null;
}

export interface HermesProjectDto {
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

export interface HermesGoalDto {
  id: string;
  title: string;
  description?: string;
  status?: string;
  level?: string;
  progressPercent?: number | null;
  ownerAgentId?: string | null;
  parentGoalId?: string | null;
}

export interface HermesSkillDto {
  id: string;
  name: string;
  key?: string;
  slug?: string;
  title?: string;
  description?: string;
  version?: string;
  status?: string;
  installedAt?: string | null;
  source?: string;
  mediaKind?: string;
  authorName?: string;
  previewText?: string | null;
  issueId?: string | null;
  sizeBytes?: number | null;
  url?: string | null;
  folderPath?: string | null;
}

export interface HermesOverviewBundle {
  status: HermesIntegrationStatus;
  bots: HermesBotDto[];
  agents?: HermesBotDto[];
  tasks: HermesTaskDto[];
  issues: HermesIssueDto[];
  runs: HermesRunDto[];
  projects: HermesProjectDto[];
  goals: HermesGoalDto[];
  approvals: HermesApprovalDto[];
  routines: HermesRoutineDto[];
  costs: HermesCostSummaryDto | null;
  activity: HermesActivityDto[];
  chats: HermesChatThreadDto[];
  skills: HermesSkillDto[];
};

// ============================================================================
export interface HermesAttachmentDto {
  id: string;
  filename: string;
  contentType?: string;
  sizeBytes?: number;
  url?: string | null;
}



