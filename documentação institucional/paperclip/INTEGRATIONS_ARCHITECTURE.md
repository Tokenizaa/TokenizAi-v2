# Paperclip — Engenharia Reversa: Arquitetura de Integrações

> **Data:** 21 de novembro de 2026  
> **Versão analisada:** 0.3.1  
> **Diretório:** `/home/lg/workspace/NettosCorp/NettosCorp/paperclip`

---

## 1. Visão Geral do Ecossistema de Integrações

O Paperclip possui **4 camadas principais de integração**:

| Camada | Componentes | Protocolo |
|--------|-------------|-----------|
| **Agent Adapters** | 12 adapters (locais + gateways) | ACP (Agent Client Protocol) |
| **Plugin System** | SDK + 9 sandbox providers + examples | Custom RPC over WebSocket |
| **MCP** | STDIO server + HTTP gateway + apps/skills | MCP (Model Context Protocol) |
| **External APIs** | GitHub, Discord, Slack, Telegram, Teams, 1Password, Tailscale, Vercel | REST + Webhooks + SDKs |

---

## 2. Sistema de Adapters (Agentes)

### 2.1 Arquitetura

```
packages/adapters/
├── adapter-utils/              # Shared utilities
├── claude-local/               # Anthropic Claude CLI (ACP)
├── codex-local/                # OpenAI Codex CLI (ACP)
├── cursor-local/               # Cursor IDE local (ACP)
├── cursor-cloud/               # Cursor Cloud (gateway)
├── gemini-local/               # Google Gemini CLI (ACP)
├── grok-local/                 # xAI Grok CLI (ACP)
├── hermes/                     # Hermes Agent (local + gateway HTTP/SSE)
├── hermes-gateway/             # Deprecated shim → hermes/
├── kimi-local/                 # Moonshot Kimi CLI (ACP)
├── openclaw-gateway/           # OpenClaw gateway
├── opencode-local/             # OpenCode CLI (ACP)
└── pi-local/                   # Pi CLI (ACP)
```

### 2.2 Adapter Interface (ACP)

Todos os adapters locais implementam **ACP (Agent Client Protocol)**:

```typescript
// @agentclientprotocol/sdk v1.9.0
interface AgentClient {
  // Session management
  authenticate(credentials): Promise<Session>;
  createSession(config): Promise<Session>;
  terminateSession(sessionId): Promise<void>;
  
  // Execution
  runTask(sessionId, task): AsyncIterable<Event>;
  cancelTask(sessionId, taskId): Promise<void>;
  
  // Capabilities
  getCapabilities(): Promise<Capabilities>;
  listTools(): Promise<Tool[]>;
}
```

### 2.3 Adapter Registry (`server/src/services/adapters.ts`)

```typescript
// Bootstrap no startup
async function reconcileAdapterAvailability(config) {
  // 1. Parse env var: PAPERCLIP_ADAPTER_REGISTRY
  // 2. Para cada adapter: verifica binário, versão, health
  // 3. Registra no DB (adapter_auth_sessions, adapter_settings)
  // 4. Disponibiliza para agent hiring
}
```

### 2.4 Adapters Locais vs Gateways

| Tipo | Adapters | Comunicação |
|------|----------|-------------|
| **Local (CLI)** | claude, codex, cursor, opencode, gemini, grok, kimi, pi | Spawn subprocess → ACP stdio |
| **Gateway (HTTP/SSE)** | hermes, cursor-cloud, openclaw | HTTP REST + SSE streaming |
| **Cloud** | cursor-cloud | Cursor API remota |

### 2.5 Adapter Settings & Credentials

```typescript
// server/src/services/adapter-settings.ts
// Armazenado em DB (adapter_settings) + secrets (1Password)
// Por company + adapter
interface AdapterSettings {
  enabled: boolean;
  defaultModel?: string;
  customArgs?: string[];
  envVars?: Record<string, string>;
  credentials?: SecretRef; // 1Password reference
}
```

---

## 3. Sistema de Plugins

### 3.1 Plugin SDK (`packages/plugins/sdk/`)

```typescript
// @paperclipai/plugin-sdk v1.0.0 — API estável pública
// Worker-side context + UI bridge hooks

// Host fornece:
interface HostServices {
  // DB access (scoped)
  db: ScopedDatabase;
  // Auth
  auth: AuthContext;
  // Tool gateway
  tools: ToolGateway;
  // File storage
  storage: StorageService;
  // Events
  events: EventBus;
  // UI bridge
  ui: UIBridge; // React components via postMessage
}

// Plugin define:
interface PluginDefinition {
  manifest: PluginManifest;
  initialize(host: HostServices): Promise<void>;
  dispose(): Promise<void>;
  // Optional hooks
  onToolCall?: (tool, args) => Promise<Result>;
  onUIMount?: (container) => ReactNode;
}
```

### 3.2 Plugin Worker Isolation

```
┌─────────────────────────────────────────────────────────────┐
│                    PAPERCLIP SERVER                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Plugin Host │  │ Plugin Host │  │ Plugin Host │  ...     │
│  │  (Worker 1) │  │  (Worker 2) │  │  (Worker 3) │          │
│  │             │  │             │  │             │          │
│  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │          │
│  │ │ Plugin A│ │  │ │ Plugin B│ │  │ │ Plugin C│ │          │
│  │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          ▼                                   │
│              ┌───────────────────────┐                       │
│              │   Plugin RPC Channel  │  (WebSocket + postMessage)│
│              └───────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Plugin Lifecycle

| Fase | Arquivo | Descrição |
|------|---------|-----------|
| **Discovery** | `plugin-loader.ts` | Scan `~/.paperclip/plugins/` + bundled |
| **Install** | `skill-package-store.ts` | npm install em worker isolado |
| **Load** | `plugin-worker-manager.ts` | Spawn worker, establish RPC |
| **Initialize** | `plugin-lifecycle.ts` | Call `initialize(hostServices)` |
| **Runtime** | `plugin-job-scheduler.ts` | Schedule jobs, tool calls |
| **Unload** | `plugin-worker-manager.ts` | Graceful shutdown, `dispose()` |

### 3.4 Sandbox Providers (`packages/plugins/sandbox-providers/`)

| Provider | Tipo | Uso |
|----------|------|-----|
| **Daytona** | Cloud dev environments | Secure, persistent |
| **E2B** | Cloud sandboxes | Fast, ephemeral |
| **Modal** | Serverless containers | GPU, custom images |
| **Kubernetes** | K8s pods | Self-hosted, scalable |
| **Cloudflare** | Cloudflare Workers | Edge, low latency |
| **Boxd** | MicroVMs | Strong isolation |
| **CreateOS** | Custom | Experimental |
| **Novita** | GPU cloud | ML workloads |
| **exe-dev** | Local exec | Dev only |

---

## 4. MCP (Model Context Protocol)

### 4.1 MCP Server (`packages/mcp-server/`)

```typescript
// @paperclipai/mcp-server — STDIO transport
// Expõe tools do Paperclip para clientes MCP (Cursor, Claude Desktop, etc.)

// Tools expostas:
- paperclip_list_agents
- paperclip_run_agent
- paperclip_get_issue
- paperclip_create_issue
- paperclip_search_workspaces
- paperclip_read_secrets
- ... (30+ tools)
```

### 4.2 Public MCP (`server/src/services/public-mcp/`)

| Componente | Arquivo | Função |
|------------|---------|--------|
| **OAuth** | `oauth.ts` | MCP client authentication |
| **Capabilities** | `capabilities.ts` | Tool discovery, execution |
| **Events** | `events.ts` | Real-time notifications |
| **File Transfers** | `file-transfers.ts` | Large payload handling |
| **Ingress** | `public-mcp.ts` routes | HTTP/SSE endpoint |
| **Revocation Index** | `revocation-index-sync.ts` | Token revocation sync |

### 4.3 MCP Apps & Skills (`server/src/routes/mcp-apps.ts`, `mcp-skills.ts`)

- **MCP Apps**: External MCP servers registrados no Paperclip
- **MCP Skills**: Skills que expõem tools via MCP
- **Gateway**: `mcpGatewayProtocolRoutes` — proxy para MCP servers externos

---

## 5. APIs REST

### 5.1 OpenAPI Spec

```typescript
// server/src/routes/openapi.ts
// Gera spec OpenAPI 3.1 dinamicamente das rotas registradas
// Inclui: paths, schemas, security, examples
```

### 5.2 Principais Endpoints por Domínio

| Domínio | Base Path | Exemplos |
|---------|-----------|----------|
| **Auth** | `/api/auth/*` | `signin`, `signup`, `callback`, `session` |
| **Companies** | `/api/companies` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id` |
| **Agents** | `/api/agents` | `GET /`, `POST /`, `POST /:id/hire`, `POST /:id/run` |
| **Issues** | `/api/issues` | `GET /`, `POST /`, `GET /:id`, `POST /:id/comments` |
| **Chat** | `/api/chat` | `GET /channels`, `POST /webhook/:provider` |
| **Cases** | `/api/cases` | `GET /`, `POST /`, `POST /:id/handoff` |
| **Workspaces** | `/api/workspaces` | `GET /`, `POST /`, `GET /:id/snapshot` |
| **Tools** | `/api/tool-access` | `GET /connections`, `POST /connections` |
| **MCP** | `/api/mcp` | `GET /apps`, `POST /apps`, `GET /skills` |
| **Plugins** | `/api/plugins` | `GET /`, `POST /`, `GET /:id/jobs` |
| **Secrets** | `/api/secrets` | `GET /`, `POST /`, `POST /proposals` |
| **Budgets** | `/api/costs` | `GET /`, `GET /budgets`, `POST /budgets` |

### 5.3 Autenticação API

| Método | Uso |
|--------|-----|
| **Session Cookie** | Browser UI (HttpOnly, SameSite=Lax) |
| **Bearer Token** | CLI, agents, MCP clients |
| **API Key** | Agent API keys (scoped, rotatable) |
| **Setup Token** | CLI onboarding flow (short-lived) |

---

## 6. CLI (`cli/`)

### 6.1 Estrutura

```
cli/
├── src/
│   ├── index.ts              # Entry point
│   ├── commands/             # Subcomandos
│   │   ├── onboard.ts        # Onboarding interativo
│   │   ├── dev.ts            # Dev server
│   │   ├── build.ts          # Build packages
│   │   ├── release.ts        # Release automation
│   │   ├── db.ts             # Migrations, seed
│   │   └── ...
│   ├── services/             # Onboard service, install store
│   ├── config/               # CLI config
│   └── prompts/              # @clack/prompts UI
├── package.json
└── tsconfig.json
```

### 6.2 Principais Comandos

| Comando | Descrição |
|---------|-----------|
| `paperclipai onboard` | Interactive setup (config, auth, DB) |
| `paperclipai dev` | Start dev server (server + UI) |
| `paperclipai build` | Build all packages (tsc + vite) |
| `paperclipai db:migrate` | Run pending migrations |
| `paperclipai db:generate` | Generate Drizzle migrations |
| `paperclipai release` | Automated release (version, changelog, publish) |
| `paperclipai paperclipai` | Internal CLI commands |

---

## 7. Integração Hermes

### 7.1 Hermes Adapter (`packages/adapters/hermes/`)

```typescript
// Duas variantes:
// 1. hermes-local — Hermes Agent CLI via ACP (spawn subprocess)
// 2. hermes-gateway — HTTP/SSE gateway para Hermes remoto

// packages/adapters/hermes/src/server/index.ts
export const hermesAdapter: Adapter = {
  id: "hermes",
  name: "Hermes Agent",
  protocol: "acp", // ou "gateway"
  capabilities: {
    tools: true,
    streaming: true,
    cancellation: true,
  },
};
```

### 7.2 Hermes Gateway Integration

- **Server-side**: `server/src/routes/tool-gateway.ts` — `mcpGatewayProtocolRoutes`
- **UI**: `ui/src/adapters/hermes-gateway/` — Connection UI
- **Auth**: Workspace login handoff → Hermes session

---

## 8. Comunicação com Processos Externos

### 8.1 Subprocess Management

```typescript
// server/src/services/native-runtime/
// Spawns e gerencia: claude, codex, cursor, copilot, opencode

// Patterns:
- Stdout/Stderr piping → log aggregation
- ACP protocol over stdio
- Process lifecycle: spawn → monitor → restart → kill
- Resource limits: CPU, memory, disk (via sandbox providers)
```

### 8.2 WebSocket Servers (`server/src/realtime/`)

| Server | Arquivo | Clientes | Protocolo |
|--------|---------|----------|-----------|
| **Live Events** | `live-events-ws.ts` | UI (browser) | JSON-RPC over WS |
| **Plugin API** | `plugin-api-ws.ts` | Plugin workers | Custom RPC |
| **Runner PRP** | `runner-prp-ws.ts` | Native runners | PRP protocol |
| **Environment Terminal** | `environment-custom-image-terminal-ws.ts` | UI | xterm.js protocol |

---

## 9. Gerenciamento de Credenciais e Segredos

### 9.1 Secret Providers

| Provider | Arquivo | Uso |
|----------|---------|-----|
| **1Password** | `secrets.ts`, `@1password/sdk` | Primary (teams, CLI) |
| **Env File** | `config.ts` | Dev, CI |
| **Database** | `company_secrets` table | Fallback, proposals |
| **Vercel** | `vercel-connect.ts` | Vercel env vars |

### 9.2 Secret Proposals Flow

```
User requests secret → Creates proposal (company_secret_proposals)
       ↓
Admin approves → Secret written to 1Password + DB (company_secrets)
       ↓
Agent/Plugin consumes → Runtime injection via secret-proposals.ts
```

### 9.3 Tool OAuth (`tool-access.ts`, `tool-oauth-states.ts`)

- **OAuth flows** para: GitHub, Slack, Discord, Google, etc.
- **State management** para PKCE, callback handling
- **Token storage** criptografado em DB + 1Password sync

---

## 10. Diagrama de Dependências de Integração

```
┌────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL CLIENTS                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Cursor  │  │  Claude  │  │  MCP     │  │  CLI     │           │
│  │  Desktop │  │  Desktop │  │  Client  │  │  (paper- │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │  clipai) │           │
│       │             │             │         └────┬─────┘           │
│       └─────────────┼─────────────┼──────────────┘                 │
│                     ▼             ▼                                │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    PAPERCLIP SERVER                          │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐  │  │
│  │  │ MCP Server │ │ Tool       │ │ Plugin     │ │ Adapter  │  │  │
│  │  │ (STDIO)    │ │ Gateway    │ │ Workers    │ │ Registry │  │  │
│  │  └──────┬─────┘ └──────┬─────┘ └──────┬─────┘ └────┬─────┘  │  │
│  │         │              │              │             │        │  │
│  │         └──────────────┼──────────────┼─────────────┘        │  │
│  │                        ▼              ▼                      │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │              CORE SERVICES (Domain Logic)             │   │  │
│  │  │  Agents │ Issues │ Chat │ Workspaces │ Secrets ...  │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                        │                                    │  │
│  │                        ▼                                    │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │              POSTGRESQL (Drizzle ORM)                 │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                     │              │              │               │
│         ┌───────────┘              │              └───────────┐   │
│         ▼                          ▼                          ▼   │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐│
│  │   GitHub    │           │  1Password  │           │  Sandbox    ││
│  │   Discord   │           │  Tailscale  │           │  Providers  ││
│  │   Slack     │           │  Vercel     │           │  (9 providers)│
│  │   Telegram  │           └─────────────┘           └─────────────┘│
│  │   Teams     │                                                          │
│  └─────────────┘                                                          │
└────────────────────────────────────────────────────────────────────┘
```

---

## 11. Evidências de Investigação

| Item | Fonte | Tipo |
|------|-------|------|
| Adapters dir | `ls packages/adapters/` | Execução |
| Adapter utils | `packages/adapters/adapter-utils/` | Código |
| Hermes adapter | `packages/adapters/hermes/package.json` | Código |
| Plugin SDK | `packages/plugins/sdk/src/index.ts` | Código |
| Sandbox providers | `ls packages/plugins/sandbox-providers/` | Execução |
| MCP server | `packages/mcp-server/package.json` | Código |
| Public MCP | `server/src/services/public-mcp/` | Código |
| CLI commands | `ls cli/src/commands/` | Execução |
| Tool gateway | `server/src/routes/tool-gateway.ts` | Código |
| Secret management | `server/src/services/secrets.ts` | Código |
| Realtime WS | `ls server/src/realtime/` | Execução |

---

*Documento baseado em inspeção direta de código e estrutura de arquivos. Nenhuma integração foi testada em runtime — análise estática apenas.*