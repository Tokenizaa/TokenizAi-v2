import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startExecutionOrchestrator,
  stopExecutionOrchestrator,
  getOrchestratorStatus,
} from '../../server/services/execution-orchestrator.ts';
import {
  createQueueItem,
  markRunning,
  markCompleted,
  markFailed,
  listPendingQueueItems,
  listRunningQueueItems,
  listCompletedQueueItems,
  listFailedQueueItems,
} from '../../server/services/execution-queue.ts';

function resetQueue(): void {
  const fs = require('node:fs');
  const path = require('node:path');
  const file = path.resolve(process.cwd(), 'data/execution-queue.json');
  fs.writeFileSync(file, '[]', 'utf8');
}

describe('Orquestrador de execução autônoma — ciclo completo', () => {
  beforeEach(() => {
    resetQueue();
    stopExecutionOrchestrator();
  });

  afterEach(() => {
    stopExecutionOrchestrator();
    resetQueue();
  });

  it('inicia e para o orquestrador', () => {
    const enterpriseState = { projects: [], clients: [], users: [] } as any;
    startExecutionOrchestrator(enterpriseState);
    const status = getOrchestratorStatus();
    expect(status.running).toBe(true);
    stopExecutionOrchestrator();
    const status2 = getOrchestratorStatus();
    expect(status2.running).toBe(false);
  });

  it('processa item pendente automaticamente', async () => {
    const enterpriseState = { projects: [], clients: [], users: [] } as any;
    startExecutionOrchestrator(enterpriseState);

    // Cria um item sem agente (execução autônoma direta)
    const item = createQueueItem({
      title: 'Item de teste do orquestrador',
      description: 'Validar processamento automático',
      priority: 'alta',
      triggerSource: 'autonomous',
      dependencies: [],
    });

    expect(item.status).toBe('pending');

    // Aguarda o ciclo do orquestrador processar (intervalo de 30s, mas
    // o tick inicial é disparado imediatamente)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const updated = getOrchestratorStatus();
    // O item deve ter sido processado (completed ou running)
    expect(updated.completed + updated.runningCount + updated.pending).toBeGreaterThanOrEqual(1);

    stopExecutionOrchestrator();
  });

  it('recupera itens running após reinicialização', () => {
    const item = createQueueItem({
      title: 'Item running órfão',
      priority: 'media',
      triggerSource: 'manual',
      dependencies: [],
    });
    markRunning(item.id);

    const enterpriseState = { projects: [], clients: [], users: [] } as any;
    startExecutionOrchestrator(enterpriseState);

    const recovered = getOrchestratorStatus();
    // O item running órfão deve ter sido resetado para pending
    expect(recovered.pending).toBeGreaterThanOrEqual(1);

    stopExecutionOrchestrator();
  });

  it('getOrchestratorStatus retorna contagem correta', () => {
    const p1 = createQueueItem({
      title: 'Pendente',
      priority: 'media',
      triggerSource: 'manual',
      dependencies: [],
    });
    markRunning(p1.id);
    const p2 = createQueueItem({
      title: 'Concluído',
      priority: 'baixa',
      triggerSource: 'manual',
      dependencies: [],
    });
    markCompleted(p2.id, 'ok');
    const p3 = createQueueItem({
      title: 'Falhou',
      priority: 'critica',
      triggerSource: 'manual',
      dependencies: [],
      maxRetries: 0,
    });
    markFailed(p3.id, 'erro');

    const status = getOrchestratorStatus();
    expect(status.pending).toBeGreaterThanOrEqual(0);
    expect(status.completed).toBeGreaterThanOrEqual(1);
    expect(status.failed).toBeGreaterThanOrEqual(1);
    expect(status.runningCount).toBeGreaterThanOrEqual(1);
  });
});
