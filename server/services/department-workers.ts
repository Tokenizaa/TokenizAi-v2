/**
 * @file server/services/department-workers.ts
 * Workers especializados por departamento para execução autônoma.
 *
 * Cada worker executa ciclos periódicos de trabalho específico do
 * departamento, delegando itens para a fila de execução quando
 * identifica trabalho útil.
 */

import {
  createQueueItem,
  listPendingQueueItems,
} from './execution-queue.ts';
import { appendAudit, createActivity } from '../persistence.ts';
import { publish } from '../core/events/topics.ts';

interface DepartmentWorker {
  name: string;
  intervalMs: number;
  timer: ReturnType<typeof setInterval> | null;
  lastRun: string | null;
  runCount: number;
  errorCount: number;
  lastError?: string | null;
  isRunning: boolean;
}

const workers: Map<string, DepartmentWorker> = new Map();

function startWorker(
  name: string,
  intervalMs: number,
  fn: () => Promise<void>,
): void {
  if (workers.has(name)) return;

  const worker: DepartmentWorker = {
    name,
    intervalMs,
    timer: null,
    lastRun: null,
    runCount: 0,
    errorCount: 0,
    isRunning: false,
  };

  worker.timer = setInterval(async () => {
    if (worker.isRunning) return;
    worker.isRunning = true;
    worker.lastRun = new Date().toISOString();
    try {
      worker.runCount++;
      await fn().catch((err) => {
        worker.errorCount++;
        worker.lastError = err instanceof Error ? err.message : String(err);
        console.error(`[worker:${name}] falhou:`, worker.lastError);
        publish('system.alert', {
          severity: 'error',
          message: `Worker ${name} falhou: ${worker.lastError}`,
          worker: name,
          timestamp: new Date().toISOString(),
        }, 'department-workers');
      });
    } finally {
      worker.isRunning = false;
    }
  }, intervalMs);

  workers.set(name, worker);
  console.log(`[worker:${name}] iniciado (intervalo: ${intervalMs}ms)`);
}

function stopWorker(name: string): void {
  const w = workers.get(name);
  if (w?.timer) clearInterval(w.timer);
  workers.delete(name);
}

function stopAllWorkers(): void {
  for (const name of [...workers.keys()]) stopWorker(name);
}

function listWorkers() {
  return [...workers.values()].map((w) => ({
    name: w.name,
    intervalMs: w.intervalMs,
    lastRun: w.lastRun,
    runCount: w.runCount,
    errorCount: w.errorCount,
    lastError: w.lastError,
    isRunning: w.isRunning,
  }));
}

// ============================================================================
// WORKER: MARKETING
// Ciclo: qualificação de leads, nurturing, roteamento para comercial
// ============================================================================
function marketingWorker(): Promise<void> {
  return new Promise((resolve) => {
    console.debug('[worker:marketing] ciclo de qualificação de leads');
    publish('marketing.cycle.tick', {
      timestamp: new Date().toISOString(),
      source: 'marketing-worker',
    }, 'department-workers');
    resolve();
  });
}

// ============================================================================
// WORKER: COMERCIAL
// Ciclo: follow-up de oportunidades, conversão de vendas
// ============================================================================
function commercialWorker(): Promise<void> {
  return new Promise((resolve) => {
    console.debug('[worker:commercial] ciclo de follow-up comercial');
    resolve();
  });
}

// ============================================================================
// WORKER: SUPORTE
// Ciclo: classificação de mensagens, resposta automática, encaminhamento
// ============================================================================
function supportWorker(): Promise<void> {
  return new Promise((resolve) => {
    console.debug('[worker:support] ciclo de atendimento');
    resolve();
  });
}

// ============================================================================
// WORKER: PRODUTO
// Ciclo: backlog, priorização de melhorias, feedback
// ============================================================================
function productWorker(): Promise<void> {
  return new Promise((resolve) => {
    console.debug('[worker:product] ciclo de produto');
    resolve();
  });
}

// ============================================================================
// WORKER: TECNOLOGIA
// Ciclo: monitoramento, incidentes, health check
// ============================================================================
function technologyWorker(): Promise<void> {
  return new Promise((resolve) => {
    console.debug('[worker:technology] ciclo de tecnologia');
    resolve();
  });
}

// ============================================================================
// WORKER: DIRETORIA
// Ciclo: KPIs, prestação de contas, decisões estratégicas
// ============================================================================
function directorateWorker(): Promise<void> {
  return new Promise((resolve) => {
    console.debug('[worker:diretoria] ciclo da diretoria executiva');
    resolve();
  });
}

export async function startAllDepartmentWorkers(): Promise<void> {
  console.log('[workers] iniciando workers de departamento');

  startWorker('marketing', 5 * 60 * 1000, marketingWorker);
  startWorker('commercial', 10 * 60 * 1000, commercialWorker);
  startWorker('support', 5 * 60 * 1000, supportWorker);
  startWorker('product', 15 * 60 * 1000, productWorker);
  startWorker('technology', 2 * 60 * 1000, technologyWorker);
  startWorker('directorate', 20 * 60 * 1000, directorateWorker);

  console.log(`[workers] ${workers.size} workers de departamento iniciados`);
}

export async function stopAllDepartmentWorkers(): Promise<void> {
  stopAllWorkers();
  console.log('[workers] todos os workers parados');
}

export const departmentWorkers = {
  startAll: startAllDepartmentWorkers,
  stopAll: stopAllDepartmentWorkers,
  list: listWorkers,
  start: startWorker,
  stop: stopWorker,
};
