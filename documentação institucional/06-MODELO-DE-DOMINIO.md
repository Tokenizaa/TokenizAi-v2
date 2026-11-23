# Modelo de Domínio — NettosCorp Enterprise

> **Versão:** 1.0  
> **Data:** 21 de novembro de 2026  
> **Status:** **PROPOSTA** — Baseado em Paperclip (480 tabelas) + Agency Agents + TokenizAi  
> **Responsável:** Hermes

---

## 1. Princípios de Modelagem

| Princípio | Aplicação |
|-----------|-----------|
| **Company-Scoped** | Todas entidades de domínio têm `company_id` (RLS ready) |
| **Immutable Core** | Entidades base (Company, User, Role) imutáveis após criação |
| **Versioned Entities** | Agentes, Skills, Workspaces, Routines — versionados com audit trail |
| **Clearance-Aware** | Cada entidade sensível tem `clearance_level` (public/internal/restricted/classified) |
| **Attributed Changes** | Toda mutação registra `author_id`, `timestamp`, `clearance`, `evidence_ref` |
| **Soft Delete Only** | Nenhuma exclusão física — `deleted_at` + `deleted_by` + reason |

---

## 2. Entidades Core (Nível Organização)

### 2.1 Company (Tenant Root)

```sql
CREATE TABLE companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  parent_company_id UUID REFERENCES companies(id),  -- Holding structure
  settings        JSONB NOT NULL DEFAULT '{}',      -- Configs globais
  clearance_level TEXT NOT NULL DEFAULT 'internal', -- public|internal|restricted|classified
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID REFERENCES auth_users(id)
);
```

### 2.2 Auth User (Pessoa Física)

```sql
CREATE TABLE auth_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  avatar_url      TEXT,
  metadata        JSONB DEFAULT '{}',               -- Provider data, preferences
  is_system       BOOLEAN DEFAULT false,            -- Service accounts
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
```

### 2.3 Company Membership (User ↔ Company + Role)

```sql
CREATE TABLE company_memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  user_id         UUID NOT NULL REFERENCES auth_users(id),
  role_id         UUID NOT NULL REFERENCES roles(id),
  clearance_level TEXT NOT NULL DEFAULT 'internal', -- Herdado do role, pode ser elevado
  status          TEXT NOT NULL DEFAULT 'active',   -- active|suspended|pending
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at         TIMESTAMPTZ,
  UNIQUE (company_id, user_id)
);
```

### 2.4 Role (Cargo Institucional)

```sql
CREATE TABLE roles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),  -- NULL = global role
  name                TEXT NOT NULL,                            -- "Senior Developer", "Security Architect"
  slug                TEXT NOT NULL,                            -- "senior-developer"
  department          TEXT,                                     -- "engineering", "security", "finance"
  clearance_level     TEXT NOT NULL DEFAULT 'internal',         -- public|internal|restricted|classified
  authority           TEXT[] DEFAULT '{}',                      -- ["execute", "approve", "delegate", "budget"]
  permissions         JSONB DEFAULT '{}',                       -- Granular: {"issues": ["read","write"], "agents": ["execute"]}
  reports_to_role_id  UUID REFERENCES roles(id),                -- Hierarquia
  is_agent_role       BOOLEAN DEFAULT false,                    -- True se pode ser assumido por agente
  agent_division      TEXT,                                     -- Mapeia para Agency Agents division
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 3. Entidades de Agentes (Paperclip + Agency Agents)

### 3.1 Agent (Instância de Cargo)

```sql
CREATE TABLE agents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  role_id             UUID NOT NULL REFERENCES roles(id),       -- Contrato de cargo
  name                TEXT NOT NULL,                            -- "engineering-senior-developer-001"
  display_name        TEXT,                                     -- Nome amigável
  status              TEXT NOT NULL DEFAULT 'provisioned',      -- provisioned|active|suspended|decommissioned
  config              JSONB NOT NULL DEFAULT '{}',              -- Config runtime (model, tools, etc.)
  runtime_state       JSONB,                                    -- Estado atual (Paperclip agent_runtime_state)
  clearance_level     TEXT NOT NULL,                            -- Herdado do role
  authority           TEXT[] DEFAULT '{}',                      -- Herdado + sobrescrito
  budget_policy_id    UUID REFERENCES budget_policies(id),
  provisioned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at        TIMESTAMPTZ,
  decommissioned_at   TIMESTAMPTZ,
  created_by          UUID NOT NULL REFERENCES auth_users(id),
  UNIQUE (company_id, name)
);
```

### 3.2 Agent Config Revision (Versionamento)

```sql
CREATE TABLE agent_config_revisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES agents(id),
  config          JSONB NOT NULL,
  instructions    TEXT,                                         -- Prompt completo (Agency Agents body)
  frontmatter     JSONB,                                        -- Agency Agents frontmatter estendido
  version         INT NOT NULL,                                 -- Auto-increment per agent
  change_summary  TEXT,
  author_id       UUID NOT NULL REFERENCES auth_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, version)
);
```

### 3.3 Agent Runtime State (Paperclip)

```sql
CREATE TABLE agent_runtime_state (
  agent_id              UUID PRIMARY KEY REFERENCES agents(id),
  current_task_id       UUID,                                   -- Task em execução
  last_heartbeat        TIMESTAMPTZ,
  consecutive_failures  INT DEFAULT 0,
  total_runs            BIGINT DEFAULT 0,
  total_cost_cents      BIGINT DEFAULT 0,
  metadata              JSONB DEFAULT '{}',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.4 Agent Division Mapping (Agency Agents → NettosCorp)

```sql
CREATE TABLE agent_division_mapping (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_division         TEXT NOT NULL UNIQUE,                 -- "engineering", "security", etc.
  nettoscorp_department   TEXT NOT NULL,                        -- "engineering", "security", "finance"
  default_role_slug       TEXT NOT NULL,                        -- "senior-developer", "security-architect"
  default_clearance       TEXT NOT NULL DEFAULT 'internal',
  authority_template      TEXT[] DEFAULT '{}',                  -- ["execute", "delegate"]
  is_active               BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Dados iniciais: 21 divisões do Agency Agents → 21 roles NettosCorp
```

---

## 4. Entidades de Skills (Paperclip Skill Catalog + Agency Agents)

### 4.1 Skill Package

```sql
CREATE TABLE skill_packages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID REFERENCES companies(id),            -- NULL = global/public
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL,
  version             TEXT NOT NULL,                            -- SemVer
  source              TEXT NOT NULL,                            -- "agency-agents" | "paperclip" | "custom"
  source_ref          TEXT,                                     -- Agency Agents slug ou Paperclip skill id
  manifest            JSONB NOT NULL,                           -- Skill manifest (Paperclip format)
  instructions        TEXT,                                     -- Prompt completo (Agency Agents body)
  frontmatter         JSONB,                                    -- Agency Agents frontmatter estendido
  division            TEXT,                                     -- Agency Agents division
  required_tools      TEXT[] DEFAULT '{}',                      -- Tools necessárias
  required_clearance  TEXT DEFAULT 'internal',
  is_active           BOOLEAN DEFAULT true,
  published_at        TIMESTAMPTZ,
  created_by          UUID REFERENCES auth_users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug, version)
);
```

### 4.2 Skill Version (Versionamento SemVer)

```sql
CREATE TABLE skill_versions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_package_id    UUID NOT NULL REFERENCES skill_packages(id),
  version             TEXT NOT NULL,                            -- "1.2.3"
  changelog           TEXT,
  manifest_diff       JSONB,                                    -- Diff vs versão anterior
  is_latest           BOOLEAN DEFAULT false,
  published_at        TIMESTAMPTZ,
  created_by          UUID REFERENCES auth_users(id),
  UNIQUE (skill_package_id, version)
);
```

### 4.3 Skill Install Ledger (Paperclip Reconcile Engine)

```sql
CREATE TABLE skill_install_ledger (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  skill_package_id    UUID NOT NULL REFERENCES skill_packages(id),
  version             TEXT NOT NULL,
  scope               TEXT NOT NULL,                            -- "user" | "project" | "company"
  target_path         TEXT NOT NULL,                            -- Caminho instalado
  source_hash         CHAR(64) NOT NULL,                        -- SHA256 do source (corpus)
  rendered_hash       CHAR(64) NOT NULL,                        -- SHA256 do rendered output
  body_hash           CHAR(64) NOT NULL,                        -- SHA256 do body (instructions)
  status              TEXT NOT NULL DEFAULT 'current',          -- current|outdated|modified|removed|foreign
  installed_by        UUID REFERENCES auth_users(id),
  installed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reconciled_at  TIMESTAMPTZ,
  reconcile_status    TEXT,
  UNIQUE (company_id, skill_package_id, version, scope, target_path)
);
```

---

## 5. Entidades de Orquestração (Paperclip + NEXUS)

### 5.1 Task (Unidade de Trabalho)

```sql
CREATE TABLE tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  project_id          UUID REFERENCES projects(id),
  title               TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',          -- pending|assigned|in_progress|qa|blocked|done|failed
  priority            INT DEFAULT 0,                            -- -10 a 10
  assignee_agent_id   UUID REFERENCES agents(id),               -- Agent responsável
  assignee_user_id    UUID REFERENCES auth_users(id),           -- Fallback humano
  parent_task_id      UUID REFERENCES tasks(id),                -- Subtasks
  spec_ref            TEXT,                                     -- Link para spec/doc
  acceptance_criteria JSONB DEFAULT '[]',                       -- Critérios de aceite
  qa_evidence         JSONB DEFAULT '{}',                       -- Screenshots, logs, test results
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  failure_reason      TEXT,
  retry_count         INT DEFAULT 0,
  max_retries         INT DEFAULT 3,                            -- NEXUS default
  created_by          UUID REFERENCES auth_users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.2 Task Delegation (Handoff)

```sql
CREATE TABLE task_delegations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_task_id          UUID NOT NULL REFERENCES tasks(id),
  child_task_id           UUID NOT NULL REFERENCES tasks(id),
  delegator_agent_id      UUID REFERENCES agents(id),           -- Agent que delegou
  delegatee_agent_id      UUID REFERENCES agents(id),           -- Agent que recebeu
  context                 JSONB DEFAULT '{}',                   -- Contexto passado
  status                  TEXT NOT NULL DEFAULT 'pending',      -- pending|accepted|completed|failed
  result                  JSONB,                                -- Resultado retornado
  evidence                JSONB,                                -- Evidência (NEXUS QA)
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at            TIMESTAMPTZ
);
```

### 5.3 NEXUS Pipeline State

```sql
CREATE TABLE nexus_pipelines (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id),
  project_id              UUID REFERENCES projects(id),
  name                    TEXT NOT NULL,
  phase                   TEXT NOT NULL DEFAULT 'planning',     -- planning|architecture|development|integration|done
  pm_agent_id             UUID REFERENCES agents(id),           -- Project Manager
  architect_agent_id      UUID REFERENCES agents(id),           -- ArchitectUX
  current_task_id         UUID REFERENCES tasks(id),
  task_list               JSONB DEFAULT '[]',                   -- Ordered task IDs
  qa_agent_id             UUID REFERENCES agents(id),           -- EvidenceQA
  integration_agent_id    UUID REFERENCES agents(id),           -- Reality Checker
  started_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  created_by              UUID REFERENCES auth_users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 6. Entidades de Workspace e Execução (Paperclip)

### 6.1 Execution Workspace

```sql
CREATE TABLE execution_workspaces (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id),
  project_id              UUID REFERENCES projects(id),
  agent_id                UUID REFERENCES agents(id),
  task_id                 UUID REFERENCES tasks(id),
  name                    TEXT NOT NULL,
  repo_url                TEXT,
  repo_branch             TEXT,
  working_dir             TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'created',      -- created|initializing|ready|running|completed|failed
  runtime_config          JSONB DEFAULT '{}',                   -- Sandbox provider, resources, env
  sandbox_provider        TEXT,                                 -- daytona|e2b|modal|k8s|etc.
  sandbox_id              TEXT,                                 -- Provider-specific ID
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at                TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  failed_at               TIMESTAMPTZ
);
```

### 6.2 Workspace Snapshot (Recovery)

```sql
CREATE TABLE workspace_snapshots (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES execution_workspaces(id),
  trigger                 TEXT NOT NULL,                        -- manual|periodic|pre_task|post_task|pre_delegate
  git_commit              TEXT,                                 -- SHA
  git_status              TEXT,                                 -- clean|dirty
  file_manifest           JSONB,                                -- {path: hash}
  size_bytes              BIGINT,
  storage_path            TEXT,                                 -- S3/R2/local path
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.3 Workspace Restore Point

```sql
CREATE TABLE workspace_restore_points (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES execution_workspaces(id),
  snapshot_id             UUID REFERENCES workspace_snapshots(id),
  name                    TEXT,                                 -- "pre-delegate-001"
  status                  TEXT NOT NULL DEFAULT 'pending',      -- pending|restoring|completed|failed
  restored_at             TIMESTAMPTZ,
  restored_by             UUID REFERENCES auth_users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 7. Entidades de Comunicação (Paperclip Chat + Hermes)

### 7.1 Chat Channel (Multi-provider)

```sql
CREATE TABLE chat_channels (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id),
  provider                TEXT NOT NULL,                        -- discord|slack|github|telegram|teams
  external_id             TEXT NOT NULL,                        -- Provider-specific channel ID
  name                    TEXT,
  config                  JSONB DEFAULT '{}',                   -- Webhook URLs, bot tokens, etc.
  status                  TEXT NOT NULL DEFAULT 'active',       -- active|paused|archived
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider, external_id)
);
```

### 7.2 Chat Conversation (Thread)

```sql
CREATE TABLE chat_conversations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id              UUID NOT NULL REFERENCES chat_channels(id),
  external_thread_id      TEXT,                               -- Provider thread ID
  subject                 TEXT,
  status                  TEXT NOT NULL DEFAULT 'open',         -- open|closed|archived
  metadata                JSONB DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at               TIMESTAMPTZ
);
```

### 7.3 Chat Delivery (Message Tracking)

```sql
CREATE TABLE chat_deliveries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id         UUID NOT NULL REFERENCES chat_conversations(id),
  agent_id                UUID REFERENCES agents(id),           -- Sender agent
  user_id                 UUID REFERENCES auth_users(id),       -- Sender user
  direction               TEXT NOT NULL,                        -- inbound|outbound
  content                 TEXT NOT NULL,
  content_type            TEXT DEFAULT 'text',                  -- text|markdown|blocks|files
  external_message_id     TEXT,                               -- Provider message ID
  status                  TEXT NOT NULL DEFAULT 'pending',      -- pending|sent|delivered|failed|read
  sent_at                 TIMESTAMPTZ,
  delivered_at            TIMESTAMPTZ,
  read_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 8. Entidades de Orçamento e Custos (Paperclip)

### 8.1 Budget Policy

```sql
CREATE TABLE budget_policies (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id),
  name                    TEXT NOT NULL,
  scope                   TEXT NOT NULL,                        -- company|project|agent|department
  scope_ref               UUID,                                 -- Ref to project/agent/department
  limit_cents             BIGINT NOT NULL,                      -- Limite em centavos
  period                  TEXT NOT NULL,                        -- daily|weekly|monthly|quarterly|yearly
  alert_thresholds        INT[] DEFAULT '{50,75,90}',           -- Percentuais de alerta
  enforcement             TEXT NOT NULL DEFAULT 'warn',         -- warn|block|throttle
  is_active               BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 8.2 Cost Event (Run Accounting)

```sql
CREATE TABLE cost_events (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id),
  agent_id                UUID REFERENCES agents(id),
  task_id                 UUID REFERENCES tasks(id),
  run_id                  UUID,                                 -- Paperclip run ID
  category                TEXT NOT NULL,                        -- llm|tool|storage|network|compute
  provider                TEXT,                                 -- anthropic|openai|google|etc.
  model                   TEXT,                                 -- claude-3-5-sonnet|gpt-4o|etc.
  input_tokens            BIGINT DEFAULT 0,
  output_tokens           BIGINT DEFAULT 0,
  cost_cents              BIGINT NOT NULL,
  currency                TEXT DEFAULT 'USD',
  metadata                JSONB DEFAULT '{}',
  recorded_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 9. Entidades de Auditoria e Governança

### 9.1 Audit Log (Immutable)

```sql
CREATE TABLE audit_logs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id),
  actor_type              TEXT NOT NULL,                        -- user|agent|system
  actor_id                UUID NOT NULL,                        -- user_id ou agent_id
  action                  TEXT NOT NULL,                        -- create|update|delete|delegate|approve|spawn
  resource_type           TEXT NOT NULL,                        -- agent|skill|task|workspace|budget
  resource_id             UUID,
  before_state            JSONB,                                -- Estado anterior
  after_state             JSONB,                                -- Estado posterior
  clearance_used          TEXT,                                 -- Clearance do actor no momento
  authority_used          TEXT[],                               -- Authority exercida
  ip_address              INET,
  user_agent              TEXT,
  request_id              UUID,                                 -- Correlation ID
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Índice: (company_id, created_at DESC), (resource_type, resource_id)
```

### 9.2 Approval Request (Gates)

```sql
CREATE TABLE approval_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id),
  requester_type          TEXT NOT NULL,                        -- user|agent
  requester_id            UUID NOT NULL,
  action                  TEXT NOT NULL,                        -- delegate|spawn|budget_override|tool_access|deploy
  resource_type           TEXT NOT NULL,
  resource_id             UUID,
  context                 JSONB DEFAULT '{}',                   -- Justificativa, parâmetros
  required_approvers      UUID[] NOT NULL,                      -- User IDs que devem aprovar
  status                  TEXT NOT NULL DEFAULT 'pending',      -- pending|approved|rejected|expired
  decided_by              UUID REFERENCES auth_users(id),
  decided_at              TIMESTAMPTZ,
  decision_reason         TEXT,
  expires_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 10. Entidades de Memória Institucional

### 10.1 Knowledge Document (RAG Source)

```sql
CREATE TABLE knowledge_documents (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id),
  title                   TEXT NOT NULL,
  content                 TEXT NOT NULL,                        -- Markdown/texto
  content_hash            CHAR(64) NOT NULL,                    -- SHA256 para dedup
  source_type             TEXT NOT NULL,                        -- agent_output|decision|incident|doc|code|spec
  source_ref              UUID,                                 -- Ref à entidade origem
  author_id               UUID REFERENCES auth_users(id),       -- Quem produziu
  agent_id                UUID REFERENCES agents(id),           -- Se produzido por agente
  clearance_level         TEXT NOT NULL DEFAULT 'internal',
  tags                    TEXT[] DEFAULT '{}',
  embedding_id            UUID,                                 -- Ref ao vector DB
  graph_node_id           UUID,                                 -- Ref ao knowledge graph
  version                 INT DEFAULT 1,
  supersedes_id           UUID REFERENCES knowledge_documents(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 10.2 Knowledge Graph Nodes (Apache Age / Neo4j)

```cypher
// Nodes
(:Agent {id, name, company_id, division, clearance})
(:Skill {id, name, version, division, clearance})
(:Task {id, title, status, company_id})
(:Decision {id, title, author, company_id, timestamp})
(:Incident {id, title, severity, company_id})
(:Pattern {id, name, description, domain})
(:Document {id, title, source_type, company_id})

// Relationships
(:Agent)-[:HAS_ROLE]->(:Role)
(:Agent)-[:BELONGS_TO]->(:Company)
(:Agent)-[:AUTHORED]->(:Document)
(:Agent)-[:EXECUTED]->(:Task)
(:Skill)-[:REQUIRES]->(:Tool)
(:Task)-[:DELEGATED_TO]->(:Task)
(:Decision)-[:MADE_BY]->(:Agent)
(:Incident)-[:RESOLVED_BY]->(:Agent)
(:Pattern)-[:EXTRACTED_FROM]->(:Document)
```

---

## 11. Resumo de Tabelas por Categoria

| Categoria | Tabelas Estimadas | Origem Principal |
|-----------|-------------------|------------------|
| **Organização & Auth** | 8 | Paperclip + extensões |
| **Agentes & Roles** | 12 | Paperclip + Agency Agents |
| **Skills & Catálogo** | 8 | Paperclip + Agency Agents |
| **Orquestração (Tasks, NEXUS)** | 10 | Paperclip + NEXUS |
| **Workspaces & Execução** | 8 | Paperclip |
| **Comunicação (Chat)** | 8 | Paperclip |
| **Orçamento & Custos** | 6 | Paperclip |
| **Auditoria & Governança** | 6 | **Novo** |
| **Memória & Conhecimento** | 6 | **Novo** |
| **TOTAL ESTIMADO** | **~72** | (vs 480 Paperclip — consolidado) |

> **Nota:** O modelo consolida as 480 tabelas do Paperclip em ~72 tabelas core, removendo redundâncias, normalizando versionamento e adicionando governança, memória e multi-tenancy nativo. Tabelas específicas de domínio (issues, cases, pipelines, etc.) podem ser adicionadas como módulos opcionais.

---

*Modelo de domínio proposto para NettosCorp Enterprise. Requer revisão de DBA e aprovação do Founder antes de gerar migrations Drizzle.*