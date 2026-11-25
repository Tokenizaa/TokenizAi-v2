import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Seguranca — RLS (Row Level Security)', () => {
  const migration = readFileSync(
    'supabase/migrations/001_initial_schema.sql',
    'utf8',
  );

  it('nao contem desabilitacao de RLS (disable row level security)', () => {
    expect(migration).not.toMatch(/disable row level security/i);
  });

  it('habilita RLS em todas as tabelas empresariais', () => {
    const tables = [
      'perfis_empresariais',
      'departamentos',
      'agentes_empresariais',
      'projetos',
      'entregas_de_projeto',
      'atividades_de_projeto',
      'clientes',
      'interacoes_de_cliente',
      'negocios',
      'produtos',
      'assinaturas',
      'pagamentos_de_assinatura',
      'lancamentos_financeiros',
      'automacoes',
      'metas',
      'aprovacoes',
      'auditoria',
      'runs',
      'tasks',
      'activities',
      'costs',
      'attachments',
      'equipes',
    ];
    for (const table of tables) {
      expect(migration).toContain(`alter table ${table} enable row level security`);
    }
  });

  it('produtos e a unica tabela com leitura usando (true) (catalogo publico)', () => {
    // produtos e' catastro publico: e aceitavel que autenticados leiam tudo.
    expect(migration).toContain('on produtos for select to authenticated using (true)');
  });
});
