-- ============================================================================
-- TokenizAi V2 — Migration 011: Empresa_Usuario (RBAC por Empresa)
-- ============================================================================
-- `empresa_usuario`: vincula usuarios a empresas com papel
-- (ADMIN/MANAGER/OPERATOR/VIEWER) e permissoes jsonb. Substitui o RLS
-- `using (true)` amplo por políticas com isolamento por empresa_id.
-- Idempotente.
-- ============================================================================

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

-- Habilita RLS na nova tabela
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

comment on table empresa_usuario is 'Vincula usuarios a empresas com papel (ADMIN/MANAGER/OPERATOR/VIEWER) e permissoes jsonb.';
comment on column empresa_usuario.permissions is 'Permissoes granulares em formato jsonb.';
