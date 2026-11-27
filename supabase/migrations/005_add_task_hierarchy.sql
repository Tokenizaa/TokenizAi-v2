-- ============================================================================
-- TokenizAi V2 — Migration 005: Hierarquia de Tarefas (Task Hierarchy)
-- ============================================================================
-- `task_hierarchy`: hierarquia explícita de subtarefas (parent/child) com
-- progresso, prazo e agente atribuído. Ponte para `agentes_runtime`.
-- `tasks` ja possui `parent_id self-FK` no schema 001; esta tabela adiciona
-- o modelo de visibilidade/gerenciamento da hierarquia.
-- Idempotente.
-- ============================================================================

create table if not exists task_hierarchy (
  id uuid primary key default uuid_generate_v4(),
  parent_task uuid references task_hierarchy(id) on delete cascade,
  child_task uuid references task_hierarchy(id) on delete cascade,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done', 'blocked')),
  assigned_agent uuid references agentes_runtime(id),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_hierarchy_no_self_loop check (parent_task <> child_task)
);

create index if not exists idx_task_hierarchy_parent on task_hierarchy(parent_task);
create index if not exists idx_task_hierarchy_child on task_hierarchy(child_task);
create index if not exists idx_task_hierarchy_agent on task_hierarchy(assigned_agent);

-- garante que tasks tenha colunas de hierarquia (compatibilidade com schema 001)
alter table tasks
  add column if not exists progress integer not null default 0 check (progress >= 0 and progress <= 100),
  add column if not exists deadline date;

create index if not exists idx_tasks_progress on tasks(progress);
create index if not exists idx_tasks_deadline on tasks(deadline);

comment on table task_hierarchy is 'Hierarquia de subtarefas (parent/child) com progresso, prazo e agente.';
comment on column tasks.progress is 'Progresso da tarefa (0-100).';
comment on column tasks.deadline is 'Prazo de entrega da tarefa.';
