-- ============================================================================
-- TokenizAi V2 — Migrações 002 a 011 (aplicar via SQL Editor do Supabase)
-- Projeto: udeglcdloehagljrrukj
-- Execute este script inteiro no SQL Editor do painel Supabase.
-- Todas as instruções são idempotentes (safe para reexecução).
-- ============================================================================

-- 002_add_organizational_model.sql
create extension if not exists "uuid-ossp";

create table if not exists empresas (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  codigo text unique not null,
  cnpj text,
  email text,
  telefone text,
  plano text not null default 'basico' check (plano in ('basico', 'profissional', 'empresarial')),
  status text not null default 'ativa' check (status in ('ativa', 'suspensa', 'cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table departamentos add column if not exists empresa_id uuid references empresas(id);
create index if not exists idx_departamentos_empresa on departamentos(empresa_id);
create index if not exists idx_departamentos_pai on departamentos(departamento_pai_id);

alter table perfis_empresariais add column if not exists empresa_id uuid references empresas(id);
create index if not exists idx_perfis_empresa on perfis_empresariais(empresa_id);

-- 003_add_agent_lifecycle.sql
create table if not exists agentes_runtime (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  slug text unique not null,
  divisao text,
  papel text,
  departamento_id uuid references departamentos(id),
  status text not null default 'ativo' check (status in ('ativo', 'inativo', 'suspenso')),
  capabilities text[] default '{}',
  hermes_agent_id text,
  hermes_profile_id text,
  last_heartbeat_at timestamptz,
  life_cycle_state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_lifecycle_events (
  id uuid primary key default uuid_generate_v4(),
  agente_id uuid references agentes_runtime(id),
  event_type text not null check (event_type in ('HIRE', 'CONFIGURE', 'PAUSE', 'RESUME', 'TERMINATE')),
  timestamp timestamptz not null default now(),
  payload jsonb not null default '{}',
  hermes_response jsonb
);

-- 004_add_skills_catalog.sql
create table if not exists skills_catalog (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  version text,
  manifest jsonb not null default '{}',
  source text not null check (source in ('agency-agents', 'paperclip', 'custom')),
  source_ref text,
  install_count integer not null default 0,
  last_reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 005_add_task_hierarchy.sql
create table if not exists task_hierarchy (
  id uuid primary key default uuid_generate_v4(),
  parent_task uuid references task_hierarchy(id),
  child_task uuid references task_hierarchy(id),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'completed', 'blocked', 'failed')),
  assigned_agent uuid references agentes_runtime(id),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 006_add_executions.sql
create table if not exists executions (
  id uuid primary key default uuid_generate_v4(),
  agente_id uuid references agentes_runtime(id),
  task_id uuid references tasks(id),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  trigger_source text,
  hermes_execution_id text,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms bigint,
  result_summary text,
  error_message text,
  logs jsonb default '[]',
  cost_cents bigint,
  currency text default 'BRL',
  heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 007_add_routines.sql
create table if not exists routines (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  descricao text,
  trigger_type text not null default 'cron' check (trigger_type in ('cron', 'manual', 'event')),
  cron text,
  execution_limit integer not null default 0,
  active boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 008_add_connectors.sql
create table if not exists connectors (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  tipo text not null,
  configuracao jsonb not null default '{}',
  status text not null default 'inativo' check (status in ('ativo', 'inativo', 'erro')),
  ultima_sincronizacao timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 009_add_budgets.sql
create table if not exists budgets (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id),
  nome text not null,
  amount_cents bigint not null default 0,
  spent_cents bigint not null default 0,
  alert_threshold_pct integer not null default 80 check (alert_threshold_pct >= 0 and alert_threshold_pct <= 100),
  periodo text not null default 'mensal' check (periodo in ('mensal', 'anual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 010_add_audit_log.sql
create table if not exists audit_log (
  id uuid primary key default uuid_generate_v4(),
  timestamp timestamptz not null default now(),
  actor text not null,
  action text not null,
  target text not null,
  origin text not null default 'Plataforma' check (origin in ('Plataforma', 'Hermes Adapter', 'Seguranca')),
  metadata jsonb not null default '{}'
);

-- 011_add_empresa_usuario.sql
create table if not exists empresa_usuario (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid not null references perfis_empresariais(id) on delete cascade,
  role text not null default 'VIEWER' check (role in ('ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER')),
  permissions jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint empresa_usuario_unique unique (empresa_id, usuario_id)
);

create index if not exists idx_empresa_usuario_empresa on empresa_usuario(empresa_id);
create index if not exists idx_empresa_usuario_usuario on empresa_usuario(usuario_id);
create index if not exists idx_empresa_usuario_role on empresa_usuario(role);

alter table empresa_usuario enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'empresa_usuario' and policyname = 'Isolamento por empresa - empresa_usuario') then
    create policy "Isolamento por empresa - empresa_usuario" on empresa_usuario
      for all to authenticated
      using (
        empresa_id in (
          select empresa_id from empresa_usuario where usuario_id = auth.uid()
        )
        or exists (
          select 1 from perfis_empresariais pe
          where pe.id = auth.uid() and pe.role = 'Diretoria Executiva'
        )
      )
      with check (
        empresa_id in (
          select empresa_id from empresa_usuario where usuario_id = auth.uid() and role = 'ADMIN'
        )
        or exists (
          select 1 from perfis_empresariais pe
          where pe.id = auth.uid() and pe.role = 'Diretoria Executiva'
        )
      );
  end if;
end $$;

-- ============================================================================
-- FIM DAS MIGRAÇÕES 002-011
-- Após aplicar, definir useSupabase = true no backend e configurar as
-- variáveis de ambiente de produção (ver DEPLOYMENT_VERCEL.md).
-- ============================================================================
