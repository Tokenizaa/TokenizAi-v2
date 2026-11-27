-- ============================================================================
-- TokenizAi V2 — Migration 002: Modelo Organizacional (Empresas + Departamentos)
-- ============================================================================
-- Adiciona a unidade organizacional superior `empresas` e estende `departamentos`
-- com `empresa_id` (multi-tenant) e `pai_id` (hierarquia).
-- Idempotente: seguro para reexecucao em banco ja parcialmente migrado.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- empresas (unidade organizacional superior)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- estende departamentos com empresa_id
-- ------------------------------------------------------------
alter table departamentos
  add column if not exists empresa_id uuid references empresas(id);

-- cria indice para busca por empresa
create index if not exists idx_departamentos_empresa on departamentos(empresa_id);
create index if not exists idx_departamentos_pai on departamentos(departamento_pai_id);

-- ------------------------------------------------------------
-- estende perfis_empresariais com empresa_id
-- ------------------------------------------------------------
alter table perfis_empresariais
  add column if not exists empresa_id uuid references empresas(id);

create index if not exists idx_perfis_empresa on perfis_empresariais(empresa_id);

-- ------------------------------------------------------------
-- comentarios
-- ------------------------------------------------------------
comment on table empresas is 'Unidade organizacional superior (multi-tenant).';
comment on column departamentos.empresa_id is 'Empresa a que o departamento pertence.';
comment on column perfis_empresariais.empresa_id is 'Empresa a que o usuario pertence.';
