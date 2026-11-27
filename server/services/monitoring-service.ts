import { hermesGateway } from '../integrations/hermes/index.ts';
import {
  listRuns,
  listActivities,
  appendAudit,
} from '../persistence.ts';
import { getOrchestratorStatus } from './execution-orchestrator.ts';

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
    alerts,
  };
}

export function checkQueueHealth(): {
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

export function recordAuditEvent(
  actor: string,
  action: string,
  target: string,
  origin: 'Plataforma' | 'Hermes Adapter' | 'Segurança' = 'Plataforma',
): void {
  appendAudit(actor, action, target, origin);
}

export { listRuns };
