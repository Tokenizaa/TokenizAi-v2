-- ============================================================================
-- TokenizAi V2 — Migration 008: Conectores (Connectors)
-- ============================================================================
-- `connectores`: catalogo de conectores de integração externa.
-- Endpoint correspondente: GET /api/connectores (Fase 2).
-- Idempotente.
-- ============================================================================

create table if not exists connectores (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  descricao text,
  tipo text not null check (tipo in ('saas', 'api', 'webhook', 'banco_dados', 'email', 'telefone')),
  configuracao jsonb default '{}',
  credenciais_armazenadas boolean not null default false,
  ativo boolean not null default true,
  empresa_id uuid references empresas(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_connectores_tipo on connectores(tipo);
create index if not exists idx_connectores_ativo on connectores(ativo);
create index if not exists idx_connectores_empresa on connectores(empresa_id);

comment on table connectores is 'Catalogo de conectores de integracao externa.';
comment on column connectores.credenciais_armazenadas is 'Indica se credenciais estao armazenadas (cofre), nunca expostas em texto plano.';
