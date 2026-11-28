import { hermesGateway } from '../integrations/hermes/index.ts';
import {
  listRuns,
  listActivities,
  appendAudit,
} from '../persistence.ts';
import { getOrchestratorStatus } from './execution-orchestrator.ts';
import { existsSync } from 'node:fs';
import { runCommandSafe } from '../integrations/hermes/cliRunner.ts';
import { HERMES_CLI } from '../integrations/hermes/domainCache.ts';

export interface OperationalOverview {
  system: {
    status: 'ok' | 'degraded' | 'error';
    hermes: { configured: boolean; connected: boolean; label: string };
    uptimeMs: number;
  };
  queue: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    blocked: number;
    orchestratorRunning: boolean;
  };
  agents: {
    total: number;
    active: number;
    blocked: number;
  };
  activity: {
    last24h: number;
    total: number;
  };
  costs: {
    totalCents: number;
    currency: string;
    last24hCents: number;
  };
  alerts: Array<{
    severity: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}

const startTime = Date.now();

export function getOperationalOverview(): OperationalOverview {
  const hc = hermesGateway.getStatus();
  const queue = getOrchestratorStatus();
  const runs = listRuns();
  const activities = listActivities(1000);
  const now = new Date();
  const last24h = activities.filter((a) => {
    const d = new Date(a.timestamp);
    return now.getTime() - d.getTime() < 24 * 60 * 60 * 1000;
  }).length;

  // Calcula custos totais das execuções registradas
  const totalCents = runs.reduce((sum, r) => sum + (r.costCents ?? 0), 0);
  const last24hCents = runs.reduce((sum, r) => {
    const d = new Date(r.created_at ?? r.createdAt ?? '');
    return sum + (now.getTime() - d.getTime() < 24 * 60 * 60 * 1000 ? r.costCents ?? 0 : 0);
  }, 0);

  const alerts: OperationalOverview['alerts'] = [];
  if (!hc.connected) {
    alerts.push({
      severity: 'error',
      message: 'Hermes desconectado — execução de agentes comprometida',
      timestamp: now.toISOString(),
    });
  }
  if (queue.failed > 0) {
    alerts.push({
      severity: 'warning',
      message: `${queue.failed} tarefa(s) com falha na fila de execução`,
      timestamp: now.toISOString(),
    });
  }
  if (queue.blocked > 0 && queue.pending === 0) {
    alerts.push({
      severity: 'info',
      message: `${queue.blocked} tarefa(s) bloqueada(s) por dependência sem itens pendentes`,
      timestamp: now.toISOString(),
    });
  }
  if (totalCents > 0) {
    alerts.push({
      severity: 'info',
      message: `Custo total acumulado: R$ ${(totalCents / 100).toFixed(2)}`,
      timestamp: now.toISOString(),
    });
  }

  return {
    system: {
      status: hc.connected ? 'ok' : 'degraded',
      hermes: {
        configured: hc.configured,
        connected: hc.connected,
        label: hc.connectionLabel,
      },
      uptimeMs: Date.now() - startTime,
    },
    queue,
    agents: {
      total: hc.availableCapabilities.length,
      active: hc.connected ? 1 : 0,
      blocked: hc.connected ? 0 : 1,
    },
    activity: {
      last24h,
      total: activities.length,
    },
    costs: {
      totalCents,
      currency: 'BRL',
      last24hCents,
    },
    alerts,
  };
}

export async function checkQueueHealth(): {
  healthy: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const queue = getOrchestratorStatus();
  const hc = hermesGateway.getStatus();

  if (!hc.connected) issues.push('Hermes desconectado');
  if (queue.failed > 0) issues.push(`${queue.failed} tarefa(s) falhada(s)`);
  if (queue.blocked > 0 && queue.pending === 0) {
    issues.push('Tarefa(s) bloqueada(s) sem itens pendentes para resolver dependências');
  }

  return { healthy: issues.length === 0, issues };
}

export async function checkHermesHealth(): Promise<{
  healthy: boolean;
  cliAvailable: boolean;
  cliResponsive: boolean;
  lastError?: string;
}> {
  const cliAvailable = existsSync(HERMES_CLI);
  let cliResponsive = false;
  let lastError: string | undefined;

  if (cliAvailable) {
    try {
      const result = await runCommandSafe(HERMES_CLI, ['profile', 'list'], {
        timeoutMs: 8000,
      });
      if (result.error) {
        lastError = result.error.message;
      } else {
        cliResponsive = true;
      }
    } catch (err: any) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    healthy: cliAvailable && cliResponsive,
    cliAvailable,
    cliResponsive,
    lastError,
  };
}

export function recordAuditEvent(
  actor: string,
  action: string,
  target: string,
  origin: 'Plataforma' | 'Hermes Adapter' | 'Segurança' = 'Plataforma',
): void {
  appendAudit(actor, action, target, origin);
}

export { listRuns };
