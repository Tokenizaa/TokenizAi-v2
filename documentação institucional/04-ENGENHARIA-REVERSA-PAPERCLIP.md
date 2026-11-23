# Engenharia Reversa — Paperclip

> **Versão:** 1.0  
> **Data:** 21 de novembro de 2026  
> **Checkout:** `/home/lg/workspace/NettosCorp/NettosCorp/paperclip`  
> **Commit:** `cb64a236b` (v0.3.1)  
> **Branch:** main (única, sem branches/worktrees/PRs)  
> **Responsável:** Hermes

---

## 1. Classificação da Evidência

| Componente | Status | Fonte |
|------------|--------|-------|
| Monorepo structure (27 packages) | **EVIDENCIADO** | `pnpm-workspace.yaml`, `package.json` |
| Server (Express 5) | **EVIDENCIADO** | `server/src/index.ts`, `app.ts` (1485 linhas) |
| UI (React 19 + Vite) | **EVIDENCIADO** | `ui/src/main.tsx`, `App.tsx` (887 linhas) |
| Database (Drizzle + PG) | **EVIDENCIADO** | `packages/db/` — 480+ tabelas, 490+ migrations |
| Adapters ACP (12) | **EVIDENCIADO** | `packages/adapters/*` |
| Plugin SDK v1.0.0 | **EVIDENCIADO** | `packages/plugins/sdk/` |
| MCP Server (STDIO) | **EVIDENCIADO** | `packages/mcp-server/` |
| Embedded PostgreSQL | **EVIDENCIADO** | `packages/db/src/embedded-postgres-*.ts` |
| Docker / ECS / Quadlet | **EVIDENCIADO** | `docker/` |
| Hermes Adapter | **EVIDENCIADO** | `packages/adapters/hermes/` |
| Testes (Vitest + Playwright) | **EVIDENCIADO** | 230/230 testes verdes, typecheck PASS |
| CI/CD | **EVIDENCIADO** | Turbo pipeline, changesets |
| OpenAPI Spec | **AUSENTE** | Rotas documentadas manualmente |

---

## 2. Visão Geral da Arquitetura

### 2.1 Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| **Runtime** | Node.js | ≥24.11.0 |
| **Package Manager** | pnpm | 9.15.4 |
| **Language** | TypeScript | 7.0.2 (strict) |
| **Build** | tsc + Vite (UI) + esbuild (CLI) | — |
| **Framework Backend** | Express 5 | 5.1.0 (RC) |
| **Framework Frontend** | React 19 | 19.2.8 (RC) |
| **Router** | React Router DOM | 7.18.4 |
| **State/Query** | TanStack Query | 5.102.8 |
| **ORM** | Drizzle ORM | 0.45.2 |
| **Database** | PostgreSQL | 17 (embedded: 18.1.0-beta.16) |
| **Auth** | Better Auth | 1.7.16 |
| **AI SDK** | Vercel AI SDK | 7.0.130 |
| **Agent Protocol** | ACP | 1.9.0 |
| **MCP** | @modelcontextprotocol/sdk | 1.31.0 |
| **Styling** | Tailwind CSS | 4.3.3 |
| **UI Components** | Radix UI + Base UI + Lucide | — |
| **Real-time** | WebSocket (ws) + custom protocol | 8.22.0 |
| **Observability** | OpenTelemetry + Sentry | 1.9.1 / 10.71.0 |
| **Testing** | Vitest + Playwright | 5.0.3 / 1.62.1 |

### 2.2 Estrutura do Monorepo (27 Workspaces)

```
paperclip/
├── packages/
│   ├── adapters/              # 12 adapters ACP (locais + gateways)
│   ├── adapter-utils/         # Utilitários compartilhados
│   ├── db/                    # @paperclipai/db — Drizzle + migrations + embedded PG
│   ├── shared/                # @paperclipai/shared — Tipos, constantes, Zod
│   ├── plugins/
│   │   ├── sdk/               # @paperclipai/plugin-sdk v1.0.0
│   │   ├── sandbox-providers/ # 9 providers (Daytona, E2B, Modal, K8s, etc.)
│   │   └── examples/
│   ├── mcp-server/            # @paperclipai/mcp-server (STDIO)
│   ├── google-sheets-mcp-server/
│   ├── kv-demo-mcp-server/
│   ├── paperclip-runner/      # Runtime nativo (copilot, codex, claude)
│   ├── paperclip-eval-kernel/
│   ├── skills-catalog/
│   ├── tailscale-https-broker/
│   └── teams-catalog/
├── server/                    # @paperclipai/server — Express + WS + Workers
├── ui/                        # @paperclipai/ui — React 19 + Vite + Tailwind 4
├── cli/                       # CLI `paperclipai`
├── scripts/                   # Build, release, smoke tests
├── docker/                    # Docker Compose, ECS, Quadlet
├── tests/                     # E2E, acceptance, runner
├── evals/                     # Promptfoo evals
└── docs/                      # Documentação (Mintlify)
```

---

## 3. Backend — Server (`server/`)

### 3.1 Ponto de Entrada e Inicialização (`server/src/index.ts:311`)

```typescript
export async function startServer(): Promise<StartedServer> {
  // 1. Instrumentation (OTel + Sentry) — early
  // 2. Config loading (loadConfig / loadCloudBootstrapConfig)
  // 3. DB connect + migrations (embedded PG ou externo)
  // 4. createApp(config, db) → Express app
  // 5. HTTP + WebSocket server (createPaperclipHttpServer)
  // 6. Background workers registration (20+)
  // 7. Listen na porta 3100 (configurável)
}
```

**Cold start:** ~1.5-2s (warm) / ~4-6s (cold com embedded PG first run)

### 3.2 Organização de Rotas (100+ módulos)

| Domínio | Rotas Principais |
|---------|------------------|
| Health | `/api/health`, `/api/ready`, `/api/liveness` |
| Auth | `/api/auth/*` (Better Auth) |
| Companies | `/api/companies`, `/api/companies/:id/*` |
| Agents | `/api/agents`, `/api/agents/:id/hire`, `/api/agents/:id/run` |
| Issues | `/api/issues`, `/api/issues/:id/comments`, `/api/issues/:id/*` |
| Chat | `/api/chat/channels`, `/api/chat/webhook/:provider` |
| Cases | `/api/cases`, `/api/cases/:id/handoff` |
| Workspaces | `/api/workspaces`, `/api/workspaces/:id/snapshot` |
| Tools | `/api/tool-gateway`, `/api/tool-access`, `/api/mcp/*` |
| Plugins | `/api/plugins` |
| Adapters | `/api/adapters` |
| Secrets | `/api/secrets` |
| Budgets | `/api/costs`, `/api/budgets` |

### 3.3 Serviços de Domínio (500+ módulos)

| Domínio | Arquivo Principal | Responsabilidade |
|---------|-------------------|------------------|
| Agent Lifecycle | `agent-lifecycle.ts`, `agents.ts` | Hire, config, runs, credentials |
| Issue Tracking | `issues.ts` (800KB) | CRUD, threads, comments, watchdogs |
| Chat Channels | `chat-channels.ts` (179KB) | Discord, Slack, GitHub, Telegram, Teams |
| Workspaces | `workspace-runtime.ts` (374KB) | Execution, snapshots, recovery, git ops |
| Budgets | `budgets.ts`, `run-cost-accounting.ts` | Cost tracking, enforcement |
| Plugins | `plugin-loader.ts`, `plugin-worker-manager.ts` | Worker isolation, RPC, lifecycle |
| MCP | `public-mcp.ts`, `mcp-apps.ts` | MCP server, apps, skills, OAuth |
| Adapters | `adapters.ts`, `adapter-registry-bootstrap.ts` | 12 agent adapters |
| Secrets | `secrets.ts` (227KB), `secret-proposals.ts` | 1Password, proposals, tool OAuth |
| Auth | `authorization.ts` (133KB), `better-auth.ts` | RBAC, workspace login |
| Recovery | `workspace-recovery*.ts` (10+ files) | Snapshots, fallback, warm handoff |
| Scheduler | `heartbeat.js`, `routine-execution-status-work.ts` | Run admission, cron |

### 3.4 Middleware Pipeline (15+ middlewares, ordem crítica)

1. `httpLogger` — Request logging (Pino)
2. `trustProxy` — Proxy headers
3. `compression` — Response compression
4. `serverTiming` — Server-Timing header
5. `staticUiCompression` — UI assets compression
6. `staticUiFiles` — Serve built UI
7. `cloudWarmStandbyMiddleware` — Cloud standby
8. `cloudControlMiddleware` — Cloud tenant control
9. `cloudRuntimeIdentityMiddleware` — Cloud actor resolution
10. `runnerCallOutcomeMiddleware` — Runner call tracking
11. `boardMutationGuard` — Board mutation protection
12. `privateHostnameGuard` — Private hostname validation
13. `actorMiddleware` — Actor resolution (user/agent)
14. `idleAdmissionMiddleware` — Request draining
15. `databaseOperationMiddleware` — TX boundary per request
16. `redactSensitive` — Log redaction
17. `errorHandler` — Global error handling

### 3.5 Autenticação e Autorização

- **Better Auth v1.7.16** — Framework-agnostic, plugin system (org, admin, api-key)
- **Multi-tenancy** — Company-scoped (todas tabelas têm `company_id`)
- **RLS Ready** — Policies definidas, ativadas via `ENABLE_RLS_ENFORCEMENT`
- **Workspace Login Handoff** — CLI/agents autenticam via setup token → session cookie
- **RBAC** — Permissions: read/write/admin/execute por resource, scopes: company/project/issue/agent/workspace

---

## 4. Frontend — UI (`ui/`)

### 4.1 Stack

- **React 19.2.8** (RC) + **Vite 8.2.2** + **Tailwind 4.3.3**
- **TanStack Query 5.102.8** — Server state cache
- **React Router DOM 7.18.4** — Lazy-loaded routes (~120)
- **17 React Context Providers** — Company, LiveUpdates, Theme, Sidebar, Dialog, Toast, etc.
- **300+ Components** — Radix UI + Base UI + Lucide
- **Editors** — CodeMirror 6, Lexical, MDXEditor, xterm.js

### 4.2 LiveUpdatesProvider (100KB)

- WebSocket fanout para múltiplas abas (BroadcastChannel)
- Cache reconciliation: merge otimista + server-authoritative
- Read receipts para chat messages
- Task index para inbox updates
- Connectivity-aware: pausa queries offline, replay mutations

### 4.3 Roteamento e Code Splitting

- Todas as pages são `lazy(() => import(...))`
- Manual chunks no Vite: `vendor-react`, `vendor-query`, `vendor-ui`, `vendor-editors`, `vendor-ai`
- `startChunkLoadRecovery()` — retry automático em falhas de chunk
- Service Worker para updates

---

## 5. Database (`packages/db/`)

### 5.1 Drizzle ORM + PostgreSQL

- **480+ tabelas** em schema único
- **490+ migrations** (0000–0490) — naming: `{number}_{adjective}_{noun}.sql`
- **Embedded PG para dev** — `embedded-postgres 18.1.0-beta.16` em `~/.paperclip/embedded-postgres/`
- **PG Externo para prod** — `postgres:17-alpine` via Docker Compose
- **Connection Pools** — Primary, Dedicated, Liveness, Checkpoint, FileStorage

### 5.2 Tabelas Principais (Amostra)

| Domínio | Tabelas | Count |
|---------|---------|-------|
| Auth & Companies | `auth_users`, `companies`, `company_memberships`, `invites` | ~15 |
| Agents | `agents`, `agent_memberships`, `agent_config_revisions`, `agent_runtime_state` | ~12 |
| Issues & Chat | `issues`, `issue_comments`, `chat_conversations`, `chat_deliveries`, `chat_endpoints` | ~25 |
| Cases | `cases`, `case_handoffs`, `case_documents` | ~10 |
| Workspaces | `execution_workspaces`, `execution_workspace_snapshots`, `restore_points` | ~10 |
| Tools & MCP | `tool_access`, `mcp_apps`, `mcp_skills`, `public_mcp_*` | ~20 |
| Budgets | `budgets`, `budget_policies`, `cost_events`, `finance_events` | ~8 |

### 5.3 Multi-tenancy

- **Company-scoped** — Todas tabelas de domínio têm `company_id`
- **RLS Policies** — Definidas, ativáveis via `ENABLE_RLS_ENFORCEMENT`
- **Application-level** — Middleware injeta `company_id` em queries

---

## 6. Integrações

### 6.1 Agent Adapters (12 — ACP Protocol)

| Tipo | Adapters | Protocolo |
|------|----------|-----------|
| **Local (CLI)** | claude, codex, cursor, opencode, gemini, grok, kimi, pi | ACP stdio |
| **Gateway (HTTP/SSE)** | hermes, cursor-cloud, openclaw | HTTP REST + SSE |
| **Cloud** | cursor-cloud | Cursor API remota |

### 6.2 Plugin System

- **Plugin SDK v1.0.0** — API estável (`@paperclipai/plugin-sdk`)
- **Worker Isolation** — Processos Node isolados, RPC over WebSocket
- **Sandbox Providers (9)** — Daytona, E2B, Modal, K8s, Cloudflare, Boxd, CreateOS, Novita, exe-dev

### 6.3 MCP (Model Context Protocol)

- **MCP Server (STDIO)** — `packages/mcp-server/` → `paperclip-mcp-server` binary
- **Public MCP (HTTP/SSE)** — OAuth, capabilities, events, file transfers
- **MCP Apps/Skills** — Registry de MCP servers externos + skills que expõem tools
- **MCP Gateway** — Proxy para MCP servers externos

---

## 7. Infraestrutura e Execução

### 7.1 Docker / Deploy

| Target | Config | Artefatos |
|--------|--------|-----------|
| Docker Compose | `docker/docker-compose.yml` | Local/prod single-host |
| ECS Fargate | `docker/ecs-task-definition.json` | AWS production |
| Quadlet (systemd) | `docker/quadlet/` | Linux VMs, bare metal |

### 7.2 Porta 3100 e MCP

- **Porta 3100** — HTTP + WebSocket padrão (configurável via `PORT`)
- **MCP Integration** — STDIO server + HTTP/SSE gateway + OAuth + file transfers — **ativo e funcional**

### 7.3 Graceful Shutdown (90s)

```typescript
// shutdown.ts — 13KB
1. Stop accepting new requests
2. Drain in-flight (90s grace)
3. Coordinate heartbeat scheduler shutdown
4. Release owned native processes
5. Close DB pools (liveness, checkpoint, file storage, dedicated)
6. Stop embedded PG supervisor
7. Flush telemetry (OTel + Sentry)
```

### 7.4 Observabilidade

- **Logging** — Pino structured JSON + redaction (secrets, PII)
- **Metrics** — OpenTelemetry (OTLP, Prometheus) + custom metrics
- **Tracing** — OTel traces, W3C TraceContext propagation
- **Errors** — Sentry (DSN via env), release tracking via `__PAPERCLIP_BUILD_COMMIT__`
- **Health Endpoints** — `/api/health`, `/api/ready`, `/api/liveness`, `/api/instance-server-metrics`

---

## 8. Decisões Arquiteturais Chave (15)

| # | Decisão | Justificativa | Trade-off |
|---|---------|---------------|-----------|
| 1 | Monorepo pnpm workspaces | Shared types, atomic changes | Build lento, version coupling |
| 2 | TypeScript strict + ESM only | Type safety, tree-shaking | Learning curve, CJS interop |
| 3 | Express 5 + React 19 RC | Performance, modern patterns | APIs instáveis, breaking changes |
| 4 | Drizzle ORM (SQL-first) | Type-safe, leve, controle total | Schema manual, migrações verbosas |
| 5 | Embedded PG para dev | Zero-config, CI determinístico | Dev ≠ Prod (v18 beta vs v17) |
| 6 | Better Auth | Framework-agnostic, multi-tenant | Docs limitadas, breaking freq. |
| 7 | ACP (Agent Client Protocol) | Padroniza agent communication | Ecossistema jovem |
| 8 | Plugin Workers isolados | Segurança, fault isolation | IPC overhead, debugging difícil |
| 9 | MCP Native | Padrão emergente (Anthropic/MS) | Spec v1.0 recente |
| 10 | TanStack Query + WS Fanout | Cache inteligente, real-time | Complexidade reconciliação |
| 11 | Tailwind 4 (CSS-first) | Zero config, performance | Migração v3→v4 breaking |
| 12 | Zod para validação | Type-safe runtime, inferência TS | Bundle size, hot path perf |
| 13 | OTel + Sentry | Vendor-neutral, auto-instrument | Setup complexo, custo Sentry |
| 14 | Company-scoped multi-tenancy | Simples, RLS-ready | Não schema isolation |
| 15 | Graceful Shutdown 90s | Operational excellence | Pode ser longo para K8s |

---

## 9. Oportunidades de Reutilização para NettosCorp

| Componente | Reutilizável | Esforço | Prioridade |
|------------|--------------|---------|------------|
| `@paperclipai/shared` | ✅ Total | Baixo | 🔴 Crítico |
| `@paperclipai/db` (core) | ✅ Parcial | Médio | 🔴 Crítico |
| `@paperclipai/plugin-sdk` | ✅ Total (v1.0.0) | Baixo | 🟡 Alto |
| `packages/adapters/*` (12) | ✅ Total | Baixo | 🟡 Alto |
| `packages/mcp-server` | ✅ Total | Baixo | 🟢 Médio |
| `server/src/middleware/*` | ✅ Parcial | Baixo | 🟡 Alto |
| `server/src/services/plugin/*` | ✅ Parcial | Médio | 🟡 Alto |
| `ui/src/components/ui/*` | ⚠️ Parcial | Médio | 🟢 Médio |
| `ui/src/lib/query-client.ts` | ✅ Parcial | Baixo | 🟡 Alto |
| `ui/src/context/LiveUpdatesProvider` | ✅ Parcial | Médio | 🟡 Alto |

---

## 10. Referência aos Documentos Detalhados

| Documento | Foco |
|-----------|------|
| `REVERSE_ENGINEERING_OVERVIEW.md` | Visão geral, stack, oportunidades |
| `FRONTEND_ARCHITECTURE.md` | React 19, Vite, Query, Contexts, rotas |
| `BACKEND_ARCHITECTURE.md` | Express, rotas, services, middleware, auth |
| `DATABASE_ARCHITECTURE.md` | Drizzle, 480 tabelas, 490 migrations, embedded PG |
| `INTEGRATIONS_ARCHITECTURE.md` | Adapters, Plugin SDK, MCP, CLI, Hermes |
| `INFRASTRUCTURE_ARCHITECTURE.md` | Boot, deploy, Docker, shutdown, observabilidade |
| `ARCHITECTURAL_DECISIONS.md` | 15 decisões, matriz reutilização, roadmap |

---

*Este documento consolida a engenharia reversa do Paperclip. Todas as conclusões baseiam-se em inspeção direta de código — zero suposições sobre runtime sem evidência.*