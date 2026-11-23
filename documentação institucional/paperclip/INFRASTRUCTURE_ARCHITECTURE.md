# Paperclip — Engenharia Reversa: Infraestrutura e Execução

> **Data:** 21 de novembro de 2026  
> **Versão analisada:** 0.3.1  
> **Diretório:** `/home/lg/workspace/NettosCorp/NettosCorp/paperclip`

---

## 1. Como o Paperclip Inicia

### 1.1 Modos de Execução

| Modo | Comando | Descrição |
|------|---------|-----------|
| **Development** | `pnpm dev` / `pnpm dev:both` | Server + UI com HMR (tsx + Vite) |
| **Production** | `pnpm build && pnpm start` | Compilado (dist/) + UI estática servida pelo Express |
| **Docker** | `docker compose up` | Containerizado com embedded PG ou externo |
| **CLI Onboarding** | `paperclipai onboard` | Setup interativo (config, auth, DB) |
| **Embedded PG** | Auto no `startServer()` | Primeira execução: baixa/inicializa PG local |

### 1.2 Sequência de Boot (`server/src/index.ts:311`)

```
startServer()
  │
  ├─► instrumentationReady (OTel + Sentry)
  │
  ├─► sentryReady
  │
  ├─► loadConfig() / loadCloudBootstrapConfig()
  │     ├─► Dotenv (.paperclip/.env, .env)
  │     ├─► Validation (Zod schemas)
  │     └─► Deployment mode/exposure resolution
  │
  ├─► ensurePostgresDatabase() [embedded PG]
  │     ├─► Download PG binaries (se necessário)
  │     ├─► Init data directory
  │     └─► Start supervisor (porta 5433)
  │
  ├─► inspectMigrations() + applyPendingMigrations()
  │     ├─► Reconcile migration journal (drift detection)
  │     └─► Prompt interativo (se TTY) ou auto-apply
  │
  ├─► createApp(config, db) → Express app
  │     ├─► Middleware pipeline (15+ middlewares)
  │     ├─► Route registration (100+ modules)
  │     ├─► Service initialization (50+ services)
  │     └─► WebSocket servers (4 endpoints)
  │
  ├─► createPaperclipHttpServer() → HTTP + WS
  │     ├─► registerLocalRuntimeApiServer()
  │     ├─► setupRunnerPrpWebSocketServer()
  │     └─► setupPluginApiWebSocketServer()
  │
  ├─► Background workers registration (20+ workers)
  │
  └─► server.listen(port, host)
```

### 1.3 Tempo de Inicialização (Cold Start)

| Fase | Tempo Estimado |
|------|----------------|
| Instrumentation (OTel/Sentry) | 50-100ms |
| Config + Dotenv | 10-20ms |
| Embedded PG init (first run) | 3-5s |
| Embedded PG start (cached) | 500ms-1s |
| DB connection + migrations | 200-500ms |
| App factory (routes + services) | 300-500ms |
| Workers registration | 100-200ms |
| **Total (warm)** | **~1.5-2s** |
| **Total (cold, embedded PG)** | **~4-6s** |

---

## 2. Como UI e API São Servidas

### 2.1 Desenvolvimento (`pnpm dev:both`)

```
┌─────────────────────────────────────────────────────────────┐
│                      pnpm dev:both                           │
│  (scripts/dev-both.mjs)                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   SERVER (3100)  │         │     UI (5173)    │          │
│  │  tsx src/index.ts│         │    vite dev      │          │
│  │                  │◄───────►│                  │          │
│  │  - API routes    │  HMR    │  - React 19      │          │
│  │  - WS servers    │  Proxy  │  - Tailwind 4    │          │
│  │  - Embedded PG   │         │  - Proxy /api    │          │
│  └──────────────────┘         └──────────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

- **Vite proxy** `/api` → `http://localhost:3100`
- **HMR** via WebSocket (porta derivada: `3100 + 100` = 3200)
- **UI assets** servidos pelo Vite dev server

### 2.2 Produção (`pnpm build && pnpm start`)

```
┌─────────────────────────────────────────────────────────────┐
│                      PRODUCTION                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              EXPRESS SERVER (3100)                    │   │
│  │  node dist/index.js                                   │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │
│  │  │ API Routes  │  │ Static UI   │  │ WebSocket   │   │   │
│  │  │ /api/*      │  │ / (index.html)             │   │   │
│  │  │             │  │ /assets/*   │  │ /live-events│   │   │
│  │  │             │  │ /sw.js      │  │ /plugin-api │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Build artifacts:                                            │
│  - server/dist/           → Compiled TS (ESM)                │
│  - server/ui-dist/        → Vite build output (copied)       │
│  - server/dist/vendor/    → paperclip-runner binaries        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Build Process (`server/package.json`):**
```json
"build": "pnpm run prepare:runner-vendor && 
          node scripts/verify-runner-vendor-dependencies.mjs && 
          node ../scripts/run-tsc.mjs && 
          mkdir -p dist/onboarding-assets dist/built-ins dist/services/scripts dist/vendor/paperclip-runner && 
          cp -R src/onboarding-assets/. dist/onboarding-assets/ && 
          cp -R src/built-ins/. dist/built-ins/ && 
          cp -R src/services/scripts/. dist/services/scripts/ && 
          cp -Rf ../packages/paperclip-runner/dist/. dist/vendor/paperclip-runner/ && 
          cp ../packages/paperclip-runner/scripts/install-copilot-assets.mjs ... dist/ && 
          node dist/install-copilot-assets.mjs && 
          node scripts/write-build-stamp.mjs"
```

---

## 3. Como o Banco é Inicializado

### 3.1 Embedded PostgreSQL (Desenvolvimento)

```typescript
// packages/db/src/embedded-postgres-lifecycle.ts
// packages/db/src/embedded-postgres-native.ts

// Primeira execução:
1. Detecta arquitetura (linux/arm64, linux/x64, darwin/arm64, darwin/x64)
2. Baixa binários PG 17 de CDN (se não cached)
3. Cria data directory: ~/.paperclip/embedded-postgres/
4. initdb --auth=trust --encoding=UTF8
5. Inicia postmaster na porta 5433
6. Supervisor monitora: health check, restart, log capture

// Execuções subsequentes:
- Reutiliza data directory
- Inicia em ~500ms
- Persiste dados entre restarts
```

### 3.2 PostgreSQL Externo (Produção)

```typescript
// Config via env:
DATABASE_URL=postgres://user:pass@host:5432/paperclip
DATABASE_MIGRATION_URL=postgres://migration_user:pass@host:5432/paperclip?pool_max=1

// Conexão:
- Primary pool: app requests (configurável, padrão 20)
- Dedicated pools: migrações, backups, streaming (5 conexões)
- Liveness pool: health checks (1 conexão, timeout baixo)
- Checkpoint pool: WAL coordination
```

### 3.3 Migrações

```typescript
// packages/db/src/migrate.ts
// Drizzle Kit + custom runner

// Fluxo:
1. inspectMigrations() → { status: "upToDate" | "needsMigrations", ... }
2. Se "needsMigrations":
   a. reconcilePendingMigrationHistory() — repara journal se drifted
   b. Prompt interativo (se TTY e não auto-apply)
   c. applyPendingMigrations() — executa em transação
3. Verifica status final
```

---

## 4. Gerenciamento de Processos

### 4.1 Processos Principais

| Processo | Tipo | Gerenciamento |
|----------|------|---------------|
| **Main Server** | Node.js (Express + WS) | `startServer()` → HTTP server, graceful shutdown |
| **Embedded PG** | PostgreSQL (subprocess) | `embedded-postgres-supervisor.ts` → health, restart |
| **Plugin Workers** | Node.js (isolated) | `plugin-worker-manager.ts` → spawn, RPC, lifecycle |
| **Native Runners** | CLI subprocesses | `native-runtime/` → spawn, monitor, restart |
| **Background Workers** | In-process (timers) | `scheduled-work.ts` → registry, coordination |

### 4.2 Graceful Shutdown (`server/src/shutdown.ts`)

```typescript
// 90s grace period (config: stop_grace_period)
async function shutdown(signal: "SIGINT" | "SIGTERM") {
  // 1. Stop accepting new HTTP requests
  closeHttpListenerForShutdown();
  
  // 2. Drain in-flight requests
  await drainRunExecutionFinalizersForShutdown();
  
  // 3. Coordinate heartbeat scheduler shutdown
  await coordinateHeartbeatSchedulerShutdown();
  
  // 4. Release owned native processes
  await releaseOwnedSettledNativeRunProcessesAtShutdown();
  
  // 5. Close DB pools (liveness, checkpoint, file storage, dedicated)
  await closeLivenessDb();
  await closeCheckpointDb();
  await closeFileStorageDb();
  await closeDedicatedDbConnections();
  
  // 6. Stop embedded PG supervisor
  await embeddedPostgresSupervisor.stop();
  
  // 7. Flush telemetry
  await shutdownInstrumentation();
  await shutdownSentry();
}
```

### 4.3 Process Isolation (Plugins + Native Runners)

```
┌────────────────────────────────────────────────────────────┐
│                    PAPERCLIP SERVER (PID 1)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Express    │  │  WebSocket  │  │  Background │         │
│  │  Router     │  │  Servers    │  │  Workers    │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PLUGIN WORKER MANAGER                   │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐              │   │
│  │  │Worker 1 │  │Worker 2 │  │Worker 3 │  ...         │   │
│  │  │(Plugin A)│  │(Plugin B)│  │(Plugin C)│              │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘              │   │
│  └───────┼────────────┼────────────┼────────────────────┘   │
│          │            │            │                         │
│          ▼            ▼            ▼                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           NATIVE RUNTIME (subprocesses)              │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │   │
│  │  │ Claude │ │ Codex  │ │ Cursor │ │ Copilot│  ...    │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘        │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

---

## 5. Ambiente de Desenvolvimento

### 5.1 Requisitos

| Ferramenta | Versão | Instalação |
|------------|--------|------------|
| **Node.js** | ≥24.11.0 | `.nvmrc` + `nvm use` |
| **pnpm** | 9.15.4 | `corepack enable` |
| **Docker** | 24+ | Para Docker Compose, ECS |
| **Git** | 2.40+ | — |

### 5.2 Comandos de Dev

```bash
# Install
pnpm install

# Dev server (server + UI)
pnpm dev:both

# Apenas server
pnpm dev:server

# Apenas UI
pnpm dev:ui

# Typecheck
pnpm typecheck

# Testes
pnpm test:run           # Vitest
pnpm test:e2e           # Playwright
pnpm test:runner-acceptance # Runner acceptance

# DB
pnpm db:generate        # Generate migrations
pnpm db:migrate         # Apply migrations

# Build
pnpm build              # All packages
```

### 5.3 Estrutura de Arquivos de Dev

```
.paperclip/
├── .env                    # Config local (gitignored)
├── embedded-postgres/      # PG data directory
├── plugins/                # Local plugins
├── worktrees/              # Git worktrees para agents
└── logs/                   # Server logs

~/.paperclip/               # Global (cross-project)
├── embedded-postgres/      # PG binaries cache
├── plugins/                # Global plugins
└── cache/                  # Build caches
```

---

## 6. Build e Deploy

### 6.1 Build Pipeline

```bash
# Root build (pnpm -r build)
pnpm run preflight:workspace-links  # Verifica workspace links
pnpm -r build                       # Build cada package

# Server build específico
cd server && pnpm run build
# → tsc compilation
# → Copy assets (onboarding, built-ins, scripts)
# → Vendor paperclip-runner binaries
# → Install copilot assets
# → Write build stamp

# UI build
cd ui && pnpm run build
# → vite build (multiple configs: main, preview, artifact-directions)
# → Output: dist/, dist-preview/
```

### 6.2 Docker

```dockerfile
# docker/Dockerfile (multi-stage)
# Stage 1: Builder (node:24-alpine)
#   - pnpm install --frozen-lockfile
#   - pnpm run build
# Stage 2: Runtime (node:24-alpine)
#   - Copy dist/ + node_modules (production only)
#   - ENTRYPOINT ["tini", "--", "node", "dist/index.js"]
#   - USER node (non-root)

# docker-compose.yml
services:
  db:
    image: postgres:17-alpine
    healthcheck: pg_isready
  server:
    build: { context: .., dockerfile: docker/Dockerfile }
    ports: ["3100:3100"]
    pids_limit: 2048
    stop_grace_period: 90s
    environment:
      DATABASE_URL: postgres://paperclip:***@db:5432/paperclip
      SERVE_UI: "true"
      PAPERCLIP_DEPLOYMENT_MODE: "authenticated"
      PAPERCLIP_DEPLOYMENT_EXPOSURE: "private"
    volumes:
      - paperclip-data:/paperclip
```

### 6.3 Deploy Targets

| Target | Config | Artefatos |
|--------|--------|-----------|
| **Docker Compose** | `docker/docker-compose.yml` | Local/prod single-host |
| **ECS (Fargate)** | `docker/ecs-task-definition.json` | AWS production |
| **Quadlet (systemd)** | `docker/quadlet/` | Linux VMs, bare metal |
| **Render/Cloud** | Custom | Managed hosting |

### 6.4 Release Automation (`scripts/release.sh`)

```bash
# Release flow:
./scripts/release.sh [canary|stable]
  │
  ├─► pnpm run build:npm          # Build npm packages
  ├─► pnpm run release:bootstrap-package
  ├─► pnpm run release:github     # GitHub release + artifacts
  ├─► pnpm run release:canary     # Canary tag (next)
  └─► pnpm run release:stable     # Stable tag (latest)
```

---

## 7. Armazenamento de Arquivos e Dados Persistentes

### 7.1 Storage Abstraction (`server/src/storage/`)

```typescript
// provider-registry.ts
interface StorageProvider {
  upload(key: string, stream: Readable): Promise<UploadResult>;
  download(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  list(prefix: string): AsyncIterable<StorageObject>;
  presignedUrl(key: string, ttl: number): Promise<string>;
}

// Providers implementados:
// - S3Provider (AWS S3, MinIO, R2, etc.)
// - LocalProvider (filesystem) — dev only
// - MemoryProvider — tests only
```

### 7.2 Configuração de Storage

```typescript
// config.ts → loadStorageConfig()
interface StorageConfig {
  provider: "s3" | "local";
  bucket: string;
  region: string;
  endpoint?: string;        // Para S3-compatible (MinIO, R2)
  credentials?: { accessKeyId, secretAccessKey };
  // Multipart upload config
  multipartThreshold: number = 100 * 1024 * 1024; // 100MB
  multipartChunkSize: number = 50 * 1024 * 1024;  // 50MB
}
```

### 7.3 Persistent Data Locations

| Dado | Localização (Dev) | Localização (Docker) | Localização (Prod) |
|------|-------------------|----------------------|---------------------|
| **PostgreSQL** | `~/.paperclip/embedded-postgres/` | `pgdata` volume | Managed PG (RDS, Cloud SQL) |
| **File Storage** | `~/.paperclip/storage/` | `paperclip-data` volume | S3/MinIO/R2 |
| **Plugins** | `~/.paperclip/plugins/` | `/paperclip/plugins` | S3 + local cache |
| **Worktrees** | `~/.paperclip/worktrees/` | `/paperclip/worktrees` | Ephemeral |
| **Logs** | `~/.paperclip/logs/` | stdout/stderr (Docker) | Cloud logging |
| **Backups** | `~/.paperclip/backups/` | `/paperclip/backups` | S3 + retention |

---

## 8. Porta 3100 e Integração MCP — Situação Atual

### 8.1 Porta 3100

```yaml
# docker/docker-compose.yml
ports:
  - "3100:3100"

# config.ts default
port: 3100

# Environment override
PORT=3100
```

**Status:** Porta 3100 é a porta padrão para HTTP + WebSocket. Configurável via `PORT` env var. No Docker Compose, mapeada 3100:3100.

### 8.2 Integração MCP

| Componente | Status | Detalhes |
|------------|--------|----------|
| **MCP Server (STDIO)** | ✅ Implementado | `packages/mcp-server/` — `paperclip-mcp-server` binary |
| **Public MCP (HTTP/SSE)** | ✅ Implementado | `server/src/services/public-mcp/` + routes |
| **MCP Apps** | ✅ Implementado | `server/src/routes/mcp-apps.ts` — registry de MCP servers externos |
| **MCP Skills** | ✅ Implementado | `server/src/routes/mcp-skills.ts` — skills que expõem tools via MCP |
| **MCP Gateway** | ✅ Implementado | `server/src/routes/tool-gateway.ts` — `mcpGatewayProtocolRoutes` |
| **OAuth para MCP** | ✅ Implementado | `public-mcp/oauth.ts` — client credentials flow |
| **File Transfers** | ✅ Implementado | `public-mcp/file-transfers.ts` — large payloads |
| **Revocation Index** | ✅ Implementado | `public-mcp/revocation-index-sync.ts` |

**Nenhum serviço precisa ser reiniciado** — a integração MCP está ativa e funcional no código atual.

---

## 9. Observabilidade

### 9.1 Logging (Pino)

```typescript
// middleware/logger.ts
// Structured JSON logs
// Levels: trace, debug, info, warn, error, fatal
// Redaction: middleware/log-redaction.ts + redaction.ts
// Output: stdout (Docker) ou file (dev)
```

### 9.2 Metrics (OpenTelemetry)

```typescript
// instrumentation.ts
// OTel SDK initialization
// Exporters: OTLP (gRPC/HTTP), Prometheus
// Auto-instrumentations: HTTP, PG, Redis, DNS, FS
// Custom metrics: server-metrics.ts (request latency, DB queries, etc.)
```

### 9.3 Tracing

```typescript
// OpenTelemetry traces
// Spans: HTTP requests, DB queries, background jobs, plugin RPC
// Context propagation: W3C TraceContext headers
// Sampling: parent-based + traceid-ratio (configurável)
```

### 9.4 Error Tracking (Sentry)

```typescript
// sentry.ts
// DSN via env: SENTRY_DSN
// Captures: unhandled exceptions, error handler, manual captureException
// Release tracking: __PAPERCLIP_BUILD_COMMIT__
// Performance: transaction tracing (opcional)
```

### 9.5 Health Endpoints

| Endpoint | Verifica | Uso |
|----------|----------|-----|
| `GET /api/health` | DB connectivity, basic | Load balancer health |
| `GET /api/ready` | Migrations applied, workers ready | K8s readiness probe |
| `GET /api/liveness` | Process alive | K8s liveness probe |
| `GET /api/instance-server-metrics` | Detailed metrics | Monitoring dashboards |

---

## 10. Evidências de Investigação

| Item | Fonte | Tipo |
|------|-------|------|
| Entry point | `server/src/index.ts` | Código |
| App factory | `server/src/app.ts` | Código |
| Config system | `server/src/config.ts` | Código |
| Docker compose | `docker/docker-compose.yml` | Código |
| Dockerfile | `docker/Dockerfile` | Código |
| Shutdown | `server/src/shutdown.ts` | Código |
| Embedded PG | `packages/db/src/embedded-postgres-*.ts` | Código |
| Storage | `server/src/storage/` | Código |
| MCP server | `packages/mcp-server/` | Código |
| Public MCP | `server/src/services/public-mcp/` | Código |
| Health routes | `server/src/routes/health.ts`, `ready.ts`, `liveness.ts` | Código |
| Instrumentation | `server/src/instrumentation.ts` | Código |
| Release scripts | `scripts/release.sh`, `scripts/build-npm.sh` | Código |
| Dev scripts | `scripts/dev-both.mjs`, `scripts/dev-runner.ts` | Código |

---

*Documento baseado em inspeção direta de código e arquivos de configuração. Nenhum deploy ou execução de servidor foi realizada — análise estática apenas.*