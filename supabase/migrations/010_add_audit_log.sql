-- ============================================================================
-- TokenizAi V2 — Migration 010: Audit Log Estruturado
-- ============================================================================
-- `audit_log`: registro estruturado de mutacoes com ip, session_token,
-- old_values/new_values para rastreabilidade completa.
-- Complementa a tabela `auditoria` (schema 001) com campos de auditoria riguroso.
-- Idempotente.
-- ============================================================================

create table if not exists audit_log (
  id uuid primary key default uuid_generate_v4(),
  timestamp timestamptz not null default now(),
  actor text not null,
  actor_email text,
  action text not null,
  target text not null,
  target_type text,
  origin text not null default 'Plataforma' check (origin in ('Plataforma', 'Hermes Adapter', 'Seguranca')),
  ip text,
  session_token text,
  old_values jsonb default '{}',
  new_values jsonb default '{}',
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_timestamp on audit_log(timestamp);
create index if not exists idx_audit_log_actor on audit_log(actor);
create index if not exists idx_audit_log_action on audit_log(action);
create index if not exists idx_audit_log_target on audit_log(target);

comment on table audit_log is 'Registro estruturado de mutacoes para rastreabilidade completa.';
comment on column audit_log.old_values is 'Valores antes da mutacao.';
comment on column audit_log.new_values is 'Valores apos a mutacao.';
comment on column audit_log.session_token is 'Token de sessao da operacao (para correlacao).';
