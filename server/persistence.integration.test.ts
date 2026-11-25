import { describe, it, expect } from 'vitest';
import { loadEnterpriseState, saveEnterpriseState } from './persistence.ts';
import type { EnterpriseDataState } from '../src/types/platform.ts';

/**
 * Testes de persistência local (memoria + JSON).
 * Comprovam que gravacoes sobrevivem a uma "reinicializacao" (recarregamento do arquivo JSON).
 * Quando o Supabase nao estiver acessivel, este eh o caminho real de persistencia.
 */
describe('Persistencia local — sobrevive a reinicializacao', () => {
  const STATE_FILE_PATH = 'data/enterprise-state.json';
  const testProjectId = `proj-persist-${Date.now()}`;
  const testDeliverableId = `del-persist-${Date.now()}`;
  const testActivityId = `act-persist-${Date.now()}`;

  it('salva estado com projeto, entrega e atividade, recarrega e confere integridade', () => {
    // Estado inicial limpo
    const initial: EnterpriseDataState = {
      projects: [],
      clients: [],
      deals: [],
      products: [],
      subscriptions: [],
      financeEntries: [],
      automations: [],
      users: [],
      auditLogs: [],
      runs: [],
      activities: [],
      departamentos: [],
      agentesEmpresariais: [],
      equipes: [],
    };

    // Grava estado inicial
    saveEnterpriseState(initial);

    // Carrega de volta (simula inicializacao do servidor)
    const loaded1 = loadEnterpriseState();
    expect(loaded1).not.toBeNull();
    expect(loaded1!.projects).toEqual([]);

    // Cria um projeto com entregas e atividades
    const projeto = {
      id: testProjectId,
      code: 'PRJ-PERSIST-01',
      name: 'Projeto de Persistencia',
      clientId: '',
      clientName: '',
      stage: 'Em Execucao' as const,
      ownerName: 'Teste Persistencia',
      startDate: '2026-11-01',
      endDate: '2027-01-31',
      progress: 35,
      budgetBRL: 50000,
      spentBRL: 0,
      hermesProjectId: null,
      deliverables: [
        {
          id: testDeliverableId,
          title: 'Entrega de persistencia',
          owner: 'Teste Persistencia',
          dueDate: '2027-01-15',
          done: false,
        },
      ],
      activities: [
        {
          id: testActivityId,
          author: 'Teste Persistencia',
          date: new Date().toLocaleDateString('pt-BR'),
          summary: 'Atividade de persistencia criada.',
        },
      ],
      strategicObjective: 'Validar persistencia apos reiniciar',
      problemToSolve: 'Dados devem sobreviver ao reinicio do backend',
      expectedOutcome: 'Registro recuperavel apos recarregar JSON',
      priority: 'Alta',
      risksAndDependencies: [],
      managingAgentId: null,
      teamAgentIds: [],
      strategicMilestones: [],
      linkedDocuments: [],
      decisionHistory: [],
    };

    const estadoComProjeto: EnterpriseDataState = {
      ...initial,
      projects: [projeto as any],
    };

    saveEnterpriseState(estadoComProjeto);

    // RECARREGA (simula reinicializacao do servidor)
    const loaded2 = loadEnterpriseState();
    expect(loaded2).not.toBeNull();

    const projetoRecuperado = loaded2!.projects.find((p) => p.id === testProjectId);
    expect(projetoRecuperado).toBeDefined();
    expect(projetoRecuperado!.name).toBe('Projeto de Persistencia');
    expect(projetoRecuperado!.priority).toBe('Alta');
    expect(projetoRecuperado!.strategicObjective).toBe('Validar persistencia apos reiniciar');

    // Entregas e atividades estao vinculadas
    expect(projetoRecuperado!.deliverables.length).toBe(1);
    expect(projetoRecuperado!.deliverables[0].id).toBe(testDeliverableId);
    expect(projetoRecuperado!.deliverables[0].title).toBe('Entrega de persistencia');

    expect(projetoRecuperado!.activities.length).toBe(1);
    expect(projetoRecuperado!.activities[0].id).toBe(testActivityId);
    expect(projetoRecuperado!.activities[0].summary).toBe('Atividade de persistencia criada.');

    // Limpeza
    saveEnterpriseState(initial);
  });

  it('arquivo JSON eh gravado no disco', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const filePath = path.resolve(process.cwd(), STATE_FILE_PATH);
    expect(fs.existsSync(filePath)).toBe(true);
    const conteudo = fs.readFileSync(filePath, 'utf8');
    const parse = JSON.parse(conteudo);
    expect(parse.projects).toEqual([]);
  });
});
