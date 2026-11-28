import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createQueueItem, markRunning, markCompleted, listQueueItems } from '../../server/services/execution-queue.ts';

function resetQueue(): void {
  const fs = require('node:fs');
  const path = require('node:path');
  const file = path.resolve(process.cwd(), 'data/execution-queue.json');
  fs.writeFileSync(file, '[]', 'utf8');
}

describe('Ciclo completo de execução autônoma', () => {
  beforeEach(() => {
    resetQueue();
  });

  afterEach(() => {
    resetQueue();
  });

  it('cria, executa e conclui um item com evidências', () => {
    const now = new Date().toISOString();

    // 1. Criação
    const item = createQueueItem({
      title: 'Validar ciclo completo',
      description: 'Criar → executar → validar → concluir',
      priority: 'critica',
      triggerSource: 'autonomous',
      assigneeAgentId: 'agente-teste',
      assigneeAgentName: 'Agente Teste',
      departmentId: 'dep-teste',
      departmentName: 'Departamento Teste',
      dependencies: [],
      maxRetries: 3,
    });
    expect(item.status).toBe('pending');
    expect(item.retryCount).toBe(0);

    // 2. Execução (marca como running)
    const running = markRunning(item.id);
    expect(running?.status).toBe('running');
    expect(running?.startedAt).toBeDefined();

    // 3. Validação e conclusão com evidências
    const completed = markCompleted(item.id, 'Ciclo validado com sucesso', [
      { type: 'test', description: 'Criação', value: 'ok', timestamp: now },
      { type: 'test', description: 'Execução', value: 'ok', timestamp: now },
      { type: 'test', description: 'Validação', value: 'ok', timestamp: now },
    ]);
    expect(completed?.status).toBe('completed');
    expect(completed?.finishedAt).toBeDefined();
    expect(completed?.resultSummary).toBe('Ciclo validado com sucesso');
    expect(completed?.evidence?.length).toBe(3);

    // 4. Verifica na fila completa
    const all = listQueueItems();
    expect(all.length).toBe(1);
    expect(all[0].status).toBe('completed');
    expect(all[0].evidence?.length).toBe(3);
  });

  it('itens de diferentes prioridades são criados corretamente', () => {
    const baixa = createQueueItem({ title: 'Baixa', description: 'Item de baixa prioridade', priority: 'baixa', triggerSource: 'manual', dependencies: [], maxRetries: 3 });
    const media = createQueueItem({ title: 'Media', description: 'Item de média prioridade', priority: 'media', triggerSource: 'manual', dependencies: [], maxRetries: 3 });
    const alta = createQueueItem({ title: 'Alta', description: 'Item de alta prioridade', priority: 'alta', triggerSource: 'manual', dependencies: [], maxRetries: 3 });
    const critica = createQueueItem({ title: 'Critica', description: 'Item de crítica prioridade', priority: 'critica', triggerSource: 'manual', dependencies: [], maxRetries: 3 });

    expect(baixa.priority).toBe('baixa');
    expect(media.priority).toBe('media');
    expect(alta.priority).toBe('alta');
    expect(critica.priority).toBe('critica');
  });

  it('itens com dependências são rastreados', () => {
    const pai = createQueueItem({ title: 'Pai', description: 'Item pai', priority: 'media', triggerSource: 'manual', dependencies: [], maxRetries: 3 });
    const filho = createQueueItem({
      title: 'Filho',
      description: 'Item filho dependente do pai',
      priority: 'alta',
      triggerSource: 'autonomous',
      dependencies: [pai.id],
      maxRetries: 3,
    });

    expect(filho.dependencies).toContain(pai.id);
    expect(filho.status).toBe('pending');
  });
});
