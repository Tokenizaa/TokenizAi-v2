import type {
  HermesBotDto,
  HermesRunDto,
  HermesProjectDto,
  HermesGoalDto,
  HermesRoutineDto,
  HermesActivityDto,
  HermesCostSummaryDto,
  HermesChatThreadDto,
  HermesChatMessageDto,
  HermesAttachmentDto,
  HermesIntegrationStatus,
} from '../../types/platform';

export type AIDomain = 'work' | 'org' | 'governance';

export interface WorkforceStatus {
  connected: boolean;
  status: HermesIntegrationStatus | null;
  error: string | null;
}

export interface AgentFilter {
  q: string;
  status: string;
  adapter: string;
}

export interface TaskFilter {
  q: string;
  status: string;
  priority: string;
  assigneeAgentId: string | null;
  projectId: string | null;
}

export interface RoutineFilter {
  q: string;
  enabled: string;
}

export interface ApprovalFilter {
  q: string;
  status: string;
}

export interface ActivityFilter {
  q: string;
  actorType: string;
}

export interface PageMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface Paged<T> {
  data: T[];
  meta: PageMeta;
}

export type AgentTab = 'geral' | 'competencias' | 'hierarquia' | 'tarefas' | 'execucoes' | 'runtime' | 'permissoes';

export type TaskTab = 'detalhes' | 'comentarios' | 'execucoes' | 'anexos' | 'interacoes';

export type ProjectTab = 'detalhes' | 'agentes' | 'tarefas' | 'metas';

export interface NavBreadcrumb {
  label: string;
  href?: string;
}
