# Paperclip — Engenharia Reversa: Arquitetura do Banco de Dados

> **Data:** 21 de novembro de 2026  
> **Versão analisada:** 0.3.1 (490+ migrations)  
> **Diretório:** `/home/lg/workspace/NettosCorp/NettosCorp/paperclip/packages/db`

---

## 1. Stack e Visão Geral

| Item | Tecnologia | Versão |
|------|------------|--------|
| **ORM** | Drizzle ORM | 0.45.2 |
| **Database** | PostgreSQL | 17 (embedded: 18.1.0-beta.16) |
| **Driver** | postgres.js | 3.4.9 |
| **Migrations** | Drizzle Kit | 0.31.11 |
| **Embedded PG** | embedded-postgres | 18.1.0-beta.16 |
| **Backup/Restore** | Custom (pg_dump/pg_restore) | — |
| **Connection Pool** | Custom (dedicated + shared pools) | — |

---

## 2. Estrutura do Pacote DB

```
packages/db/
├── src/
│   ├── index.ts                    # Exports principais
│   ├── client.ts                   # DB client factory, pools, lifecycle
│   ├── migrate.ts                  # Migration runner
│   ├── schema/                     # 200+ schema files (tabelas)
│   │   ├── index.ts                # Barrel export (14450 linhas)
│   │   ├── agents.ts
│   │   ├── issues.ts
│   │   ├── chat_channels.ts
│   │   ├── companies.ts
│   │   ├── workspaces.ts
│   │   ├── secrets.ts
│   │   ├── tools/                  # Tool access, gateway
│   │   ├── mcp/                    # MCP apps, skills
│   │   ├── plugins/                # Plugin entities
│   │   ├── budgets/                # Cost accounting
│   │   └── ... (200+ arquivos)
│   ├── migrations/                 # 490+ SQL migration files
│   │   ├── 0000_*.sql → 0490_*.sql
│   │   └── meta/                   # _journal.json, snapshots
│   ├── backup-lib.ts               # Backup/restore logic
│   ├── embedded-postgres-*.ts      # Embedded PG lifecycle
│   ├── work-signals.ts             # Transaction coordination
│   ├── response-capture.ts         # Query capture for testing
│   ├── prepared-queries.ts         # Prepared statement cache
│   ├── runtime-config.ts           # Runtime config tables
│   └── __tests__/                  # Integration tests
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

---

## 3. Entidades Principais (Schema)

### 3.1 Core Domain Tables (480+ tabelas totais)

| Domínio | Tabelas Principais | Contagem |
|---------|-------------------|----------|
| **Auth & Companies** | `auth_users`, `auth_sessions`, `auth_accounts`, `companies`, `company_memberships`, `instance_user_roles`, `invites`, `join_requests` | ~15 |
| **Agents** | `agents`, `agent_memberships`, `agent_config_revisions`, `agent_instruction_revisions`, `agent_runtime_state`, `agent_task_sessions`, `agent_wakeup_requests`, `built_in_managed_resources` | ~12 |
| **Issues & Chat** | `issues`, `issue_comments`, `issue_attachments`, `issue_relations`, `issue_thread_interactions`, `chat_conversations`, `chat_deliveries`, `chat_publications`, `chat_actions`, `chat_endpoints` | ~25 |
| **Cases** | `cases`, `case_handoffs`, `case_documents`, `case_events`, `case_attachments`, `case_labels` | ~10 |
| **Workspaces** | `execution_workspaces`, `execution_workspace_snapshots`, `execution_workspace_restore_points`, `execution_workspace_runtime_leases`, `execution_workspace_repositories` | ~10 |
| **Projects** | `projects`, `project_memberships`, `project_workspaces`, `project_goals`, `folders`, `documents` | ~10 |
| **Routines** | `routines`, `routine_revisions`, `routine_triggers`, `routine_runs`, `routine_documents`, `pipelines`, `pipeline_cases` | ~12 |
| **Tools & MCP** | `tool_access`, `tool_gateway_sessions`, `tool_connection_app_snapshots`, `mcp_apps`, `mcp_skills`, `public_mcp_*` | ~20 |
| **Plugins** | `plugins`, `plugin_entities`, `plugin_config`, `plugin_jobs`, `plugin_logs`, `plugin_state`, `plugin_company_settings` | ~10 |
| **Secrets** | `company_secrets`, `company_secret_proposals`, `company_secret_versions`, `user_secret_declarations`, `secret_access_events` | ~10 |
| **Budgets** | `budgets`, `budget_policies`, `budget_incidents`, `budget_resume_claims`, `cost_events`, `finance_events` | ~8 |
| **Adapters** | `adapter_auth_sessions`, `adapter_settings`, `adapter_registry` | ~5 |
| **Skills** | `company_skills`, `company_skill_sources`, `company_skill_policies`, `skill_package_store` | ~8 |
| **Activity & Audit** | `activity_log`, `workspace_operations`, `run_identity_contexts`, `heartbeat_runs`, `heartbeat_run_events` | ~10 |

### 3.2 Tabelas de Maior Complexidade

| Tabela | Linhas (estimado) | Complexidade |
|--------|-------------------|--------------|
| `issues` | 13394 (schema) | Central domain, muitos FKs, JSONB columns |
| `chat_channels` | 32973 | Polimórfica (5+ providers), delivery tracking |
| `tool_access` | 70646 | MCP + ACP unified, connection management |
| `agents` | 3386 | Config JSONB, runtime state, memberships |
| `secrets` | 227KB (service) | 1Password sync, proposals, versioning |
| `workspace_runtime` | 374KB (service) | Snapshots, leases, git ops, recovery |

---

## 4. Relacionamentos e Chaves

### 4.1 Padrões de Relacionamento

| Padrão | Exemplo | Uso |
|--------|---------|-----|
| **Company-scoped** | `company_id` FK em quase todas as tabelas | Multi-tenancy via RLS/queries |
| **Polymorphic** | `chat_endpoints` (provider + external_id) | Discord, Slack, GitHub, etc. |
| **Self-referential** | `issue_relations` (parent/child), `case_handoffs` | Hierarquias, handoffs |
| **Many-to-many** | `project_memberships`, `agent_memberships` | Junction tables |
| **Versioned** | `agent_config_revisions`, `routine_revisions` | Audit trail, rollback |

### 4.2 Chaves Primárias

| Tipo | Tabelas | Exemplo |
|------|---------|---------|
| **UUID** | Maioria (auth, companies, agents, issues) | `gen_random_uuid()` |
| **Composite** | Junction tables, versioned | `(company_id, agent_id)` |
| **Serial/BigInt** | Algumas legacy, high-write | `bigserial` |

### 4.3 Índices Críticos

```sql
-- Exemplos de índices compostos para query patterns comuns
CREATE INDEX idx_issues_company_status ON issues(company_id, status);
CREATE INDEX idx_chat_deliveries_endpoint_created ON chat_deliveries(endpoint_id, created_at);
CREATE INDEX idx_workspace_runtime_company_status ON workspace_runtime(company_id, status);
CREATE INDEX idx_tool_access_company_provider ON tool_access(company_id, provider);
```

---

## 5. Migrations

### 5.1 Estrutura de Migrações

```
migrations/
├── 0000_mature_masked_marvel.sql      # Schema inicial
├── 0001_fast_northstar.sql
├── ...
├── 0490_*.sql                         # Latest
└── meta/
    ├── _journal.json                  # Applied migrations log
    ├── 0000_snapshot.json             # Schema snapshots
    └── ...
```

### 5.2 Estatísticas de Migrações

| Métrica | Valor |
|---------|-------|
| **Total migrations** | 490+ (0000–0490) |
| **Naming convention** | `{number}_{adjective}_{noun}.sql` |
| **Schema snapshots** | Mantidos últimos 5 (prune automático) |
| **Migration safety** | `check-migration-safety.ts` valida breaking changes |
| **Drift detection** | `reconcilePendingMigrationHistory()` repara journal |

### 5.3 Migrações Notáveis (Recentes)

| Migration | Descrição | Impacto |
|-----------|-----------|---------|
| `0348_agent_skill_runtime_hooks` | Agent skill hooks runtime | Novo sistema de hooks |
| `0354_agent_connection_assignment_hooks` | Connection assignment hooks | Agent-connection binding |
| `0423_agent_config_read_defaults` | Config read defaults | Defaults para agent config |
| `0444_github_access_refresh_runtime_bookkeeping` | GitHub access refresh | Token refresh tracking |
| `0471_controller_instances_dispatch_marker` | Controller dispatch marker | HA controller lease |
| `0488_issue_recovery_full_passes` | Issue recovery full passes | Recovery observability |

---

## 6. Estratégia de Persistência

### 6.1 Drizzle ORM Patterns

```typescript
// Schema definition (packages/db/src/schema/agents.ts)
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id),
  name: text("name").notNull(),
  config: jsonb("config").$type<AgentConfig>().notNull(),
  runtimeState: jsonb("runtime_state").$type<AgentRuntimeState>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const agentsRelations = relations(agents, ({ one, many }) => ({
  company: one(companies, { fields: [agents.companyId], references: [companies.id] }),
  memberships: many(agentMemberships),
  configRevisions: many(agentConfigRevisions),
}));
```

### 6.2 Query Patterns

| Pattern | Exemplo | Uso |
|---------|---------|-----|
| **Company-scoped** | `db.select().from(agents).where(eq(agents.companyId, companyId))` | Multi-tenancy |
| **Prepared statements** | `preparedQueries.getAgentById.execute({ id })` | High-frequency reads |
| **JSONB queries** | `sql`\`config->>'model' = 'claude-3'\`` | Config search |
| **Transaction** | `await db.transaction(async (tx) => { ... })` | Atomic operations |
| **Lazy transaction** | `lazyTransactionQueries.ts` | Deferred tx for reads |

### 6.3 Connection Management (`client.ts`)

```typescript
// Pool types:
1. **Primary pool** — App requests (configurable max)
2. **Dedicated pools** — Long-running ops (migrations, backups, streaming)
3. **Liveness pool** — Health checks (separate, low timeout)
4. **Checkpoint pool** — WAL checkpoint coordination
5. **File storage pool** — Large object operations

// Limits:
PRIVATE_POOL_MAX_CONNECTIONS = 20
DEFAULT_DEDICATED_CONNECTION_MAX = 5
DEDICATED_CONNECTION_IDLE_MAX = 30_000ms
```

---

## 7. Transações e Isolamento

### 7.1 Níveis de Isolamento

| Operação | Isolation Level | Justificativa |
|----------|-----------------|---------------|
| **Default** | `READ COMMITTED` | PG default, bom balance |
| **Cost accounting** | `REPEATABLE READ` | Consistência de totais |
| **Workspace recovery** | `SERIALIZABLE` | Snapshots consistentes |
| **Migrations** | `SERIALIZABLE` (advisory lock) | Schema changes atômicos |

### 7.2 Transaction Coordination (`work-signals.ts`)

```typescript
// Coordenação de transações longas (workspace ops, git)
export function signalDatabaseWork(scope: string, txId: string) { ... }
export function subscribeDatabaseWork(scope: string, handler) { ... }
export function reconcileDatabaseWork() { ... } // Cleanup órfãos
```

---

## 8. Isolamento de Dados (Multi-tenancy)

### 8.1 Estratégia: Company-scoped + RLS Ready

```sql
-- Todas as tabelas de domínio têm company_id
ALTER TABLE agents ADD COLUMN company_id uuid REFERENCES companies(id);
-- RLS policies podem ser habilitadas:
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_isolation ON agents USING (company_id = current_setting('app.current_company_id')::uuid);
```

### 8.2 Camadas de Isolamento

| Camada | Implementação |
|--------|---------------|
| **Application** | Todos os queries filtram por `company_id` (via middleware) |
| **Database** | RLS policies definidas, podem ser ativadas via `ENABLE_RLS_ENFORCEMENT` |
| **API** | `actorMiddleware` resolve company do actor, injeta em queries |
| **Workspace** | Execution workspaces têm `company_id` próprio |

---

## 9. Conexões e Ciclo de Vida

### 9.1 Inicialização (`server/src/index.ts`)

```typescript
// 1. Create DB client
const db = createDb({ connectionString: config.databaseUrl });

// 2. Ensure database exists (embedded PG)
await ensurePostgresDatabase(config);

// 3. Inspect migrations
const state = await inspectMigrations(connectionString);

// 4. Apply pending (with prompt/reconciliation)
await applyPendingMigrations(connectionString);

// 5. Register shutdown hooks
closeLivenessDb, closeCheckpointDb, closeFileStorageDb, closeDedicatedDbConnections
```

### 9.2 Shutdown Graceful

```typescript
// shutdown.ts — 13KB
async function shutdown(signal) {
  // 1. Stop accepting new requests
  closeHttpListenerForShutdown();
  
  // 2. Drain in-flight requests (90s grace)
  await drainRunExecutionFinalizersForShutdown();
  
  // 3. Coordinate heartbeat scheduler shutdown
  await coordinateHeartbeatSchedulerShutdown();
  
  // 4. Close DB pools
  await closeLivenessDb();
  await closeCheckpointDb();
  await closeFileStorageDb();
  await closeDedicatedDbConnections();
  
  // 5. Stop embedded PG supervisor
  await embeddedPostgresSupervisor.stop();
}
```

---

## 10. Backup e Restore

### 10.1 Backup Library (`backup-lib.ts`)

```typescript
export async function runDatabaseBackup(options: RunDatabaseBackupOptions) {
  // 1. pg_dump com --format=custom --compress=9
  // 2. Upload para S3 (se configurado) ou local
  // 3. Metadata: schema version, timestamp, size
  // 4. Retention policy cleanup
}

export async function runDatabaseRestore(options: RunDatabaseRestoreOptions) {
  // 1. Download/verify backup
  // 2. pg_restore --clean --if-exists
  // 3. Reconcile migration journal
}
```

### 10.2 Configuração de Backup

```typescript
// config.ts
databaseBackupEnabled: boolean = true
databaseBackupIntervalMinutes: number = 60
databaseBackupRetentionDays: number = 30
databaseBackupDir: string = "/paperclip/backups"
```

---

## 11. Embedded PostgreSQL (Desenvolvimento)

### 11.1 Lifecycle (`embedded-postgres-supervisor.ts`)

```typescript
// Inicia PG embedded na primeira execução
// Persiste dados em ~/.paperclip/embedded-postgres/
// Porta dinâmica (padrão 5433 para evitar conflito)
// Supervisor monitora health, restart automático
```

### 11.2 Configuração

```typescript
// config.ts
databaseMode: "embedded-postgres" | "postgres"
embeddedPostgresDataDir: string = "~/.paperclip/embedded-postgres"
embeddedPostgresPort: number = 5433
```

---

## 12. Evidências de Investigação

| Item | Fonte | Tipo |
|------|-------|------|
| Package.json | `packages/db/package.json` | Código |
| Schema index | `packages/db/src/schema/index.ts` (14450 linhas) | Código |
| Migrations dir | `ls packages/db/src/migrations/` (490+ arquivos) | Execução |
| Client factory | `packages/db/src/client.ts` | Código |
| Backup lib | `packages/db/src/backup-lib.ts` | Código |
| Embedded PG | `packages/db/src/embedded-postgres-*.ts` | Código |
| Work signals | `packages/db/src/work-signals.ts` | Código |
| Drizzle config | `packages/db/drizzle.config.ts` | Código |
| Schema files | `ls packages/db/src/schema/` (200+ arquivos) | Execução |

---

*Documento baseado em inspeção direta de código e estrutura de arquivos. Nenhuma migration foi executada — análise estática apenas.*