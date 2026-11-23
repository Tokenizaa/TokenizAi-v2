# Integrações e Runtimes

> **Versão:** 1.0  
> **Data:** 21 de novembro de 2026  
> **Status:** **PROPOSTA** — Consolida Paperclip + Agency Agents + TokenizAi  
> **Responsável:** Hermes

---

## 1. Mapa de Integrações

| Camada | Tecnologia | Status | Fonte |
|--------|------------|--------|-------|
| **Agent Protocol** | ACP (Agent Client Protocol) v1.9.0 | ✅ 12 adapters prontos | Paperclip |
| **Tool Protocol** | MCP (Model Context Protocol) v1.0 | ✅ STDIO + HTTP/SSE | Paperclip |
| **Plugin System** | Plugin SDK v1.0.0 (Worker isolation) | ✅ Estável | Paperclip |
| **Sandbox** | 9 providers (Daytona, E2B, Modal, K8s, etc.) | ✅ Configurável | Paperclip |
| **Hermes Bridge** | Plugin Router (HTTP/SSE) | ⚠️ Quebrado (script ausente) | Agency Agents |
| **Chat Providers** | Discord, Slack, GitHub, Telegram, Teams | ✅ 5 providers | Paperclip |
| **Cloudflare Workers** | Edge runtime (TokenizAi) | ✅ Atual | TokenizAi |
| **Git Providers** | GitHub, GitLab, Bitbucket | ✅ Via chat channels | Paperclip |

---

## 2. ACP Adapters (Agent Client Protocol)

### 2.1 Adapters Disponíveis (12 — EVIDENCIADO)

| Adapter | Tipo | Runtime | Install Kind | Status |
|---------|------|---------|--------------|--------|
| **claude-local** | CLI Local | Anthropic Claude Code | per-agent | ✅ Installable |
| **codex-local** | CLI Local | OpenAI Codex | per-agent | ✅ Installable |
| **cursor-local** | CLI Local | Cursor IDE | per-agent | ✅ Installable |
| **cursor-cloud** | Gateway | Cursor Cloud API | per-agent | ✅ Installable |
| **gemini-local** | CLI Local | Google Gemini CLI | per-agent | ✅ Installable |
| **grok-local** | CLI Local | xAI Grok CLI | per-agent | ✅ Installable |
| **kimi-local** | CLI Local | Moonshot Kimi CLI | per-agent | ⚠️ Recognized-only |
| **opencode-local** | CLI Local | OpenCode | per-agent | ✅ Installable |
| **pi-local** | CLI Local | Pi CLI | per-agent | ✅ Installable |
| **copilot** | CLI Local | GitHub Copilot | per-agent | ✅ Installable |
| **qwen** | CLI Local | Qwen | per-agent | ✅ Installable |
| **hermes** | Plugin | Hermes Gateway | plugin | ⚠️ **QUEBRADO** |

### 2.2 Adapter Interface (ACP)

```typescript
interface AgentClient {
  // Session Management
  authenticate(credentials: Credentials): Promise<Session>;
  createSession(config: SessionConfig): Promise<Session>;
  terminateSession(sessionId: string): Promise<void>;
  
  // Execution
  runTask(sessionId: string, task: Task): AsyncIterable<AgentEvent>;
  cancelTask(sessionId: string, taskId: string): Promise<void>;
  
  // Capabilities
  getCapabilities(): Promise<Capabilities>;
  listTools(): Promise<Tool[]>;
  
  // Streaming
  onEvent(handler: (event: AgentEvent) => void): void;
}

type AgentEvent = 
  | { type: 'text'; content: string }
  | { type: 'tool_call'; tool: string; args: any; call_id: string }
  | { type: 'tool_result'; call_id: string; result: any }
  | { type: 'thinking'; content: string }
  | { type: 'error'; message: string; code: string }
  | { type: 'complete'; result: any };
```

### 2.3 Adapter Registry (Paperclip)

- **Bootstrap:** `reconcileAdapterAvailability(config)` no startup
- **Config:** `PAPERCLIP_ADAPTER_REGISTRY` env var ou `adapter_settings` no DB
- **Health Check:** Verifica binário, versão, responde a `getCapabilities()`
- **Per-Company:** Settings em `adapter_settings` (company_id + adapter_id)

---

## 3. MCP (Model Context Protocol)

### 3.1 MCP Server (STDIO) — Paperclip

```bash
# Binary: paperclip-mcp-server
# Transport: STDIO
# Tools expostas (30+):
paperclip_list_agents
paperclip_run_agent
paperclip_get_issue
paperclip_create_issue
paperclip_search_workspaces
paperclip_read_secrets
# ... etc
```

### 3.2 MCP Gateway (HTTP/SSE) — Paperclip

| Endpoint | Descrição |
|----------|-----------|
| `GET /mcp/capabilities` | Lista tools + resources disponíveis |
| `POST /mcp/tools/call` | Executa tool via MCP |
| `GET /mcp/resources/:uri` | Acessa resource |
| `POST /mcp/subscribe` | Subscrição a eventos |

### 3.3 Public MCP (OAuth + Multi-tenant)

- **OAuth Flow:** Client credentials + PKCE para agentes externos
- **Capabilities:** Tool discovery, execution, resource access
- **File Transfers:** Large payload handling via presigned URLs
- **Revocation Index:** Token revocation sync across instances

### 3.4 MCP Apps & Skills Registry

| Tipo | Descrição |
|------|-----------|
| **MCP Apps** | Servidores MCP externos registrados no Paperclip |
| **MCP Skills** | Skills que expõem tools via MCP (auto-register) |
| **Gateway** | Proxy para MCP servers externos (`mcpGatewayProtocolRoutes`) |

---

## 4. Plugin System (Paperclip Plugin SDK v1.0.0)

### 4.1 Arquitetura Worker-Isolado

```
Paperclip Server (Main Process)
         │
         ├── Plugin Worker 1 (Node.js isolate)
         │       └── Plugin A (RPC over WebSocket)
         │
         ├── Plugin Worker 2 (Node.js isolate)
         │       └── Plugin B
         │
         └── Plugin Worker N
                 └── Plugin N
```

### 4.2 Plugin SDK Interface (v1.0.0 — ESTÁVEL)

```typescript
// Host Services (fornecidos pelo Paperclip)
interface HostServices {
  db: ScopedDatabase;           // DB access scoped to plugin
  auth: AuthContext;            // Current actor, permissions
  tools: ToolGateway;           // Access to ACP/MCP tools
  storage: StorageService;      // File storage (S3/R2/local)
  events: EventBus;             // Pub/Sub plugin ↔ host
  ui: UIBridge;                 // React components via postMessage
}

// Plugin Definition
interface PluginDefinition {
  manifest: PluginManifest;     // name, version, permissions, entry point
  initialize(host: HostServices): Promise<void>;
  dispose(): Promise<void>;
  
  // Optional hooks
  onToolCall?: (tool: string, args: any) => Promise<ToolResult>;
  onUIMount?: (container: HTMLElement) => ReactNode;
  onSchedule?: (cron: string) => Promise<void>;
}
```

### 4.3 Plugin Lifecycle

| Fase | Descrição |
|------|-----------|
| **Discovery** | Scan `~/.paperclip/plugins/` + bundled plugins |
| **Install** | `npm install` em worker isolado (paperclip-runner) |
| **Load** | Spawn worker, establish RPC channel (WebSocket) |
| **Initialize** | Call `initialize(hostServices)` |
| **Runtime** | Schedule jobs, handle tool calls, UI mount |
| **Unload** | Graceful shutdown, call `dispose()` |

### 4.4 Sandbox Providers (9 — Para Plugins e Agents)

| Provider | Tipo | Isolamento | Uso Típico |
|----------|------|------------|------------|
| **Daytona** | Cloud dev env | Container | Persistent, secure |
| **E2B** | Cloud sandbox | MicroVM | Fast, ephemeral |
| **Modal** | Serverless containers | Container | GPU, custom images |
| **Kubernetes** | K8s pods | Pod | Self-hosted, scalable |
| **Cloudflare** | Workers | Isolate | Edge, low latency |
| **Boxd** | MicroVMs | MicroVM | Strong isolation |
| **CreateOS** | Custom | Custom | Experimental |
| **Novita** | GPU Cloud | Container | ML workloads |
| **exe-dev** | Local exec | Process | Dev only |

---

## 5. Sandbox Providers para Execução de Agentes

### 5.1 Selection Policy

| Critério | Provider Preferido |
|----------|-------------------|
| **GPU/ML** | Modal, Novita |
| **Baixa latência (edge)** | Cloudflare Workers |
| **Isolamento forte** | Boxd, Daytona |
| **Auto-hosted** | Kubernetes, Boxd |
| **Dev/Testing** | exe-dev, E2B |
| **Custom images** | Modal, Daytona |

### 5.2 Resource Limits (Por Execução)

```typescript
interface SandboxLimits {
  cpu: string;           // "1000m" = 1 vCPU
  memory: string;        // "2Gi"
  disk: string;          // "10Gi"
  timeout: number;       // seconds, max 3600
  network: 'none' | 'restricted' | 'full';
  gpu?: { count: number; type: string };
}
```

### 5.3 Lifecycle de Execução

```
1. Task Dispatch → Select Sandbox Provider
         │
         ▼
2. Provider.createSandbox(limits, image, env)
         │
         ▼
3. Sandbox Ready → Inject Agent Runtime (ACP/MCP)
         │
         ▼
4. Execute Task → Stream Events (ACP/MCP)
         │
         ▼
5. Collect Artifacts → Store in Storage (S3/R2)
         │
         ▼
6. Snapshot (git + filesystem) → Ledger
         │
         ▼
7. Destroy Sandbox (ou keep alive para reuse)
```

---

## 6. Chat Providers Integration (Paperclip)

### 6.1 Provider Adapters (5 — EVIDENCIADO)

| Provider | Adapter | Auth | Inbound | Outbound |
|----------|---------|------|---------|----------|
| **Discord** | `chat-discord*.ts` | Bot Token + Slash | Webhook + Gateway | REST + Gateway |
| **Slack** | `chat-channels.ts` | Bot Token + Socket Mode | Socket Mode | REST |
| **GitHub** | `chat-github*.ts` | GitHub App | Webhook | GraphQL + REST |
| **Telegram** | `chat-channels.ts` | Bot Token | Webhook | Bot API |
| **Teams** | `chat-channels.ts` | Bot Framework | Webhook | Bot Framework |

### 6.2 Unified Chat Delivery

```typescript
interface ChatDelivery {
  id: string;
  channel_id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  sender: { type: 'user' | 'agent' | 'system'; id: string; name: string };
  content: string;
  content_type: 'text' | 'markdown' | 'blocks' | 'files';
  blocks?: any[];                    // Provider-specific (Slack blocks, Discord embeds)
  attachments?: Attachment[];
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  external_message_id: string;
  timestamps: { created: Date; sent?: Date; delivered?: Date; read?: Date };
}
```

### 6.3 Features Cross-Provider

| Feature | Discord | Slack | GitHub | Telegram | Teams |
|---------|---------|-------|--------|----------|-------|
| **Threads** | ✅ | ✅ | ✅ (PR discussions) | ✅ | ✅ |
| **Rich Blocks** | ✅ (embeds) | ✅ (blocks) | ✅ (markdown) | ✅ (inline keyboard) | ✅ (adaptive cards) |
| **Slash Commands** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **File Upload** | ✅ | ✅ | ✅ (Gists) | ✅ | ✅ |
| **Reactions** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Mentions** | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 7. Cloudflare Workers Integration (TokenizAi)

### 7.1 Edge Runtime Characteristics

| Característica | Detalhe |
|----------------|---------|
| **Runtime** | Cloudflare Workers (V8 Isolates) |
| **Limites** | CPU: 10-50ms, Memory: 128MB, Request: 100KB |
| **Storage** | KV, D1 (SQLite), R2, Durable Objects |
| **Networking** | Fetch API, WebSockets (Durable Objects), TCP Connect |
| **Deploy** | `wrangler deploy` — global em segundos |

### 7.2 Integração com Paperclip (Híbrido)

| Componente | Onde Roda | Comunicação |
|------------|-----------|-------------|
| **API Gateway** | Cloudflare Workers | REST + WebSocket (Durable Objects) |
| **Auth/Session** | Cloudflare Workers + KV | JWT + KV sessions |
| **Rate Limit** | Cloudflare Workers + KV | Sliding window |
| **Static Assets** | Cloudflare Pages / R2 | CDN global |
| **Core Orchestration** | Paperclip Server (VM/Container) | gRPC / REST interno |
| **Agent Runtime** | Sandbox Providers (VM) | ACP/MCP sobre rede privada |

### 7.3 Durable Objects para Estado

```typescript
// Exemplo: Session Manager como Durable Object
export class SessionManager extends DurableObject {
  async handleWebSocket(ws: WebSocket) {
    // Gerencia conexões WS de agents em tempo real
  }
  
  async getSession(sessionId: string) {
    // Estado persistente no Durable Object storage
  }
}
```

---

## 8. Git Providers Integration

| Provider | Integração | Auth | Features |
|----------|------------|------|----------|
| **GitHub** | Chat channel + GitHub App | GitHub App (Install) | PR reviews, issues, checks, webhooks |
| **GitLab** | Planejado | OAuth + PAT | MR reviews, pipelines |
| **Bitbucket** | Planejado | OAuth | PR reviews |

### 8.1 GitHub App Permissions (Paperclip)

| Permission | Access | Uso |
|------------|--------|-----|
| **Contents** | Read/Write | Clone, push, create files |
| **Issues** | Read/Write | Create, update, comment |
| **Pull Requests** | Read/Write | Reviews, comments, merge |
| **Checks** | Read/Write | CI status, annotations |
| **Metadata** | Read | Repo info |
| **Webhooks** | Read/Write | Event subscription |

---

## 9. Observabilidade Cross-Runtime

| Métrica | Fonte | Agregação |
|---------|-------|-----------|
| **Agent Spawn Latency** | Sandbox Provider + ACP | p50, p95, p99 |
| **Task Execution Time** | Paperclip Runtime API | Histograma |
| **MCP Tool Call Latency** | MCP Gateway | p50, p95 |
| **Plugin RPC Latency** | Plugin Worker RPC | p50, p95 |
| **Chat Delivery Latency** | Chat Channels | p50, p95 |
| **Sandbox Startup Time** | Provider API | p50, p95 |
| **Context Window Usage** | Hermes Subagent | Gauge |
| **Cost per Task** | Cost Events | Soma por task/agent |

---

## 10. Gaps e Riscos

| Gap | Risco | Mitigação |
|-----|-------|-----------|
| Hermes Plugin quebrado | 🔴 Integração Hermes inoperante | Recuperar `build-hermes-plugin.py` do upstream |
| Kimi/Kimi/OpenClaw recognized-only | 🟡 4 ferramentas sem install | Implementar renderers multi-file |
| Antigravity non-deterministic | 🔴 Parity test impossível | Patch `date_added` fixo |
| NEXUS playbooks ausentes | 🟡 Metodologia incompleta | Sync upstream `strategy/` |
| TokenizAi backend não auditado | 🟡 Desconhecido | Auditoria completa do `server.ts` |
| Cross-runtime tracing | 🟢 Não implementado | OTel propagation headers |

---

*Documento consolida todas as integrações: ACP (12), MCP (STDIO+HTTP), Plugin SDK (v1.0.0), Sandbox (9), Chat (5), Cloudflare Workers, GitHub. Hermes plugin requer fix crítico.*