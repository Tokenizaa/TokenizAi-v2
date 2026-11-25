import { describe, it, expect, beforeAll } from 'vitest';
import { runCommandSafe } from './cliRunner.ts';
import { HERMES_CLI } from './domainCache.ts';
import { existsSync } from 'node:fs';

/**
 * Testes de integracao Hermes — operacoes reais via CLI.
 * Comprovam que o runtime Hermes responde a comandos de descoberta,
 * tarefas e rotinas.
 *
 * Esses testes sao condicionados a disponibilidade do executavel Hermes
 * no ambiente. Quando nao ha Hermes CLI instalado, os testes sao pulados
 * (skip) em vez de falhar.
 */
let hermesAvailable = false;

beforeAll(() => {
  hermesAvailable = existsSync(HERMES_CLI);
});

describe('Integracao Hermes — operacoes reais', () => {
  it('profile list retorna perfis cadastrados', async () => {
    if (!hermesAvailable) {
      console.log('[skip] Hermes CLI nao disponível no ambiente');
      return;
    }
    const result = await runCommandSafe(
      HERMES_CLI,
      ['profile', 'list'],
      { timeoutMs: 8000 },
    );
    expect(result.error).toBeNull();
    expect(result.stdout).toContain('Profile');
    // Deve haver pelo menos o perfil default
    expect(result.stdout).toContain('default');
  });

  it('kanban list --json retorna tarefas em formato JSON valido', async () => {
    if (!hermesAvailable) {
      console.log('[skip] Hermes CLI nao disponível no ambiente');
      return;
    }
    const result = await runCommandSafe(
      HERMES_CLI,
      ['kanban', 'list', '--json'],
      { timeoutMs: 8000 },
    );
    expect(result.error).toBeNull();
    const tasks = JSON.parse(result.stdout);
    expect(Array.isArray(tasks)).toBe(true);
    if (tasks.length > 0) {
      expect(tasks[0]).toHaveProperty('id');
      expect(tasks[0]).toHaveProperty('title');
      expect(tasks[0]).toHaveProperty('status');
    }
  });

  it('cron list retorna rotinas agendadas', async () => {
    if (!hermesAvailable) {
      console.log('[skip] Hermes CLI nao disponível no ambiente');
      return;
    }
    const result = await runCommandSafe(
      HERMES_CLI,
      ['cron', 'list'],
      { timeoutMs: 15000 },
    );
    expect(result.error).toBeNull();
    // O output pode ser texto ou vazio, mas nao deve dar erro de execucao
    expect(typeof result.stdout).toBe('string');
  });

  it('profile describe atualiza descricao de um perfil existente (operacao de escrita real)', async () => {
    if (!hermesAvailable) {
      console.log('[skip] Hermes CLI nao disponível no ambiente');
      return;
    }
    const result = await runCommandSafe(
      HERMES_CLI,
      ['profile', 'describe', 'default', '--text', 'Perfil padrao da TokenizAi V2'],
      { timeoutMs: 15000 },
    );
    expect(result.error).toBeNull();
  });
});
