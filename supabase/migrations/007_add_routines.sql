-- ============================================================================
-- TokenizAi V2 — Migration 007: Rotinas (Routines)
-- ============================================================================
-- `routines`: rotinas de automatizacao com tipo de gatilho (CRON/MANUAL/EVENT),
-- limite de execucao para evitar loops infinitos e campo cron opcional.
-- Idempotente.
-- ============================================================================

create table if not exists routines (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  descricao text,
  trigger_type text not null default 'MANUAL' check (trigger_type in ('CRON', 'MANUAL', 'EVENT')),
  cron text,
  execution_limit integer not null default 1000,
  active boolean not null default true,
  runs_last_30d integer not null default 0,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_routines_trigger_type on routines(trigger_type);
create index if not exists idx_routines_active on routines(active);
create index if not exists idx_routines_cron on routines(cron);

-- garante colunas de rotinas na tabela automacoes (schema 001) para compatibilidade
alter table automacoes
  add column if not exists trigger_type text check (trigger_type in ('CRON', 'MANUAL', 'EVENT')),
  add column if not exists cron text,
  add column if not exists execution_limit integer not null default 1000;

comment on table routines is 'Rotinas de automatizacao com tipo de gatilho (CRON/MANUAL/EVENT) e limite de execucao.';
comment on column routines.execution_limit is 'Limite maximo de execucoes para evitar loops infinitos.';
