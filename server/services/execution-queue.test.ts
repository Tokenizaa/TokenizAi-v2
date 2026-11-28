import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createQueueItem,
  markRunning,
  markCompleted,
  markFailed,
  addLog,
  addEvidence,
  getQueueItem,
  listPendingQueueItems,
  listRunningQueueItems,
  listCompletedQueueItems,
  listFailedQueueItems,
  ExecutionQueueItem,
} from '../../server/services/execution-queue.ts';

function resetQueue(): void {
  // Limpa o arquivo de fila reescrevendo vazio
  const fs = require('node:fs');
  const path = require('node:path');
  const file = path.resolve(process.cwd(), 'data/execution-queue.json');
  fs.writeFileSync(file, '[]', 'utf8');
}

describe('Execução autônoma — fila de trabalho', () => {
  beforeEach(() => {
    resetQueue();
  });

  afterEach(() => {
    resetQueue();
  });

  it('cria item na fila com status pending', () => {
    const item = createQueueItem({
      title: 'Tarefa de teste',
      description: 'Descrição da tarefa',
      priority: 'alta',
      triggerSource: 'manual',
      dependencies: [],
    });

    expect(item.id).toMatch(/^queue-/);
    expect(item.status).toBe('pending');
    expect(item.title).toBe('Tarefa de teste');
    expect(item.priority).toBe('alta');
    expect(item.retryCount).toBe(0);
    expect(item.logs).toEqual([]);
    expect(item.createdAt).toBeDefined();
  });

  it('lista itens pendentes e concluídos', () => {
    const p1 = createQueueItem({
      title: 'Pendente 1',
      priority: 'media',
      triggerSource: 'manual',
      dependencies: [],
    });
    const p2 = createQueueItem({
      title: 'Pendente 2',
      priority: 'baixa',
      triggerSource: 'manual',
      dependencies: [],
    });

    expect(listPendingQueueItems().length).toBe(2);

    markCompleted(p1.id, 'Concluída com sucesso');

    expect(listPendingQueueItems().length).toBe(1);
    expect(listCompletedQueueItems().length).toBe(1);
    expect(listCompletedQueueItems()[0].id).toBe(p1.id);
  });

  it('marca item como running e depois concluído', () => {
    const item = createQueueItem({
      title: 'Tarefa running',
      priority: 'critica',
      triggerSource: 'autonomous',
      dependencies: [],
    });

    const running = markRunning(item.id);
    expect(running?.status).toBe('running');
    expect(running?.startedAt).toBeDefined();

    const completed = markCompleted(item.id, 'Resultado final', [
      { type: 'evidência', description: 'teste', value: 'ok' },
    ]);
    expect(completed?.status).toBe('completed');
    expect(completed?.finishedAt).toBeDefined();
    expect(completed?.evidence?.length).toBe(1);

    expect(getQueueItem(item.id)?.status).toBe('completed');
  });

  it('marca item como falhado e não permite retry infinito', () => {
    const item = createQueueItem({
      title: 'Tarefa que falha',
      priority: 'media',
      triggerSource: 'manual',
      dependencies: [],
      maxRetries: 1,
    });

    // Primeira falha: volta para pending com retryCount 1
    const f1 = markFailed(item.id, 'Erro simulado');
    expect(f1?.status).toBe('pending');
    expect(f1?.retryCount).toBe(1);

    // Segunda execução falha: agora vai para failed (excedeu maxRetries)
    markRunning(item.id);
    const f2 = markFailed(item.id, 'Erro novamente');
    expect(f2?.status).toBe('failed');
    expect(f2?.finishedAt).toBeDefined();
    expect(f2?.errorMessage).toBe('Erro novamente');
  });

  it('não marca item inexistente', () => {
    expect(markRunning('inexistente')).toBeNull();
    expect(markCompleted('inexistente')).toBeNull();
    expect(markFailed('inexistente', 'erro')).toBeNull();
    expect(addLog('inexistente', 'log')).toBeNull();
    expect(addEvidence('inexistente', { type: 't', description: 'd', value: 'v' })).toBeNull();
  });

  it('addLog e addEvidence funcionam', () => {
    const item = createQueueItem({
      title: 'Com logs',
      priority: 'baixa',
      triggerSource: 'manual',
      dependencies: [],
    });

    const withLog = addLog(item.id, 'Primeira entrada');
    expect(withLog?.logs.length).toBe(1);
    expect(withLog?.logs[0]).toContain('Primeira entrada');

    const withEv = addEvidence(item.id, {
      type: 'test',
      description: 'evidência de teste',
      value: 'ok',
    });
    expect(withEv?.evidence.length).toBe(1);
    expect(withEv?.evidence[0].value).toBe('ok');
    expect(withEv?.evidence[0].timestamp).toBeDefined();
  });

  it('falhas são listadas separadamente', () => {
    const f1 = createQueueItem({
      title: 'Falha 1',
      priority: 'media',
      triggerSource: 'manual',
      dependencies: [],
      maxRetries: 0,
    });
    const f2 = createQueueItem({
      title: 'Falha 2',
      priority: 'media',
      triggerSource: 'manual',
      dependencies: [],
      maxRetries: 0,
    });

    markFailed(f1.id, 'erro 1');
    markFailed(f2.id, 'erro 2');

    const failed = listFailedQueueItems();
    expect(failed.length).toBe(2);
    expect(failed.map((i) => i.id).sort()).toEqual([f1.id, f2.id].sort());
  });
});

describe('Execução autônoma — dependências', () => {
  beforeEach(() => {
    const fs = require('node:fs');
    const path = require('node:path');
    const file = path.resolve(process.cwd(), 'data/execution-queue.json');
    fs.writeFileSync(file, '[]', 'utf8');
  });

  afterEach(() => {
    const fs = require('node:fs');
    const path = require('node:path');
    const file = path.resolve(process.cwd(), 'data/execution-queue.json');
    fs.writeFileSync(file, '[]', 'utf8');
  });

  it('item com dependência não concluída fica bloqueado na lógica', () => {
    const dep = createQueueItem({
      title: 'Dependência',
      priority: 'media',
      triggerSource: 'manual',
      dependencies: [],
    });

    const child = createQueueItem({
      title: 'Filho',
      priority: 'alta',
      triggerSource: 'autonomous',
      dependencies: [dep.id],
    });

    expect(dep.status).toBe('pending');
    expect(child.status).toBe('pending');
    expect(child.dependencies).toContain(dep.id);
  });
});
