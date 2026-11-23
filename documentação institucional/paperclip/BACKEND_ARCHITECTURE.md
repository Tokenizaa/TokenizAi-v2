# Paperclip — Engenharia Reversa: Arquitetura do Backend

> **Data:** 21 de novembro de 2026  
> **Versão analisada:** 0.3.1  
> **Diretório:** `/home/lg/workspace/NettosCorp/NettosCorp/paperclip/server`

---

## 1. Stack e Estrutura Geral

| Item | Tecnologia | Versão |
|------|------------|--------|
| **Runtime** | Node.js | ≥24.11.0 |
| **Framework** | Express | 5.1.0 |
| **Language** | TypeScript | 7.0.2 |
| **ORM** | Drizzle ORM | 0.45.2 |
| **Database** | PostgreSQL (embedded: 18.1.0-beta.16) | 17 |
| **Auth** | Better Auth | 1.7.16 |
| **AI SDK** | Vercel AI SDK | 7.0.130 |
| **Agent Protocol** | ACP (Agent Client Protocol) | 1.9.0 |
| **MCP** | @modelcontextprotocol/sdk | 1.31.0 |
| **WebSocket** | ws | 8.22.0 |
| **Logging** | Pino + pino-http | 10.0.0 / 11.0.0 |
| **Validation** | Zod + AJV | 4.6.6 / 8.20.0 |
| **Observability** | OpenTelemetry + Sentry | 1.9.1 / 10.71.0 |
| **Testing** | Vitest + Supertest | 5.0.3 / 7.0.0 |

---

## 2. Estrutura de Diretórios

```
server/
├── src/
│   ├── index.ts                 # Entry point: startServer()
│   ├── app.ts                   # Express app factory (1485 linhas)
│   ├── config.ts                # Config loading + validation (470 linhas)
│   ├── routes/                  # 100+ route modules
│   │   ├── index.ts             # Route registration
│   │   ├── auth.ts              # Better auth routes
│   │   ├── agents.ts            # Agent CRUD, config, runs
│   │   ├── issues.ts            # Issue tracker (800KB+)
│   │   ├── chat-channels.ts     # Discord, Slack, GitHub, Telegram, Teams
│   │   ├── cases.ts             # Case management
│   │   ├── workspaces.ts        # Execution workspaces
│   │   ├── tools/               # Tool gateway, access, approval
│   │   ├── mcp/                 # MCP apps, skills, public MCP
│   │   ├── plugins.ts           # Plugin management
│   │   ├── adapters.ts          # Adapter registry, settings
│   │   ├── secrets.ts           # Secret management
│   │   ├── companies.ts         # Company CRUD, memberships
│   │   ├── projects.ts          # Projects, workspaces
│   │   ├── routines.ts          # Automation routines
│   │   ├── skills.ts            # Skills, sources, catalog
│   │   ├── budgets.ts           # Cost accounting, budgets
│   │   ├── health.ts            # Health, readiness, liveness
│   │   └── ... (80+ mais)
│   ├── services/                # 500+ service modules (domain logic)
│   │   ├── agents.ts            # Agent lifecycle, hiring, config
│   │   ├── issues.ts            # Issue operations, threads
│   │   ├── chat-channels.ts     # Channel adapters, delivery
│   │   ├── workspaces/          # Workspace runtime, recovery
│   │   ├── auth/                # Better auth, workspace login
│   │   ├── budget/              # Cost accounting, enforcement
│   │   ├── plugin/              # Plugin loader, worker manager
│   │   ├── mcp/                 # MCP server, apps, skills
│   │   ├── adapter/             # Adapter registry, execution
│   │   ├── secret/              # Secrets, proposals, 1Password
│   │   ├── scheduler/           # Heartbeat, routine, cron
│   │   ├── recovery/            # Workspace, run, native recovery
│   │   ├── github/              # GitHub integration (PRs, reviews)
│   │   ├── browser-use/         # Browser automation
│   │   ├── dot-runner/          # DOT runner broker
│   │   └── ... (200+ mais)
│   ├── modules/                 # Feature modules (isolated domains)
│   │   ├── active-run-watchdog/
│   │   ├── agent-lifecycle/
│   │   ├── execution-admission/
│   │   ├── external-agents/
│   │   ├── run-dispatch/
│   │   └── wake-queue/
│   ├── middleware/              # Express middleware
│   │   ├── auth.ts              # Actor resolution, auth
│   │   ├── logger.ts            # Pino request logging
│   │   ├── error-handler.ts     # Global error handling
│   │   ├── idle-admission.ts    # Request draining
│   │   ├── cloud-*.ts           # Cloud tenant, warm standby
│   │   ├── board-mutation-guard.ts
│   │   └── ...
│   ├── auth/                    # Better auth config
│   │   └── better-auth.ts
│   ├── http/                    # HTTP server + WebSocket setup
│   │   └── server.ts
│   ├── realtime/                # WebSocket servers
│   │   ├── live-events-ws.ts
│   │   ├── plugin-api-ws.ts
│   │   └── runner-prp-ws.ts
│   ├── storage/                 # File storage abstraction
│   │   ├── provider-registry.ts
│   │   ├── s3-multipart.ts
│   │   └── config.ts
│   ├── built-ins/               # Built-in agents, skills
│   ├── onboarding-assets/       # Onboarding templates
│   ├── vendor/                  # Vendored dependencies
│   ├── types/                   # TypeScript declarations
│   ├── __tests__/               # Integration tests
│   └── scripts/                 # Dev scripts, seed, migrations
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 3. Ponto de Entrada e Inicialização

### 3.1 `server/src/index.ts:311` — `startServer()`

```typescript
export async function startServer(): Promise<StartedServer> {
  // 1. Telemetria + Sentry (early)
  await instrumentationReady;
  await sentryReady;

  // 2. Config loading
  const startupConfig = isCloudManagedInstance() 
    ? loadCloudBootstrapConfig() 
    : loadConfig();

  // 3. Database connection + migrations
  const db = await createDb({ connectionString: config.databaseUrl });
  await applyPendingMigrations(db);

  // 4. Express app factory
  const app = await createApp(config, db);

  // 5. HTTP + WebSocket server
  const server = createPaperclipHttpServer(app, { apiUrl: config.apiUrl });
  
  // 6. Background workers registration
  registerBackgroundWorkers(db, config);

  // 7. Listen
  server.listen(config.port, config.host);
}
```

### 3.2 Sequência de Boot (Startup Timeline)

| Fase | Duração típica | Operações |
|------|----------------|-----------|
| **Instrumentation** | ~50ms | OTel, Sentry init |
| **Config Load** | ~10ms | Dotenv, validation, cloud bootstrap |
| **DB Connect** | ~200ms | Pool creation, migration check |
| **Migrations** | ~500ms | Apply pending (prompt if interactive) |
| **App Factory** | ~300ms | Middleware, routes, services init |
| **Workers** | ~100ms | Register background jobs |
| **Listen** | ~50ms | HTTP + WS servers |

**Total cold start:** ~1-2s (embedded PG adiciona ~3s first run)

---

## 4. Organização das Rotas

### 4.1 Registro Centralizado (`server/src/app.ts`)

```typescript
// 100+ route modules registrados em ordem de prioridade
app.use("/api/health", healthRoutes);
app.use("/api/ready", readinessRoutes);
app.use("/api/liveness", livenessRoutes);

// Auth primeiro
app.use("/api/auth", authRoutes);

// Core domains
app.use("/api/companies", companyRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/chat", chatChannelRoutes, chatWebhookRoutes);
app.use("/api/cases", caseRoutes, caseHandoffRoutes);

// Tools & MCP
app.use("/api/tool-gateway", toolGatewayRoutes, mcpGatewayProtocolRoutes);
app.use("/api/tool-access", toolAccessRoutes);
app.use("/api/mcp", mcpAppsRoutes, mcpSkillsRoutes, publicMcpRoutes);

// Plugins & Adapters
app.use("/api/plugins", pluginRoutes);
app.use("/api/adapters", adapterRoutes);

// Settings & Secrets
app.use("/api/secrets", secretRoutes);
app.use("/api/instance-settings", instanceSettingsRoutes);
```

### 4.2 Padrões de Roteamento

| Padrão | Exemplo | Uso |
|--------|---------|-----|
| **RESTful** | `GET /api/agents/:id` | CRUD padrão |
| **Nested** | `POST /api/issues/:id/comments` | Recursos filhos |
| **Action-based** | `POST /api/agents/:id/hire` | Operações de domínio |
| **Webhook** | `POST /api/chat/webhook/github` | Ingress externo |
| **SSE/WS** | `GET /api/live-events` | Real-time |
| **File upload** | `POST /api/assets` (multer) | Multipart |

### 4.3 Rotas Especiais

| Rota | Propósito |
|------|-----------|
| `/api/health` | Health check (k8s liveness) |
| `/api/ready` | Readiness (DB, migrations, workers) |
| `/api/liveness` | Liveness probe |
| `/api/openapi` | OpenAPI spec generation |
| `/api/auth/*` | Better Auth endpoints |
| `/api/setup-token/*` | CLI onboarding flow |

---

## 5. Serviços e Regras de Negócio

### 5.1 Arquitetura de Serviços

Os services em `server/src/services/` seguem padrão **domain-driven**:

```typescript
// Exemplo: agent-lifecycle.ts
export function startAgentLifecycle(services: AgentLifecycleServices) {
  // Registra workers, configura hooks, retorna API
  return {
    hireAgent,
    configureAgent,
    startAgentRun,
    stopAgentRun,
    // ...
  };
}
```

### 5.2 Principais Domínios de Serviço

| Domínio | Arquivo Principal | Responsabilidades |
|---------|-------------------|-------------------|
| **Agent Lifecycle** | `agent-lifecycle.ts`, `agents.ts` | Hire, config, runs, credentials, avatars |
| **Issue Tracking** | `issues.ts` (800KB) | CRUD, threads, comments, annotations, watchdogs |
| **Chat Channels** | `chat-channels.ts` (179KB) | Discord, Slack, GitHub, Telegram, Teams adapters |
| **Workspaces** | `workspace-runtime.ts` (374KB) | Execution, snapshots, recovery, git ops |
| **Budgets** | `budgets.ts` (69KB), `run-cost-accounting.ts` | Cost tracking, enforcement, reservations |
| **Plugins** | `plugin-loader.ts`, `plugin-worker-manager.ts` | Worker isolation, RPC, lifecycle |
| **MCP** | `public-mcp.ts`, `mcp-apps.ts` | MCP server, apps, skills, OAuth |
| **Adapters** | `adapters.ts`, `adapter-registry-bootstrap.ts` | 12 agent adapters, settings, auth |
| **Secrets** | `secrets.ts` (227KB), `secret-proposals.ts` | 1Password, proposals, tool OAuth |
| **Auth** | `authorization.ts` (133KB), `better-auth.ts` | RBAC, workspace login, company memberships |
| **Recovery** | `workspace-recovery*.ts` (10+ files) | Snapshots, fallback, stop proof, warm handoff |
| **Scheduler** | `heartbeat.js`, `routine-execution-status-work.ts` | Run admission, idle detection, cron |

### 5.3 Injeção de Dependências (Manual)

```typescript // app.ts
const services = {
  db,
  config,
  chatChannelService: createChatChannelService(db, config),
  agentService: createAgentService(db, config),
  // ... 50+ services
};

// Passado para route modules
app.use("/api/agents", agentRoutes(services));
```

---

## 6. Middlewares

### 6.1 Pipeline de Middleware (`server/src/app.ts`)

```typescript
// Ordem crítica:
app.use(httpLogger);                    // Request logging
applyTrustProxy(app);                   // Trust proxy headers
app.use(apiCompression);                // Compression
app.use(apiServerTiming);               // Server-Timing header
app.use(staticUiCompression);           // UI assets compression
app.use(staticUiFiles);                 // Serve built UI
app.use(cloudWarmStandbyMiddleware);    // Cloud standby
app.use(cloudControlMiddleware);        // Cloud tenant control
app.use(cloudRuntimeIdentityMiddleware); // Cloud actor resolution
app.use(runnerCallOutcomeMiddleware);   // Runner call tracking
app.use(boardMutationGuard);            // Board mutation protection
app.use(privateHostnameGuard);          // Private hostname validation
app.use(actorMiddleware);               // Actor (user/agent) resolution
app.use(idleAdmissionMiddleware);       // Request draining
app.use(databaseOperationMiddleware);   // DB transaction scope
app.use(redactSensitive);               // Log redaction
app.use(errorHandler);                  // Global error handler
```

### 6.2 Middlewares Críticos

| Middleware | Arquivo | Função |
|------------|---------|--------|
| `actorMiddleware` | `middleware/auth.ts` | Resolve actor (user/agent) from JWT/session |
| `authorization` | `services/authorization.ts` | RBAC checks per resource/action |
| `idleAdmissionMiddleware` | `middleware/idle-admission.ts` | Drains requests during maintenance |
| `databaseOperationMiddleware` | `middleware/database-operation.ts` | Transaction boundary per request |
| `redactSensitive` | `middleware/redact-sensitive.ts` | Remove secrets from logs |
| `errorHandler` | `middleware/error-handler.ts` | Normalizes errors, Sentry capture |

---

## 7. Autenticação e Autorização

### 7.1 Better Auth (`server/src/auth/better-auth.ts`)

```typescript
export const auth = betterAuth({
  database: createDbClient(),
  emailAndPassword: { enabled: true },
  socialProviders: { github, google, slack, discord },
  plugins: [
    organizationPlugin(),        // Companies = organizations
    adminPlugin(),               // Admin roles
    multiSessionPlugin(),        // Multiple sessions
    apiKeyPlugin(),              # Agent API keys
  ],
  advanced: {
    crossSubDomainCookies: { enabled: true },
    cookiePrefix: "paperclip",
  },
});
```

### 7.2 Workspace Login Handoff

- **CLI/agents** autenticam via setup token → trocam por session cookie
- **Fluxo:** `setup-token-session.ts` → `workspace-login-handoff.ts`
- **Permite:** Agents locais acessarem API com identidade do usuário

### 7.3 Autorização (RBAC)

```typescript
// services/authorization.ts — 133KB
// Permissions: read, write, admin, execute per resource
// Scopes: company, project, issue, agent, workspace
// Context: actor (user/agent), membership, roles
```

**Recursos protegidos:** Agents, Issues, Cases, Workspaces, Secrets, Plugins, MCP, Budgets

---

## 8. Eventos e Processamento Assíncrono

### 8.1 Heartbeat System (`services/heartbeat.js`)

```typescript
// Central coordination loop
heartbeatService = {
  // Run admission control
  admitRun: (runId) => Promise<boolean>,
  // Idle detection
  detectIdle: (runId) => Promise<void>,
  // Watchdog
  watchdog: (runId) => Promise<void>,
};
```

### 8.2 Background Workers (Registrados no boot)

| Worker | Arquivo | Frequência | Função |
|--------|---------|------------|--------|
| **Budget Enforcement** | `budget-enforcement-worker.ts` | Contínuo | Monitora custos, bloqueia runs |
| **Run Cost Accounting** | `run-cost-accounting.ts` | Por run | Aggrega custos de LLM, tools |
| **Workspace Recovery** | `workspace-recovery-work.ts` | Agendado | Snapshots, fallback, cleanup |
| **Skill Version Retention** | `skill-version-retention-work.ts` | Diário | Limpa versões antigas |
| **Approval Retention** | `approval-retention.ts` | Diário | Limpa approvals expirados |
| **Attention Retention** | `attention-retention.ts` | Contínuo | Limpa attention queue |
| **Login Cleanup** | `login-cleanup-work.ts` | Horário | Expira setup tokens |
| **Secret Proposal Expiry** | `secret-proposal-expiry-work.ts` | Horário | Expira propostas |
| **Database Backup** | `database-backup-work.ts` | Configurável | Backup PG automático |
| **Git Restore Point** | `git-restore-point-ledger.ts` | Contínuo | Git snapshots para recovery |

### 8.3 Delivery Work Coordinator

```typescript
// services/delivery-work-coordinator.ts
// Coordena entrega de: chat messages, approvals, tool actions, MCP events
// Queues: DELIVERY_QUEUES = { chat, approval, tool, mcp, ... }
```

---

## 9. Comunicação Entre Módulos

### 9.1 Service Registry Pattern

```typescript
// services/index.ts — Exporta todas as instâncias de service
export const services = {
  agentService: createAgentService(db, config),
  issueService: createIssueService(db, config),
  chatChannelService: createChatChannelService(db, config),
  // ...
};
```

### 9.2 Event Bus (Plugin System)

```typescript
// services/plugin-event-bus.ts
// Pub/Sub para plugin ↔ host communication
// Eventos: plugin:load, plugin:unload, tool:call, tool:result
```

### 9.3 Live Events (WebSocket Fanout)

```typescript
// services/live-events.ts
// Server → UI real-time updates
// Canais: company:{id}, issue:{id}, agent:{id}, workspace:{id}
```

---

## 10. Integrações Externas

| Integração | Arquivos | Protocolo |
|------------|----------|-----------|
| **GitHub** | `chat-github*.ts` (15+ files) | REST + Webhooks + GraphQL |
| **Discord** | `chat-discord*.ts` (10+ files) | Bot Gateway + Slash Commands |
| **Slack** | `chat-channels.ts` + adapters | Bot Token + Socket Mode |
| **Telegram** | `chat-channels.ts` + adapters | Bot API + Webhooks |
| **Teams** | `chat-channels.ts` + adapters | Bot Framework |
| **1Password** | `secrets.ts`, `secret-proposals.ts` | 1Password SDK |
| **Tailscale** | `tailscale-connections.ts` | Tailscale API |
| **Vercel** | `vercel-connect.ts` | Vercel Connect OAuth |
| **Browser Use** | `browser-use.ts` (70KB) | Browser automation API |
| **DOT Runner** | `dot-runner-broker.ts` | gRPC + custom protocol |

---

## 11. Tratamento de Erros

### 11.1 Error Hierarchy

```typescript
// middleware/error-handler.ts
class PaperclipError extends Error {
  constructor(public code: string, public status: number, message: string) {}
}

class NotFoundError extends PaperclipError { ... }
class UnauthorizedError extends PaperclipError { ... }
class ValidationError extends PaperclipError { ... }
class ConflictError extends PaperclipError { ... }
```

### 11.2 Global Handler

```typescript
// middleware/error-handler.ts
export function errorHandler(err, req, res, next) {
  // 1. Log estruturado (Pino)
  logger.error({ err, path: req.path }, "Request error");
  
  // 2. Sentry capture (se configurado)
  captureException(err);
  
  // 3. Normaliza resposta
  const { code, status, message } = normalizeError(err);
  res.status(status).json({ error: { code, message } });
}
```

### 11.3 Redaction de Logs

```typescript
// middleware/log-redaction.ts + redaction.ts
// Remove: API keys, tokens, passwords, secrets, PII
// Patterns: /sk-[a-zA-Z0-9]{32}/, /Bearer\s+\S+/, etc.
```

---

## 12. Separação Infraestrutura / Domínio / Apresentação

| Camada | Localização | Exemplos |
|--------|-------------|----------|
| **Infraestrutura** | `server/src/` raiz, `middleware/`, `http/`, `realtime/`, `storage/` | HTTP server, WS, logging, config, DB pool |
| **Domínio** | `server/src/services/`, `server/src/modules/` | Agent lifecycle, issue tracking, budgets, recovery |
| **Apresentação** | `server/src/routes/` | Express route handlers, request/response mapping |
| **Shared** | `packages/shared/`, `packages/db/` | Types, Zod schemas, Drizzle schema, constants |

---

## 13. Evidências de Investigação

| Item | Fonte | Tipo |
|------|-------|------|
| Entry point | `server/src/index.ts:311` | Código |
| App factory | `server/src/app.ts` (1485 linhas) | Código |
| Config system | `server/src/config.ts` (470 linhas) | Código |
| Routes dir | `ls server/src/routes/` (100+ arquivos) | Execução |
| Services dir | `ls server/src/services/` (500+ arquivos) | Execução |
| Modules dir | `ls server/src/modules/` | Execução |
| Middleware dir | `ls server/src/middleware/` | Execução |
| Auth config | `server/src/auth/better-auth.ts` | Código |
| HTTP server | `server/src/http/server.ts` | Código |
| Error handler | `server/src/middleware/error-handler.ts` | Código |
| Package.json | `server/package.json` | Código |

---

*Documento baseado em inspeção direta de código. Nenhuma execução de servidor foi realizada — análise estática apenas.*