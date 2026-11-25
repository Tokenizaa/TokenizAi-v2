-- ============================================================================
-- TokenizAi V2 — Schema Supabase (Fonte de Verdade Empresarial)
-- ============================================================================
-- Este schema define as tabelas persistentes dos dados empresariais da
-- TokenizAi V2. O Supabase e a fonte de verdade para registros empresariais;
-- o Hermes e o runtime de execucao dos agentes (estado efetivo do runtime).
--
-- Nao duplicar indiscriminadamente o estado interno do Hermes no banco.
-- Persistir apenas registros empresariais, vinculos, historicos e eventos
-- necessarios para rastreabilidade.
-- ============================================================================

-- ------------------------------------------------------------
-- Extensoes
-- ------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- perfis_empresariais (usuarios da empresa)
-- ------------------------------------------------------------
create table if not exists perfis_empresariais (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  nome text not null,
  role text not null check (role in (
    'Diretoria Executiva',
    'Gestor Operacional',
    'Comercial & CRM',
    'Financeiro',
    'Auditor'
  )),
  departamento_id uuid,
  status text not null default 'Ativo' check (status in ('Ativo', 'Convidado')),
  avatar_url text,
  ultimo_acesso timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- departamentos (estrutura organizacional)
-- ------------------------------------------------------------
create table if not exists departamentos (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  codigo text unique not null,
  descricao text,
  departamento_pai_id uuid references departamentos(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table perfis_empresariais
  add constraint fk_perfil_departamento
  foreign key (departamento_id) references departamentos(id);

-- ------------------------------------------------------------
-- agentes_empresariais (cadastro de agentes da empresa)
-- ------------------------------------------------------------
create table if not exists agentes_empresariais (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  slug text unique not null,
  divisao text,
  papel text,
  departamento_id uuid references departamentos(id),
  -- Vinculo com o agente Hermes (runtime). nao eh o estado efetivo,
  -- apenas o identificador de correlacao.
  hermes_agent_id text,
  hermes_profile_id text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo', 'suspenso')),
  capabilities text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- clientes (deve vir antes de projetos por causa da FK)
-- ------------------------------------------------------------
create table if not exists clientes (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  segmento text,
  cnpj text,
  contato_principal text,
  email text,
  telefone text,
  gerente_conta text,
  status text not null default 'Ativo' check (status in ('Ativo', 'Em Implantação', 'Em Risco', 'Inativo')),
  mrr_brl numeric(14,2) not null default 0,
  ltv_brl numeric(14,2) not null default 0,
  since date,
  produtos text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- projetos (empresariais)
-- ------------------------------------------------------------
create table if not exists projetos (
  id uuid primary key default uuid_generate_v4(),
  codigo text unique not null,
  nome text not null,
  cliente_id uuid references clientes(id),
  cliente_nome text,
  stage text not null default 'Descoberta',
  owner_name text not null,
  start_date date,
  end_date date,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  budget_brl numeric(14,2) not null default 0,
  spent_brl numeric(14,2) not null default 0,
  -- Vinculo com projeto no runtime Hermes (se houver).
  hermes_project_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- entregas_de_projeto
-- ------------------------------------------------------------
create table if not exists entregas_de_projeto (
  id uuid primary key default uuid_generate_v4(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  titulo text not null,
  responsavel text not null,
  data_vencimento date,
  concluida boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- atividades_de_projeto
-- ------------------------------------------------------------
create table if not exists atividades_de_projeto (
  id uuid primary key default uuid_generate_v4(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  autor text not null,
  data text not null,
  resumo text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- interacoes_de_cliente
-- ------------------------------------------------------------
create table if not exists interacoes_de_cliente (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  data text not null,
  canal text not null check (canal in ('Reuniao', 'E-mail', 'Proposta', 'Suporte')),
  autor text not null,
  nota text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- negocios (deals / pipeline comercial)
-- ------------------------------------------------------------
create table if not exists negocios (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null,
  cliente_id uuid references clientes(id),
  cliente_nome text,
  stage text not null default 'Prospeccao',
  valor_brl numeric(14,2) not null default 0,
  probabilidade integer not null default 0 check (probabilidade >= 0 and probabilidade <= 100),
  owner_name text not null,
  expected_close date,
  next_step text,
  notas text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- produtos
-- ------------------------------------------------------------
create table if not exists produtos (
  id uuid primary key default uuid_generate_v4(),
  sku text unique not null,
  nome text not null,
  categoria text,
  billing_model text,
  price_brl numeric(14,2) not null default 0,
  margin_percent numeric(5,2) not null default 0,
  active_clients integer not null default 0,
  status text not null default 'Ativo' check (status in ('Ativo', 'Em Revisao', 'Inativo')),
  descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- assinaturas
-- ------------------------------------------------------------
create table if not exists assinaturas (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid references clientes(id),
  cliente_nome text,
  plano text not null,
  ciclo text not null check (ciclo in ('Mensal', 'Anual')),
  mrr_brl numeric(14,2) not null default 0,
  status text not null default 'Ativa' check (status in ('Ativa', 'Inadimplente', 'Em Teste', 'Cancelada')),
  next_billing_date date,
  overdue_days integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- pagamentos_de_assinatura
-- ------------------------------------------------------------
create table if not exists pagamentos_de_assinatura (
  id uuid primary key default uuid_generate_v4(),
  assinatura_id uuid not null references assinaturas(id) on delete cascade,
  data text not null,
  amount_brl numeric(14,2) not null default 0,
  metodo text not null check (metodo in ('Pix', 'Boleto', 'Cartao Corporativo')),
  status text not null default 'Pendente' check (status in ('Pago', 'Pendente', 'Falhou')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- lancamentos_financeiros
-- ------------------------------------------------------------
create table if not exists lancamentos_financeiros (
  id uuid primary key default uuid_generate_v4(),
  data text not null,
  descricao text not null,
  contraparte text not null,
  categoria text not null check (categoria in (
    'Assinaturas', 'Projetos', 'Infraestrutura Cloud', 'Operacao IA',
    'Folha & Parceiros', 'Impostos'
  )),
  tipo text not null check (tipo in ('Receber', 'Pagar')),
  status text not null check (status in ('Liquidado', 'Agendado', 'Em Atraso')),
  amount_brl numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- automacoes (fluxos de automatizacao empresa-Hermes)
-- ------------------------------------------------------------
create table if not exists automacoes (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  trigger text not null,
  action text not null,
  target_agent_name text not null,
  active boolean not null default true,
  runs_last_30d integer not null default 0,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- metas
-- ------------------------------------------------------------
create table if not exists metas (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null,
  descricao text,
  status text not null default 'ativa' check (status in ('ativa', 'concluida', 'arquivada')),
  nivel text,
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  owner_agent_id uuid references agentes_empresariais(id),
  parent_goal_id uuid references metas(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- aprovacoes (governanca empresarial)
-- ------------------------------------------------------------
create table if not exists aprovacoes (
  id uuid primary key default uuid_generate_v4(),
  tipo text,
  titulo text not null,
  descricao text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'rejeitada', 'em_revisao')),
  requested_by_agent_id uuid references agentes_empresariais(id),
  requested_by_name text,
  approver_user_id uuid references perfis_empresariais(id),
  issue_id uuid,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decision_note text,
  payload jsonb
);

-- ------------------------------------------------------------
-- auditoria (append-only, rastreabilidade)
-- ------------------------------------------------------------
create table if not exists auditoria (
  id uuid primary key default uuid_generate_v4(),
  timestamp timestamptz not null default now(),
  actor text not null,
  action text not null,
  target text not null,
  origin text not null default 'Plataforma' check (origin in ('Plataforma', 'Hermes Adapter', 'Seguranca')),
  metadata jsonb
);

-- ------------------------------------------------------------
-- runs (registros empresariais de execucao Hermes)
-- ------------------------------------------------------------
create table if not exists runs (
  id uuid primary key default uuid_generate_v4(),
  agent_id text,
  agent_name text,
  task_id uuid,
  task_identifier text,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  trigger_source text,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms bigint,
  result_summary text,
  error_message text,
  logs jsonb default '[]',
  cost_cents bigint,
  currency text default 'BRL',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- tasks (tarefas empresariais, vinculadas a tarefas Hermes quando aplicavel)
-- ------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null,
  descricao text,
  status text not null default 'todo',
  prioridade text,
  assignee_agent_id uuid references agentes_empresariais(id),
  assignee_agent_name text,
  projeto_id uuid references projetos(id),
  projeto_nome text,
  parent_id uuid references tasks(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- activities (atividade operacional empresarial)
-- ------------------------------------------------------------
create table if not exists activities (
  id uuid primary key default uuid_generate_v4(),
  timestamp timestamptz not null default now(),
  actor_name text not null,
  action text not null,
  target_type text,
  target_id text,
  target_name text,
  summary text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- costs (custos empresariais com origem e qualidade identificaveis)
-- ------------------------------------------------------------
create table if not exists costs (
  id uuid primary key default uuid_generate_v4(),
  agent_id text,
  agent_name text,
  cost_cents bigint not null default 0,
  currency text not null default 'BRL',
  cost_type text not null check (cost_type in ('confirmado', 'estimado', 'nao_apurado', 'indisponivel')),
  period_start date,
  period_end date,
  source text,
  evidence text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- attachments (metadados de anexos e documentos)
-- ------------------------------------------------------------
create table if not exists attachments (
  id uuid primary key default uuid_generate_v4(),
  filename text not null,
  content_type text,
  size_bytes bigint,
  storage_path text not null,
  uploaded_by uuid references perfis_empresariais(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Indices
-- ------------------------------------------------------------
create index if not exists idx_perfis_email on perfis_empresariais(email);
create index if not exists idx_perfis_departamento on perfis_empresariais(departamento_id);
create index if not exists idx_agentes_slug on agentes_empresariais(slug);
create index if not exists idx_agentes_departamento on agentes_empresariais(departamento_id);
create index if not exists idx_projetos_codigo on projetos(codigo);
create index if not exists idx_projetos_cliente on projetos(cliente_id);
create index if not exists idx_projetos_hermes on projetos(hermes_project_id);
create index if not exists idx_entregas_projeto on entregas_de_projeto(projeto_id);
create index if not exists idx_atividades_projeto on atividades_de_projeto(projeto_id);
create index if not exists idx_clientes_cnpj on clientes(cnpj);
create index if not exists idx_negocios_cliente on negocios(cliente_id);
create index if not exists idx_assinaturas_cliente on assinaturas(cliente_id);
create index if not exists idx_lancamentos_data on lancamentos_financeiros(data);
create index if not exists idx_auditoria_timestamp on auditoria(timestamp);
create index if not exists idx_auditoria_actor on auditoria(actor);
create index if not exists idx_runs_agent on runs(agent_id);
create index if not exists idx_runs_task on runs(task_id);
create index if not exists idx_runs_status on runs(status);
create index if not exists idx_tasks_projeto on tasks(projeto_id);
create index if not exists idx_tasks_assignee on tasks(assignee_agent_id);
create index if not exists idx_tasks_parent on tasks(parent_id);
create index if not exists idx_costs_agent on costs(agent_id);
create index if not exists idx_costs_type on costs(cost_type);
create index if not exists idx_attachments_uploaded_by on attachments(uploaded_by);

-- ------------------------------------------------------------
-- Row Level Security (RLS)
-- ------------------------------------------------------------
alter table perfis_empresariais enable row level security;
alter table departamentos enable row level security;
alter table agentes_empresariais enable row level security;
alter table projetos enable row level security;
alter table entregas_de_projeto enable row level security;
alter table atividades_de_projeto enable row level security;
alter table clientes enable row level security;
alter table interacoes_de_cliente enable row level security;
alter table negocios enable row level security;
alter table produtos enable row level security;
alter table assinaturas enable row level security;
alter table pagamentos_de_assinatura enable row level security;
alter table lancamentos_financeiros enable row level security;
alter table automacoes enable row level security;
alter table metas enable row level security;
alter table aprovacoes enable row level security;
alter table auditoria enable row level security;
alter table runs enable row level security;
alter table tasks enable row level security;
alter table activities enable row level security;
alter table costs enable row level security;
alter table attachments enable row level security;

-- Políticas: leitura autenticada para todas as tabelas empresariais.
-- A escrita é administrada por papel (role) via middleware da aplicação;
-- aqui restringimos a leitura a usuários autenticados como base mínima.
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'perfis_empresariais' and policyname = 'Leitura autenticada - perfis_empresariais') then
    create policy "Leitura autenticada - perfis_empresariais" on perfis_empresariais for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'departamentos' and policyname = 'Leitura autenticada - departamentos') then
    create policy "Leitura autenticada - departamentos" on departamentos for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'agentes_empresariais' and policyname = 'Leitura autenticada - agentes_empresariais') then
    create policy "Leitura autenticada - agentes_empresariais" on agentes_empresariais for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'projetos' and policyname = 'Leitura autenticada - projetos') then
    create policy "Leitura autenticada - projetos" on projetos for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'entregas_de_projeto' and policyname = 'Leitura autenticada - entregas_de_projeto') then
    create policy "Leitura autenticada - entregas_de_projeto" on entregas_de_projeto for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'atividades_de_projeto' and policyname = 'Leitura autenticada - atividades_de_projeto') then
    create policy "Leitura autenticada - atividades_de_projeto" on atividades_de_projeto for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clientes' and policyname = 'Leitura autenticada - clientes') then
    create policy "Leitura autenticada - clientes" on clientes for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'interacoes_de_cliente' and policyname = 'Leitura autenticada - interacoes_de_cliente') then
    create policy "Leitura autenticada - interacoes_de_cliente" on interacoes_de_cliente for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'negocios' and policyname = 'Leitura autenticada - negocios') then
    create policy "Leitura autenticada - negocios" on negocios for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'produtos' and policyname = 'Leitura autenticada - produtos') then
    create policy "Leitura autenticada - produtos" on produtos for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'assinaturas' and policyname = 'Leitura autenticada - assinaturas') then
    create policy "Leitura autenticada - assinaturas" on assinaturas for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'pagamentos_de_assinatura' and policyname = 'Leitura autenticada - pagamentos_de_assinatura') then
    create policy "Leitura autenticada - pagamentos_de_assinatura" on pagamentos_de_assinatura for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'lancamentos_financeiros' and policyname = 'Leitura autenticada - lancamentos_financeiros') then
    create policy "Leitura autenticada - lancamentos_financeiros" on lancamentos_financeiros for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'automacoes' and policyname = 'Leitura autenticada - automacoes') then
    create policy "Leitura autenticada - automacoes" on automacoes for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'metas' and policyname = 'Leitura autenticada - metas') then
    create policy "Leitura autenticada - metas" on metas for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'aprovacoes' and policyname = 'Leitura autenticada - aprovacoes') then
    create policy "Leitura autenticada - aprovacoes" on aprovacoes for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'auditoria' and policyname = 'Leitura autenticada - auditoria') then
    create policy "Leitura autenticada - auditoria" on auditoria for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'runs' and policyname = 'Leitura autenticada - runs') then
    create policy "Leitura autenticada - runs" on runs for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'tasks' and policyname = 'Leitura autenticada - tasks') then
    create policy "Leitura autenticada - tasks" on tasks for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'activities' and policyname = 'Leitura autenticada - activities') then
    create policy "Leitura autenticada - activities" on activities for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'costs' and policyname = 'Leitura autenticada - costs') then
    create policy "Leitura autenticada - costs" on costs for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'attachments' and policyname = 'Leitura autenticada - attachments') then
    create policy "Leitura autenticada - attachments" on attachments for select to authenticated using (true);
  end if;
end $$;

-- Comentarios para documentacao
comment on table perfis_empresariais is 'Usuarios e perfis empresariais da TokenizAi.';
comment on table departamentos is 'Departamentos e estrutura organizacional.';
comment on table agentes_empresariais is 'Cadastro empresarial de agentes (vinculo com Hermes runtime).';
comment on table auditoria is 'Log de auditoria append-only para rastreabilidade.';
comment on table runs is 'Registros empresariais de execucao de agentes Hermes.';
comment on table costs is 'Custos empresariais com origem e qualidade identificaveis (nao tratar nao_apurado como zero).';
