-- ============================================================================
-- TokenizAi V2 — Migration 003: Agentes Runtime e Eventos de Lifecycle
-- ============================================================================
-- `agentes_runtime`: estado efetivo do agente no runtime Hermes (ponte com
-- `hermes_agent_id`). `agent_lifecycle_events`: audit trail de contratacao,
-- configuracao, pausa, resumo e termino.
-- Idempotente.
-- ============================================================================

-- ------------------------------------------------------------
-- agentes_runtime (estado efetivo no Hermes)
-- ------------------------------------------------------------
create table if not exists agentes_runtime (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  slug text unique not null,
  departamento_id text,
  papel text,
  hermes_agent_id text,
  hermes_profile_id text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo', 'suspenso', 'terminado')),
  life_cycle_state text not null default 'CREATED' check (life_cycle_state in ('CREATED', 'ACTIVE', 'PAUSED', 'TERMINATED', 'ERROR')),
  capabilities text[] default '{}',
  last_heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agentes_runtime_slug on agentes_runtime(slug);
create index if not exists idx_agentes_runtime_hermes_id on agentes_runtime(hermes_agent_id);
create index if not exists idx_agentes_runtime_status on agentes_runtime(status);

-- ------------------------------------------------------------
-- agent_lifecycle_events (audit trail do ciclo de vida)
-- ------------------------------------------------------------
create table if not exists agent_lifecycle_events (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid references agentes_runtime(id) on delete cascade,
  event_type text not null check (event_type in ('HIRE', 'CONFIGURE', 'PAUSE', 'RESUME', 'TERMINATE')),
  timestamp timestamptz not null default now(),
  payload jsonb default '{}',
  hermes_response jsonb default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_lifecycle_events_agent on agent_lifecycle_events(agent_id);
create index if not exists idx_agent_lifecycle_events_type on agent_lifecycle_events(event_type);
create index if not exists idx_agent_lifecycle_events_ts on agent_lifecycle_events(timestamp);

comment on table agentes_runtime is 'Estado efetivo do agente no runtime Hermes (ponte com hermes_agent_id).';
comment on table agent_lifecycle_events is 'Audit trail de eventos de ciclo de vida de agentes (HIRE, CONFIGURE, PAUSE, RESUME, TERMINATE).';
