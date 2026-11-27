-- ============================================================================
-- TokenizAi V2 — Migration 009: Orcamentos (Budgets)
-- ============================================================================
-- `budgets`: orcamentos empresariais com amount_cents, spent_cents,
-- alert_threshold_pct e dataQuality. Substitui o display enganoso de
-- "teto mensal = gasto".
-- Idempotente.
-- ============================================================================

create table if not exists budgets (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id),
  nome text not null,
  descricao text,
  period text not null check (period in ('Mensal', 'Anual')),
  amount_cents bigint not null default 0,
  spent_cents bigint not null default 0,
  alert_threshold_pct integer not null default 80 check (alert_threshold_pct >= 0 and alert_threshold_pct <= 100),
  dataQuality text check (dataQuality in ('confirmado', 'estimado', 'nao_apurado', 'indisponivel')),
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'arquivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_budgets_empresa on budgets(empresa_id);
create index if not exists idx_budgets_period on budgets(period);
create index if not exists idx_budgets_status on budgets(status);

-- View auxiliando o resumo orcamentario (amount - spent = restante)
create or replace view budget_resumo as
  select
    id,
    empresa_id,
    nome,
    period,
    amount_cents,
    spent_cents,
    (amount_cents - spent_cents) as restante_cents,
    alert_threshold_pct,
    case
      when amount_cents > 0 then round(((spent_cents::numeric / amount_cents) * 100)::numeric, 2)
      else 0
    end as uso_pct,
    dataQuality,
    status,
    updated_at
  from budgets;

comment on table budgets is 'Orcamentos empresariais com amount_cents, spent_cents e alert_threshold_pct.';
comment on column budgets.restante_cents is 'Calculado: amount_cents - spent_cents.';
comment on column budgets.dataQuality is 'Qualidade do dado: confirmado/estimado/nao_apurado/indisponivel.';
