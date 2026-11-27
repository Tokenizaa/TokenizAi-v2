-- ============================================================================
-- TokenizAi V2 — Migration 004: Catalogo de Skills Versionado
-- ============================================================================
-- `skills_catalog`: catalogo versionado de skills, com manifest, fonte e
-- estado de reconciliacao (CURRENT / OUTDATED / MODIFIED / REMOVED / FOREIGN).
-- Idempotente.
-- ============================================================================

create table if not exists skills_catalog (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  version text not null,
  manifest jsonb default '{}',
  source text not null default 'custom' check (source in ('agency-agents', 'paperclip', 'custom')),
  source_ref text,
  install_count integer not null default 0,
  last_reconciled_at timestamptz,
  progress text check (progress in ('CURRENT', 'OUTDATED', 'MODIFIED', 'REMOVED', 'FOREIGN')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_skills_catalog_name on skills_catalog(name);
create index if not exists idx_skills_catalog_source on skills_catalog(source);
create index if not exists idx_skills_catalog_progress on skills_catalog(progress);

comment on table skills_catalog is 'Catalogo versionado de skills com manifest e estado de reconciliacao.';
comment on column skills_catalog.progress is 'Estado da skill em relacao ao runtime: CURRENT/OUTDATED/MODIFIED/REMOVED/FOREIGN.';
