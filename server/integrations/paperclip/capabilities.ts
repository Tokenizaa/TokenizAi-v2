import { matchesOpenApiRoute, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import type {
  CapabilityAuthState,
  CapabilityImplState,
  PaperclipCapability,
  PaperclipConnectionStatus,
} from './types.ts';

interface CapabilityDefinition {
  key: string;
  label: string;
  domain: PaperclipCapability['domain'];
  route: string;
  altRoutes?: string[];
  method: PaperclipCapability['method'];
  requiredPermission: string;
}

export const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  {
    key: 'agents:read',
    label: 'Consultar agentes',
    domain: 'agents',
    route: '/api/companies/{companyId}/agents',
    method: 'GET',
    requiredPermission: 'Board / Agents Read',
  },
  {
    key: 'agents:manage',
    label: 'Gerenciar ciclo de vida de agentes (wakeup/heartbeat/pause/resume)',
    domain: 'agents',
    route: '/api/agents/{agentId}/wakeup',
    altRoutes: ['/api/agents/{agentId}/heartbeat/invoke', '/api/agents/{agentId}/pause'],
    method: 'POST',
    requiredPermission: 'Board / Agents Manage',
  },
  {
    key: 'agent_chat:read',
    label: 'Ler conversas de Agent Chat',
    domain: 'chat',
    route: '/api/companies/{companyId}/chats',
    altRoutes: ['/api/companies/{companyId}/chats/{agentRef}'],
    method: 'GET',
    requiredPermission: 'Board / Agent Chat Read',
  },
  {
    key: 'agent_chat:write',
    label: 'Enviar mensagens no Agent Chat',
    domain: 'chat',
    route: '/api/companies/{companyId}/chats/{agentRef}',
    altRoutes: ['/api/issues/{issueId}/comments'],
    method: 'POST',
    requiredPermission: 'Conversation Owner / Chat Write',
  },
  {
    key: 'issues:read',
    label: 'Consultar tarefas e delegações (Issues)',
    domain: 'issues',
    route: '/api/companies/{companyId}/issues',
    method: 'GET',
    requiredPermission: 'Board / Issues Read',
  },
  {
    key: 'issues:write',
    label: 'Criar e atualizar tarefas (Issues)',
    domain: 'issues',
    route: '/api/companies/{companyId}/issues',
    altRoutes: ['/api/issues/{issueId}'],
    method: 'POST',
    requiredPermission: 'Board / Issues Write',
  },
  {
    key: 'runs:read',
    label: 'Consultar execuções e heartbeats',
    domain: 'runs',
    route: '/api/companies/{companyId}/heartbeat-runs',
    method: 'GET',
    requiredPermission: 'Board / Runs Read',
  },
  {
    key: 'runs:cancel',
    label: 'Cancelar execução ativa',
    domain: 'runs',
    route: '/api/heartbeat-runs/{runId}/cancel',
    method: 'POST',
    requiredPermission: 'Board / Runs Manage',
  },
  {
    key: 'org:read',
    label: 'Consultar organograma e hierarquia oficial',
    domain: 'org',
    route: '/api/companies/{companyId}/org',
    method: 'GET',
    requiredPermission: 'Board / Organization Read',
  },
  {
    key: 'projects:read',
    label: 'Consultar projetos operacionais e metas',
    domain: 'projects',
    route: '/api/companies/{companyId}/projects',
    altRoutes: ['/api/companies/{companyId}/goals'],
    method: 'GET',
    requiredPermission: 'Board / Projects & Goals Read',
  },
  {
    key: 'projects:write',
    label: 'Criar e atualizar projetos operacionais e metas',
    domain: 'projects',
    route: '/api/companies/{companyId}/projects',
    altRoutes: ['/api/companies/{companyId}/goals'],
    method: 'POST',
    requiredPermission: 'Board / Projects & Goals Write',
  },
  {
    key: 'routines:read',
    label: 'Consultar rotinas e gatilhos',
    domain: 'routines',
    route: '/api/companies/{companyId}/routines',
    method: 'GET',
    requiredPermission: 'Board / Routines Read',
  },
  {
    key: 'routines:manage',
    label: 'Criar, agendar e executar rotinas',
    domain: 'routines',
    route: '/api/companies/{companyId}/routines',
    altRoutes: ['/api/routines/{routineId}/run'],
    method: 'POST',
    requiredPermission: 'Board / Routines Manage',
  },
  {
    key: 'approvals:read',
    label: 'Consultar central de aprovações e governança',
    domain: 'approvals',
    route: '/api/companies/{companyId}/approvals',
    method: 'GET',
    requiredPermission: 'Board / Approvals Read',
  },
  {
    key: 'approvals:manage',
    label: 'Aprovar, rejeitar ou solicitar revisão',
    domain: 'approvals',
    route: '/api/approvals/{approvalId}/approve',
    altRoutes: ['/api/companies/{companyId}/approvals'],
    method: 'POST',
    requiredPermission: 'Human Approver Authority',
  },
  {
    key: 'costs:read',
    label: 'Consultar custos e qualidade de apuração',
    domain: 'costs',
    route: '/api/companies/{companyId}/costs/summary',
    method: 'GET',
    requiredPermission: 'Board / Costs Read',
  },
  {
    key: 'activity:read',
    label: 'Consultar atividades e auditoria de ações',
    domain: 'activity',
    route: '/api/companies/{companyId}/activity',
    altRoutes: ['/api/companies/{companyId}/audit/agent-actions'],
    method: 'GET',
    requiredPermission: 'Board / Activity & Audit Read',
  },
  {
    key: 'attachments:read',
    label: 'Baixar e listar anexos de conversas e issues',
    domain: 'attachments',
    route: '/api/issues/{issueId}/attachments',
    altRoutes: [
      '/api/companies/{companyId}/issues/{issueId}/attachments',
      '/api/attachments/{attachmentId}/content',
    ],
    method: 'GET',
    requiredPermission: 'Board / Attachments Read',
  },
  {
    key: 'attachments:write',
    label: 'Enviar anexos em conversas e issues',
    domain: 'attachments',
    route: '/api/companies/{companyId}/issues/{issueId}/attachments',
    altRoutes: ['/api/issues/{issueId}/attachments'],
    method: 'POST',
    requiredPermission: 'Board / Attachments Write',
  },
];

export interface RuntimeCapabilityObservation {
  statusCode?: number;
  ok?: boolean;
  message?: string;
  isEntityLookup?: boolean;
}

export function buildCapabilityMatrix(options: {
  configured: boolean;
  reachable: boolean;
  authenticated: boolean;
  openApi: PaperclipOpenApiSpecSummary | null;
  observations: Map<string, RuntimeCapabilityObservation>;
}): PaperclipCapability[] {
  const { configured, reachable, authenticated, openApi, observations } = options;

  return CAPABILITY_DEFINITIONS.map((def) => {
    const obs = observations.get(def.key);
    let availableInVersion: boolean | null = null;

    if (openApi?.available) {
      const candidates = [def.route, ...(def.altRoutes || [])];
      availableInVersion = candidates.some((r) => matchesOpenApiRoute(openApi, def.method, r));
    }

    let authState: CapabilityAuthState = 'unknown';
    if (!configured || !reachable) {
      authState = 'unknown';
    } else if (!authenticated || obs?.statusCode === 401) {
      authState = 'unauthenticated';
    } else if (obs?.statusCode === 403) {
      authState = 'forbidden';
    } else if (authenticated) {
      authState = 'authenticated';
    }

    let implementationState: CapabilityImplState = 'implemented';
    let errorMessage: string | null = null;
    const isEndpointUnavailable404 =
      obs?.statusCode === 404 && !obs?.isEntityLookup && !openApi?.available;

    if (!configured) {
      implementationState = 'unavailable';
      errorMessage = 'Aguardando credenciais do Paperclip no servidor.';
    } else if (availableInVersion === false || isEndpointUnavailable404) {
      implementationState = 'unavailable';
      availableInVersion = false;
      errorMessage = obs?.message || 'Recurso indisponível na versão instalada do Paperclip.';
    } else if (obs?.statusCode === 403) {
      implementationState = 'partial';
      errorMessage = obs.message || 'Sem permissão para este recurso (HTTP 403).';
    } else if (obs?.statusCode === 401) {
      implementationState = 'unavailable';
      errorMessage = obs.message || 'Credencial inválida para este recurso (HTTP 401).';
    } else if (!reachable) {
      implementationState = 'partial';
      errorMessage = 'Instância Paperclip inacessível no momento.';
    }

    return {
      key: def.key,
      label: def.label,
      domain: def.domain,
      route: def.route,
      method: def.method,
      availableInVersion,
      requiredPermission: def.requiredPermission,
      authState,
      implementationState,
      errorMessage,
    };
  });
}

export const CONNECTION_STATUS_LABELS: Record<PaperclipConnectionStatus, string> = {
  not_configured: 'Não configurado',
  awaiting_credentials: 'Aguardando credenciais',
  connecting: 'Conectando',
  connected: 'Conectado',
  authenticated_no_company: 'Autenticado, mas sem empresa selecionada',
  partially_available: 'Conectado com recursos parcialmente disponíveis',
  forbidden: 'Sem permissão para determinado recurso',
  instance_unavailable: 'Instância indisponível',
  communication_error: 'Erro de comunicação',
  invalid_credentials: 'Credencial inválida',
};

export function resolveConnectionStatus(options: {
  configured: boolean;
  partiallyConfigured: boolean;
  connecting: boolean;
  reachable: boolean;
  authenticated: boolean;
  companyId: string | null;
  errorKind: string | null;
  capabilities: PaperclipCapability[];
}): PaperclipConnectionStatus {
  if (options.connecting) return 'connecting';
  if (!options.configured) {
    return options.partiallyConfigured ? 'awaiting_credentials' : 'awaiting_credentials';
  }
  if (options.errorKind === 'invalid_credentials') return 'invalid_credentials';
  if (!options.reachable) {
    return options.errorKind === 'communication_error' ? 'communication_error' : 'instance_unavailable';
  }
  if (!options.authenticated) return 'invalid_credentials';
  if (!options.companyId) return 'authenticated_no_company';

  const hasForbidden = options.capabilities.some((c) => c.authState === 'forbidden');
  const hasUnavailable = options.capabilities.some((c) => c.availableInVersion === false);
  if (hasForbidden && options.errorKind === 'forbidden') return 'forbidden';
  if (hasForbidden || hasUnavailable) return 'partially_available';

  return 'connected';
}
