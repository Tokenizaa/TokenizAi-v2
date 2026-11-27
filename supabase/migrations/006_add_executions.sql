-- ============================================================================
-- TokenizAi V2 — Migration 006: Execucoes com Heartbeats e Custo
-- ============================================================================
-- `executions`: registros de execucao com status, heartbeat_at, custo e logs.
-- Complementa `runs` (schema 001) com foco em heartbeats e custo por execucao.
-- Nome prefixado para nao colidir com a tabela `runs` existente.
-- Idempotente.
-- ============================================================================

create table if not exists executions (
  id uuid primary key default uuid_generate_v4(),
  task_id text,
  agent_id text,
  hermes_execution_id text unique,
  status text not null default 'QUEUED' check (status in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  trigger_source text,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms bigint,
  heartbeat_at timestamptz,
  result_summary text,
  error_message text,
  logs jsonb default '[]',
  cost_cents bigint not null default 0,
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_executions_task on executions(task_id);
create index if not exists idx_executions_agent on executions(agent_id);
create index if not exists idx_executions_hermes_id on executions(hermes_execution_id);
create index if not exists idx_executions_status on executions(status);
create index if not exists idx_executions_heartbeat on executions(heartbeat_at);

comment on table executions is 'Registros de execucao com heartbeats e rastreamento de custo.';
comment on column executions.heartbeat_at is 'Ultimo heartbeat recebido da execucao.';
comment on column executions.cost_cents is 'Custo da execucao em centavos (BRL).';
