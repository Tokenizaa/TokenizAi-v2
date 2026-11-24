import type { HermesIntegrationStatus, HermesCapability } from './types.ts';
import { HermesIntegrationError } from './errors.ts';

interface HermesConfig {
  configured: boolean;
  connected: boolean;
  connectionStatus: string;
  connectionLabel: string;
  lastError: string | null;
}

export class HermesGateway {
  private connected = false;
  private lastError: string | null = null;
  private capabilities: HermesCapability[] = [];

  getStatus(): HermesIntegrationStatus {
    return {
      configured: true,
      connected: this.connected,
      availableCapabilities: this.capabilities,
      lastError: this.lastError,
      connectionStatus: this.connected ? 'connected' : 'disconnected',
      connectionLabel: this.connected ? 'Conectado' : 'Desconectado',
    };
  }

  async initialize(): Promise<void> {
    try {
      // Verificar se o Hermes CLI está disponível
      const { execSync } = await import('node:child_process');
      try {
        execSync('hermes --version', { stdio: 'pipe' });
        this.connected = true;
        this.lastError = null;
      } catch {
        this.connected = false;
        this.lastError = 'Hermes CLI não encontrado no PATH.';
      }
    } catch (err) {
      this.connected = false;
      this.lastError = err instanceof Error ? err.message : 'Erro ao inicializar Hermes gateway.';
    }

    this.buildCapabilities();
  }

  async refresh(): Promise<HermesIntegrationStatus> {
    await this.initialize();
    return this.getStatus();
  }

  private buildCapabilities(): void {
    this.capabilities = [
      { key: 'agents:read', label: 'Consultar agentes (Bots)', domain: 'agents', route: '/api/hermes/agents', method: 'GET', available: this.connected, requiredPermission: 'read', errorMessage: null },
      { key: 'agents:manage', label: 'Gerenciar agentes (criar/atualizar/remover)', domain: 'agents', route: '/api/hermes/agents', method: 'POST', available: this.connected, requiredPermission: 'admin:integration', errorMessage: null },
      { key: 'chats:read', label: 'Ler conversas de chat', domain: 'chats', route: '/api/hermes/chats', method: 'GET', available: this.connected, requiredPermission: 'read', errorMessage: null },
      { key: 'chats:write', label: 'Enviar mensagens no chat', domain: 'chats', route: '/api/hermes/chats/:agentRef', method: 'POST', available: this.connected, requiredPermission: 'paperclip:ops:write', errorMessage: null },
      { key: 'tasks:read', label: 'Consultar tarefas (kanban)', domain: 'tasks', route: '/api/hermes/tasks', method: 'GET', available: this.connected, requiredPermission: 'read', errorMessage: null },
      { key: 'tasks:write', label: 'Criar e atualizar tarefas', domain: 'tasks', route: '/api/hermes/tasks', method: 'POST', available: this.connected, requiredPermission: 'paperclip:ops:write', errorMessage: null },
      { key: 'runs:read', label: 'Consultar execuções de subagentes', domain: 'runs', route: '/api/hermes/runs', method: 'GET', available: this.connected, requiredPermission: 'read', errorMessage: null },
      { key: 'routines:read', label: 'Consultar rotinas (cron)', domain: 'routines', route: '/api/hermes/routines', method: 'GET', available: this.connected, requiredPermission: 'read', errorMessage: null },
      { key: 'routines:manage', label: 'Criar e gerenciar rotinas', domain: 'routines', route: '/api/hermes/routines', method: 'POST', available: this.connected, requiredPermission: 'paperclip:ops:write', errorMessage: null },
      { key: 'approvals:read', label: 'Consultar aprovações', domain: 'approvals', route: '/api/hermes/approvals', method: 'GET', available: this.connected, requiredPermission: 'read', errorMessage: null },
      { key: 'approvals:manage', label: 'Aprovar/rejeitar/solicitar revisão', domain: 'approvals', route: '/api/hermes/approvals/:id', method: 'POST', available: this.connected, requiredPermission: 'approvals:decide', errorMessage: null },
      { key: 'costs:read', label: 'Consultar custos e orçamentos', domain: 'costs', route: '/api/hermes/costs', method: 'GET', available: this.connected, requiredPermission: 'read', errorMessage: null },
      { key: 'activity:read', label: 'Consultar atividade e auditoria', domain: 'activity', route: '/api/hermes/activity', method: 'GET', available: this.connected, requiredPermission: 'read', errorMessage: null },
      { key: 'org:read', label: 'Consultar organograma (sections)', domain: 'org', route: '/api/hermes/org', method: 'GET', available: this.connected, requiredPermission: 'read', errorMessage: null },
      { key: 'skills:read', label: 'Consultar skills instaladas', domain: 'skills', route: '/api/hermes/skills', method: 'GET', available: this.connected, requiredPermission: 'read', errorMessage: null },
    ];
  }
}

export const hermesGateway = new HermesGateway();
export { HermesIntegrationError } from './errors.ts';
