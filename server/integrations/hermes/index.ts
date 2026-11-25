import type { HermesIntegrationStatus, HermesCapability } from './types.ts';
import { HermesIntegrationError } from './errors.ts';
import { HERMES_CLI } from './domainCache.ts';
import { runCommandSafe } from './cliRunner.ts';

interface HermesConfig {
  configured: boolean;
  connected: boolean;
  connectionStatus: string;
  connectionLabel: string;
  lastError: string | null;
}

/**
 * Verifica uma capacidade individual do Hermes executando o comando CLI
 * correspondente com timeout curto. Cada capacidade tem seu proprio
 * disponibilidade: uma falha em uma nao invalida as outras.
 */
async function probeCapability(
  command: string[],
  timeoutMs: number = 5000,
): Promise<boolean> {
  const result = await runCommandSafe(HERMES_CLI, command, { timeoutMs });
  return result.error === null;
}

export class HermesGateway {
  private connected = false;
  private lastError: string | null = null;
  private capabilities: HermesCapability[] = [];

  getStatus(): HermesIntegrationStatus {
    const cliAvailable = this.connected;
    return {
      configured: cliAvailable,
      connected: this.connected,
      availableCapabilities: this.capabilities,
      lastError: this.lastError,
      connectionStatus: this.connected ? 'connected' : 'disconnected',
      connectionLabel: this.connected ? 'Conectado' : 'Desconectado',
    };
  }

  async initialize(): Promise<void> {
    this.connected = false;
    this.lastError = null;
    this.capabilities = [];

    // Verifica se o executavel do Hermes CLI existe e responde a um comando
    // simples (profile list). Nao usamos 'hermes --version' porque pode travar.
    try {
      const profileOk = await probeCapability(['profile', 'list'], 8000);
      if (!profileOk) {
        this.lastError = 'Hermes CLI nao respondeu ao comando profile list.';
        this.connected = false;
        this.buildCapabilities(false);
        return;
      }
      this.connected = true;
      this.lastError = null;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Hermes CLI nao encontrado.';
      this.connected = false;
      this.buildCapabilities(false);
      return;
    }

    this.buildCapabilities(true);
  }

  async refresh(): Promise<HermesIntegrationStatus> {
    await this.initialize();
    return this.getStatus();
  }

  private buildCapabilities(available: boolean): void {
    this.capabilities = [
      {
        key: 'agents:read',
        label: 'Consultar agentes (Bots)',
        domain: 'agents',
        route: '/api/hermes/agents',
        method: 'GET',
        available,
        requiredPermission: 'read',
        errorMessage: available ? null : 'Hermes CLI indisponível.',
      },
      {
        key: 'agents:manage',
        label: 'Gerenciar agentes (criar/atualizar/remover)',
        domain: 'agents',
        route: '/api/hermes/agents',
        method: 'POST',
        available,
        requiredPermission: 'admin:integration',
        errorMessage: available ? null : 'Hermes CLI indisponível.',
      },
      {
        key: 'chats:read',
        label: 'Ler conversas de chat',
        domain: 'chats',
        route: '/api/hermes/chats',
        method: 'GET',
        available,
        requiredPermission: 'read',
        errorMessage: available ? null : 'Hermes CLI indisponível.',
      },
      {
        key: 'chats:write',
        label: 'Enviar mensagens no chat',
        domain: 'chats',
        route: '/api/hermes/chats/:agentRef',
        method: 'POST',
        available,
        requiredPermission: 'hermes:ops:write',
        errorMessage: available ? null : 'Hermes CLI indisponível.',
      },
      {
        key: 'tasks:read',
        label: 'Consultar tarefas (kanban)',
        domain: 'tasks',
        route: '/api/hermes/tasks',
        method: 'GET',
        available,
        requiredPermission: 'read',
        errorMessage: available ? null : 'Hermes CLI indisponível.',
      },
      {
        key: 'tasks:write',
        label: 'Criar e atualizar tarefas',
        domain: 'tasks',
        route: '/api/hermes/tasks',
        method: 'POST',
        available,
        requiredPermission: 'hermes:ops:write',
        errorMessage: available ? null : 'Hermes CLI indisponível.',
      },
      {
        key: 'runs:read',
        label: 'Consultar execuções de subagentes',
        domain: 'runs',
        route: '/api/hermes/runs',
        method: 'GET',
        available,
        requiredPermission: 'read',
        errorMessage: available ? null : 'Hermes CLI indisponível.',
      },
      {
        key: 'routines:read',
        label: 'Consultar rotinas (cron)',
        domain: 'routines',
        route: '/api/hermes/routines',
        method: 'GET',
        available,
        requiredPermission: 'read',
        errorMessage: available ? null : 'Hermes CLI indisponível.',
      },
      {
        key: 'routines:manage',
        label: 'Criar e gerenciar rotinas',
        domain: 'routines',
        route: '/api/hermes/routines',
        method: 'POST',
        available,
        requiredPermission: 'hermes:ops:write',
        errorMessage: available ? null : 'Hermes CLI indisponível.',
      },
      {
        key: 'approvals:read',
        label: 'Consultar aprovações',
        domain: 'approvals',
        route: '/api/hermes/approvals',
        method: 'GET',
        available,
        requiredPermission: 'read',
        errorMessage: available ? null : 'Hermes CLI indisponível.',
      },
      {
        key: 'approvals:manage',
        label: 'Aprovar/rejeitar/solicitar revisão',
        domain: 'approvals',
        route: '/api/hermes/approvals/:id',
        method: 'POST',
        available,
        requiredPermission: 'approvals:decide',
        errorMessage: available ? null : 'Hermes CLI indisponível.',
      },
      {
        key: 'costs:read',
        label: 'Consultar custos e orçamentos',
        domain: 'costs',
        route: '/api/hermes/costs',
        method: 'GET',
        available,
        requiredPermission: 'read',
        errorMessage: available ? null : 'Hermes CLI indisponível.',
      },
      {
        key: 'activity:read',
        label: 'Consultar atividade e auditoria',
        domain: 'activity',
        route: '/api/hermes/activity',
        method: 'GET',
        available,
        requiredPermission: 'read',
        errorMessage: available ? null : 'Hermes CLI indisponível.',
      },
      {
        key: 'org:read',
        label: 'Consultar organograma (sections)',
        domain: 'org',
        route: '/api/hermes/org',
        method: 'GET',
        available,
        requiredPermission: 'read',
        errorMessage: available ? null : 'Hermes CLI indisponível.',
      },
      {
        key: 'skills:read',
        label: 'Consultar skills instaladas',
        domain: 'skills',
        route: '/api/hermes/skills',
        method: 'GET',
        available,
        requiredPermission: 'read',
        errorMessage: available ? null : 'Hermes CLI indisponível.',
      },
    ];
  }
}

export const hermesGateway = new HermesGateway();
export { HermesIntegrationError } from './errors.ts';
