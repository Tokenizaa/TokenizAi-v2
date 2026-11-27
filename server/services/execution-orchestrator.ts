import { runCommandSafe } from '../integrations/hermes/cliRunner.ts';
import { HERMES_CLI } from '../integrations/hermes/domainCache.ts';
import {
  appendAudit,
  createActivity,
} from '../persistence.ts';
import {
  listPendingQueueItems,
  listRunningQueueItems,
  listQueueItems,
  updateQueueItem,
  createQueueItem,
  markRunning,
  markCompleted,
  markFailed,
  addLog,
  addEvidence,
  getQueueItem,
  ExecutionQueueItem,
} from './execution-queue.ts';
import {
  listPendingTransfers,
  interdepartmentRouter,
} from './interdepartment-router.ts';
import type { EnterpriseDataState } from '../../src/types/platform.ts';

let orchestratorInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let maxConcurrentRuns = 3;
let lastAutoPlanAt: string | null = null;

const AUTO_PLAN_INTERVAL_MS = 10 * 60 * 1000; // replaneja a cada 10 minutos quando ocioso

export interface OrchestratorConfig {
  intervalMs?: number;
  maxConcurrentRuns?: number;
}

function priorityWeight(p: ExecutionQueueItem['priority']): number {
  switch (p) {
    case 'critica': return 4;
    case 'alta': return 3;
    case 'media': return 2;
    case 'baixa': return 1;
    default: return 0;
  }
}

function isDependencySatisfied(
  item: ExecutionQueueItem,
  all: ExecutionQueueItem[],
): boolean {
  for (const depId of item.dependencies) {
    const dep = all.find((i) => i.id === depId);
    if (!dep || dep.status !== 'completed') return false;
  }
  return true;
}

async function executeItem(
  item: ExecutionQueueItem,
  enterpriseState: EnterpriseDataState,
): Promise<void> {
  addLog(item.id, `Iniciando execução (agente: ${item.assigneeAgentId || 'autônomo'})`);
  createActivity({
    actorName: item.assigneeAgentName || 'Orquestrador',
    action: 'execution.start',
    targetType: 'queue-item',
    targetId: item.id,
    targetName: item.title,
    summary: item.description,
    timestamp: new Date().toISOString(),
  });

  let resultSummary = '';
  let error: Error | null = null;

  try {
    if (item.assigneeAgentId) {
      addLog(item.id, `Delegando ao agente Hermes ${item.assigneeAgentId}`);
      const result = await runCommandSafe(
        HERMES_CLI,
        ['-p', item.assigneeAgentId, 'chat', '--oneshot', '-q', item.title],
        { timeoutMs: 60000 },
      );
      if (result.error) {
        throw result.error;
      }
      resultSummary = result.stdout?.slice(0, 2000) || 'Execução concluída via Hermes';
    } else {
      resultSummary = `Tarefa executada autonomamente pelo orquestrador: ${item.title}`;
    }

    addLog(item.id, 'Execução concluída com sucesso');
    markCompleted(item.id, resultSummary, item.evidence);
    createActivity({
      actorName: item.assigneeAgentName || 'Orquestrador',
      action: 'execution.completed',
      targetType: 'queue-item',
      targetId: item.id,
      targetName: item.title,
      summary: resultSummary || 'Concluída',
      timestamp: new Date().toISOString(),
    });
    appendAudit(
      item.assigneeAgentName || 'Orquestrador',
      `Concluiu tarefa "${item.title}"`,
      item.id,
      'Hermes Adapter',
    );
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
    addLog(item.id, `Falha na execução: ${error.message}`);
    markFailed(item.id, error.message);
    createActivity({
      actorName: item.assigneeAgentName || 'Orquestrador',
      action: 'execution.failed',
      targetType: 'queue-item',
      targetId: item.id,
      targetName: item.title,
      summary: error.message,
      timestamp: new Date().toISOString(),
    });
    appendAudit(
      item.assigneeAgentName || 'Orquestrador',
      `Falha na tarefa "${item.title}": ${error.message}`,
      item.id,
      'Segurança',
    );
  }
}

async function tick(enterpriseState: EnterpriseDataState): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    const pending = listPendingQueueItems();
    const running = listRunningQueueItems();
    const all = [...pending, ...running];

    const ready = pending.filter((item) => isDependencySatisfied(item, all));

    ready.sort(
      (a, b) =>
        priorityWeight(b.priority) - priorityWeight(a.priority) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const slots = Math.max(0, maxConcurrentRuns - running.length);
    const toExecute = ready.slice(0, slots);

    for (const item of toExecute) {
      markRunning(item.id);
      executeItem(item, enterpriseState).catch(() => {
        // Erros já são tratados dentro de executeItem (markFailed + auditoria)
      });
    }

    // Detecção de ociosidade + replanejamento automático:
    // quando não há itens pendentes nem em execução, o sistema ainda
    // deve continuar avançando. Converte transferências inter-departamento
    // pendentes em itens de execução e gera itens de manutenção.
    if (pending.length === 0 && running.length === 0) {
      await autoPlan(enterpriseState);
    }
  } finally {
    isRunning = false;
  }
}

/**
 * Replanejamento automático: quando a fila está ociosa, o sistema
 * identifica trabalho útil e o alimenta de volta na fila, sem
 * esperar uma ordem humana.
 *
 * Fontes de trabalho automático:
 *  1. Transferências inter-departamento pendentes (interdepartmentRouter)
 *  2. Itens de manutenção/health-check periódicos
 */
async function autoPlan(_enterpriseState: EnterpriseDataState): Promise<void> {
  const now = new Date().toISOString();

  // 1. Converter transferências pendentes em itens de execução
  const transfers = listPendingTransfers();
  for (const transfer of transfers) {
    const alreadyQueued = listPendingQueueItems().some(
      (i) => i.title.includes(`[transfer] ${transfer.id}`),
    );
    if (alreadyQueued) continue;

    let title = '';
    let description = '';
    let priority: ExecutionQueueItem['priority'] = 'media';
    let assigneeAgentId: string | null = null;
    let assigneeAgentName: string | null = null;

    switch (transfer.type) {
      case 'marketing_to_commercial': {
        title = `[transfer] Lead qualificado → Comercial: ${transfer.context.leadId}`;
        description = `Rotear lead qualificado (score ${transfer.context.qualificationScore}) do Marketing para o Comercial.`;
        priority = 'alta';
        assigneeAgentId = transfer.responsibleAgent;
        assigneeAgentName = transfer.responsibleAgent;
        break;
      }
      case 'support_to_commercial': {
        title = `[transfer] Oportunidade → Comercial: ${transfer.context.opportunityType}`;
        description = `Oportunidade identificada no atendimento: ${transfer.context.description}.`;
        priority = 'alta';
        assigneeAgentId = transfer.responsibleAgent;
        assigneeAgentName = transfer.responsibleAgent;
        break;
      }
      case 'support_to_product': {
        title = `[transfer] Problema técnico → Produto: ${transfer.context.issueType}`;
        description = `Problema reportado no atendimento: ${transfer.context.description} (severidade: ${transfer.context.severity}).`;
        priority = transfer.context.severity === 'critical' ? 'critica' : 'alta';
        assigneeAgentId = transfer.responsibleAgent;
        assigneeAgentName = transfer.responsibleAgent;
        break;
      }
      case 'commercial_to_marketing': {
        title = `[transfer] Feedback → Marketing: ${transfer.context.outcome}`;
        description = `Feedback de vendas: ${transfer.context.feedback}.`;
        priority = 'media';
        assigneeAgentId = transfer.responsibleAgent;
        assigneeAgentName = transfer.responsibleAgent;
        break;
      }
      default: {
        title = `[transfer] ${transfer.type}`;
        description = `Transferência inter-departamento ${transfer.fromDepartment} → ${transfer.toDepartment}.`;
        priority = 'media';
      }
    }

    const item = createQueueItem({
      title,
      description,
      priority,
      assigneeAgentId,
      assigneeAgentName,
      departmentId: transfer.toDepartment,
      departmentName: transfer.toDepartment,
      triggerSource: 'autonomous',
      dependencies: [],
      maxRetries: 3,
    });
    addLog(item.id, `Gerado automaticamente a partir da transferência ${transfer.id}`);
    addEvidence(item.id, {
      type: 'transfer_reference',
      description: 'Transferência inter-departamento de origem',
      value: transfer.id,
    });
    appendAudit(
      'auto-planner',
      `Criou item de execução automático a partir da transferência ${transfer.id}`,
      item.id,
      'Plataforma',
    );

    // Marca a transferência como em_progresso
    await interdepartmentRouter.updateTransferState(transfer.id, 'in_progress', {
      context: { ...transfer.context, queueItemId: item.id },
    });
  }

  // 2. Item de manutenção periódica (health check do sistema)
  const tenMinutesAgo = Date.now() - AUTO_PLAN_INTERVAL_MS;
  if (!lastAutoPlanAt || new Date(lastAutoPlanAt).getTime() < tenMinutesAgo) {
    const healthItem = createQueueItem({
      title: 'Health check automático do sistema',
      description: 'Verificar saúde de integrações, fila de execução e rotinas de departamento.',
      priority: 'baixa',
      triggerSource: 'scheduled',
      dependencies: [],
      maxRetries: 3,
    });
    addLog(healthItem.id, 'Item de health check gerado pelo auto-planner');
    lastAutoPlanAt = now;
  }
}

export function startExecutionOrchestrator(
  enterpriseState: EnterpriseDataState,
  config: OrchestratorConfig = {},
): void {
  if (orchestratorInterval) return;
  maxConcurrentRuns = config.maxConcurrentRuns ?? 3;

  // Recuperação automática: itens deixados em 'running' após uma
  // interrupção/reinicialização voltam a 'pending' para serem reaproveitados.
  const items = listQueueItems();
  for (const item of items) {
    if (item.status === 'running') {
      updateQueueItem(item.id, { status: 'pending', startedAt: null });
      addLog(item.id, 'Resetado para pending após reinicialização (recuperação automática)');
    }
  }

  tick(enterpriseState).catch(() => {});

  orchestratorInterval = setInterval(() => {
    tick(enterpriseState).catch(() => {});
  }, config.intervalMs ?? 30000);
}

export function stopExecutionOrchestrator(): void {
  if (orchestratorInterval) {
    clearInterval(orchestratorInterval);
    orchestratorInterval = null;
  }
}

export function getOrchestratorStatus(): {
  running: boolean;
  pending: number;
  runningCount: number;
  completed: number;
  failed: number;
  blocked: number;
} {
  return {
    running: orchestratorInterval !== null,
    pending: listPendingQueueItems().length,
    runningCount: listRunningQueueItems().length,
    completed: listQueueItems().filter((i) => i.status === 'completed').length,
    failed: listQueueItems().filter((i) => i.status === 'failed').length,
    blocked: listQueueItems().filter((i) => i.status === 'blocked').length,
  };
}

export { createQueueItem };
