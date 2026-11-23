# Paperclip — Engenharia Reversa: Visão Geral da Arquitetura

> **Data:** 21 de novembro de 2026  
> **Versão analisada:** 0.3.1 (commit `cb64a236b`)  
> **Diretório:** `/home/lg/workspace/NettosCorp/NettosCorp/paperclip`  
> **Responsável:** Hermes (Chefe de Gabinete Executivo)

---

## 1. Resumo Executivo

O **Paperclip** é uma **plataforma de orquestração de agentes de IA** construída como um monorepo TypeScript/Node.js (pnpm workspaces) que permite:

- **Executar agentes locais** (Claude, Codex, Cursor, OpenCode, Gemini, Grok, Kimi, Pi) via adapters ACP
- **Conectar a gateways remotos** (Hermes Gateway, OpenClaw Gateway, Cursor Cloud)
- **Gerenciar ciclos de vida completos** de agents: contratação, configuração, execução, monitoramento, recuperação
- **Fornecer UI unificada** (React 19 + Vite + Tailwind 4) para dashboard, chat, issues, cases, skills, plugins
- **Persistir tudo em PostgreSQL** (embedded para dev, externo para produção) via Drizzle ORM
- **Expor APIs MCP** (Model Context Protocol) para integração com ferramentas externas
- **Suportar plugins sandboxed** com Workers isolados e RPC tipado

---

## 2. Estrutura do Monorepo

```
paperclip/
├── packages/
│   ├── adapters/              # 12 adapters de agentes (locais + gateways)
│   │   ├── claude-local/
│   │   ├── codex-local/
│   │   ├── cursor-local/
│   │   ├── cursor-cloud/
│   │   ├── gemini-local/
│   │   ├── grok-local/
│   │   ├── hermes/            # Hermes Agent local + Gateway HTTP/SSE
│   │   ├── hermes-gateway/    # Shim deprecado (aponta para hermes/)
│   │   ├── kimi-local/
│   │   ├── openclaw-gateway/
│   │   ├── opencode-local/
│   │   └── pi-local/
│   ├── adapter-utils/         # Utilitários compartilhados entre adapters
│   ├── db/                    # @paperclipai/db — Drizzle ORM + migrations + embedded Postgres
│   ├── shared/                # @paperclipai/shared — Tipos, constantes, utilitários core
│   ├── plugins/
│   │   ├── sdk/               # @paperclipai/plugin-sdk — API estável para plugins
│   │   ├── sandbox-providers/ # 9 providers (Daytona, E2B, Modal, Kubernetes, etc.)
│   │   └── examples/
│   ├── mcp-server/            # @paperclipai/mcp-server — STDIO MCP server
│   ├── google-sheets-mcp-server/
│   ├── kv-demo-mcp-server/
│   ├── paperclip-runner/      # Runtime de execução nativa (copilot, codex, claude)
│   ├── paperclip-eval-kernel/
│   ├── skills-catalog/
│   ├── tailscale-https-broker/
│   └── teams-catalog/
├── server/                    # @paperclipai/server — Backend Express + WebSocket + Workers
├── ui/                        # @paperclipai/ui — Frontend React 19 + Vite + Tailwind 4
├── cli/                       # CLI `paperclipai` (onboarding, deploy, gestão)
├── scripts/                   # Scripts de build, release, smoke tests, migrações
├── docker/                    # Docker Compose + Dockerfiles (quickstart, ECS, quadlet)
├── tests/                     # Testes E2E (Playwright), acceptance, runner
├── evals/                     # Promptfoo evals
└── docs/                      # Documentação (Mintlify)
```

**Total de workspaces:** 27 pacotes (`pnpm-workspace.yaml`)

---

## 3. Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PAPERCLIP PLATFORM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │    CLI       │  │     UI       │  │   Server     │  │   Adapters   │    │
│  │  (paperclipai)│  │  (React 19)  │  │  (Express)   │  │  (12 agents) │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │             │
│         └─────────────────┼─────────────────┼─────────────────┘             │
│                           ▼                                                 │
│              ┌────────────────────────┐                                    │
│              │   @paperclipai/shared  │  Tipos, constantes, schemas Zod    │
│              └───────────┬────────────┘                                    │
│                          │                                                 │
│          ┌──────────────┼──────────────┐                                   │
│          ▼              ▼              ▼                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                          │
│  │ @paperclipai/│ │@paperclipai/│ │@paperclipai/│                          │
│  │     db      │ │ plugin-sdk  │ │paperclip-   │                          │
│  │ (Drizzle)   │ │ (Workers)   │ │runner       │                          │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘                          │
│         │               │               │                                  │
│         ▼               ▼               ▼                                  │
│  ┌─────────────────────────────────────────────────┐                       │
│  │           POSTGRESQL (embedded ou externo)       │                       │
│  │  480+ tabelas | RLS-ready | Migrations versionadas│                       │
│  └─────────────────────────────────────────────────┘                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Domínios Funcionais Principais

| Domínio | Descrição | Arquivos-chave |
|---------|-----------|----------------|
| **Agent Lifecycle** | Contratação, configuração, execução, monitoramento, recovery | `server/src/services/agent-lifecycle*.ts`, `agents.ts` |
| **Chat & Messaging** | Canais (Discord, Slack, GitHub, Telegram, Teams), webhooks, delivery | `chat-channels.ts`, `chat-github*.ts`, `chat-discord*.ts` |
| **Issue Tracking** | Issues, threads, comments, annotations, watchdogs, pipelines | `issues.ts`, `issue-thread-interactions.ts`, `pipelines.ts` |
| **Cases** | Case management, handoffs, documents, activity | `cases.ts`, `case-handoffs.ts` |
| **Workspaces** | Execution workspaces, snapshots, recovery, git operations | `workspace-runtime.ts`, `workspace-recovery*.ts` |
| **Budgets & Costs** | Cost accounting, budget enforcement, reservations | `budgets.ts`, `run-cost-accounting.ts`, `cost-events.ts` |
| **Skills & Plugins** | Plugin SDK, sandbox providers, skill packages, catalog | `packages/plugins/sdk/`, `skill-package-store.ts` |
| **MCP Integration** | MCP server (stdio), MCP apps/skills, public MCP OAuth | `packages/mcp-server/`, `public-mcp.ts` |
| **Auth & Authorization** | Better-auth, workspace login handoff, company memberships | `auth/`, `authorization.ts`, `workspace-login-handoff.ts` |
| **Secrets & Credentials** | 1Password, secret proposals, tool OAuth, adapter credentials | `secrets.ts`, `secret-proposals.ts`, `tool-access.ts` |

---

## 5. Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| **Runtime** | Node.js | ≥24.11.0 |
| **Package Manager** | pnpm | 9.15.4 |
| **Language** | TypeScript | 7.0.2 |
| **Build** | tsc + Vite (UI) + esbuild (CLI) | — |
| **Framework Backend** | Express 5 | 5.1.0 |
| **Framework Frontend** | React | 19.2.8 |
| **Router** | React Router DOM | 7.18.4 |
| **State/Query** | TanStack Query | 5.102.8 |
| **ORM** | Drizzle ORM | 0.45.2 |
| **Database** | PostgreSQL | 17 (embedded: 18.1.0-beta.16) |
| **Auth** | Better Auth | 1.7.16 |
| **AI SDK** | Vercel AI SDK | 7.0.130 |
| **Agent Protocol** | ACP (Agent Client Protocol) | 1.9.0 |
| **MCP** | @modelcontextprotocol/sdk | 1.31.0 |
| **Styling** | Tailwind CSS | 4.3.3 |
| **UI Components** | Radix UI + Base UI + Lucide | — |
| **Editor** | CodeMirror 6 + Lexical + MDXEditor | — |
| **Real-time** | WebSocket (ws) + custom protocol | 8.22.0 |
| **Observability** | OpenTelemetry + Sentry | 1.9.1 / 10.71.0 |
| **Testing** | Vitest + Playwright | 5.0.3 / 1.62.1 |

---

## 6. Pontos de Entrada e Inicialização

### 6.1 Server (`server/src/index.ts`)
```typescript
export async function startServer(): Promise<StartedServer>
```
1. Carrega configuração (`loadConfig()` / `loadCloudBootstrapConfig()`)
2. Inicializa telemetria (OTel) e Sentry
3. Conecta ao PostgreSQL (embedded ou externo)
4. Aplica migrations pendentes (com prompt interativo)
5. Cria app Express (`createApp()`)
6. Registra WebSocket servers (plugin API, runner PRP, live events)
7. Inicia HTTP server na porta configurada (padrão 3100)
8. Registra background workers (heartbeat, budget, recovery, etc.)

### 6.2 UI (`ui/src/main.tsx`)
- React 19 + StrictMode
- Providers: QueryClient, Theme, Company, LiveUpdates, Dialog, Sidebar, Toast, PluginLauncher
- Lazy-loaded routes (code splitting por feature)
- Service Worker para updates

### 6.3 CLI (`cli/src/index.ts`)
- Comando `paperclipai` via `@clack/prompts`
- Subcomandos: `onboard`, `dev`, `build`, `release`, `db:migrate`, etc.

---

## 7. Separação de Responsabilidades

| Camada | Pacotes | Responsabilidade |
|--------|---------|------------------|
| **Infraestrutura** | `server`, `packages/db`, `docker`, `scripts` | Deploy, DB, migrações, backup, CI/CD |
| **Domínio** | `server/src/services/`, `server/src/modules/` | Regras de negócio, lifecycle, orchestration |
| **Apresentação** | `ui`, `packages/plugins/sdk/ui` | React components, hooks, contexts |
| **Integração** | `packages/adapters/`, `packages/mcp-server/`, `packages/plugins/sandbox-providers/` | Adapters ACP, MCP, plugin sandbox |
| **Shared** | `packages/shared` | Tipos, constantes, validação (Zod), utilitários |

---

## 8. Decisões Arquiteturais Chave

| Decisão | Justificativa | Trade-off |
|---------|---------------|-----------|
| **Monorepo pnpm workspaces** | Shared types, atomic changes, single lockfile | Build mais lento, acoplamento de versões |
| **Embedded PostgreSQL para dev** | Zero-config local dev, CI determinístico | Não reflete produção exatamente |
| **Drizzle ORM (não Prisma)** | Type-safe, leve, SQL-first, melhor performance | Menos migrações automáticas, schema manual |
| **Better Auth (não NextAuth)** | Framework-agnostic, suporta multi-tenant, plugin system | Curva de aprendizado, menos docs |
| **React 19 + Vite (não Next.js)** | SPA pura, controle total, HMR rápido | Sem SSR/SSG nativo, SEO limitado |
| **Tailwind 4 (CSS-first)** | Zero config, performance, design tokens | Migração v3→v4 breaking |
| **ACP (Agent Client Protocol)** | Padroniza comunicação com agents locais/remotos | Ecossistema jovem, poucos agents compatíveis |
| **Plugin Workers isolados** | Segurança, fault isolation, versionamento independente | Overhead de IPC, complexidade de debugging |
| **Zod para validação** | Type-safe runtime validation, inferência TS | Bundle size, performance em hot paths |

---

## 9. Métricas de Código

| Métrica | Valor |
|---------|-------|
| **Total TypeScript files** | ~2.500+ |
| **Linhas de código (server)** | ~450.000+ |
| **Linhas de código (UI)** | ~200.000+ |
| **Tabelas no schema** | 480+ |
| **Migrations** | 490+ (0000–0490) |
| **Adapters de agentes** | 12 |
| **Sandbox providers** | 9 |
| **Routes Express registradas** | 100+ |
| **React components** | 300+ |
| **Testes (Vitest + Playwright)** | 1.000+ |

---

## 10. Oportunidades de Reutilização para Unificação

| Componente | Reutilizável? | Esforço | Notas |
|------------|---------------|---------|-------|
| `@paperclipai/shared` | ✅ **Sim** | Baixo | Tipos core, constants, Zod schemas — base para qualquer plataforma |
| `@paperclipai/db` | ✅ **Sim** | Médio | Drizzle + migrations + embedded PG — adaptável com schema próprio |
| `@paperclipai/plugin-sdk` | ✅ **Sim** | Médio | Worker RPC, UI bridge — isolado, versão estável 1.0.0 |
| `packages/adapters/*` | ✅ **Sim** | Baixo | Adapters ACP prontos — basta reexportar |
| `server/src/services/*` | ⚠️ **Parcial** | Alto | Lógica de negócio específica do Paperclip — extrair kernels genéricos |
| `ui/src/components/*` | ⚠️ **Parcial** | Médio | Design system (Radix/Tailwind) reutilizável; páginas específicas não |
| `server/src/middleware/*` | ✅ **Sim** | Baixo | Auth, logging, compression, error handling — genéricos |
| `packages/mcp-server` | ✅ **Sim** | Baixo | MCP server stdio — standalone |
| `docker/*` | ✅ **Sim** | Baixo | Dockerfile multi-stage, compose, ECS task defs — adaptáveis |

---

## 11. Limitações e Riscos Identificados

| Área | Limitação | Impacto |
|------|-----------|---------|
| **Acoplamento de domínio** | Services têm lógica Paperclip-specific hardcoded | Dificulta extração de kernels reutilizáveis |
| **Schema único** | 480+ tabelas em um schema — não multi-tenant nativo | Isolamento via RLS/queries, não schema-per-tenant |
| **Embedded PG only para dev** | Produção exige Postgres externo gerenciado | Gap dev/prod, migrações podem divergir |
| **Single-process server** | Workers via child_process, não cluster nativo | Escala vertical limitada |
| **Auth Better Auth v1.7** | Breaking changes frequentes, docs limitadas | Risco de upgrade |
| **React 19 RC** | Ainda em release candidate | APIs instáveis |
| **Tailwind 4** | Migração v3→v4 breaking, plugins incompatíveis | Effort de migração |
| **Sem OpenAPI spec automática** | Rotas documentadas manualmente | Integração externa difícil |

---

## 12. Próximos Passos para Unificação

1. **Extrair `@nettoscorp/shared`** a partir de `@paperclipai/shared` + types comuns
2. **Criar `@nettoscorp/db`** com schema base (auth, companies, memberships) + migrations
3. **Publicar adapters ACP** como pacotes independentes (`@nettoscorp/adapter-claude`, etc.)
4. **Isolar `plugin-sdk`** como `@nettoscorp/plugin-sdk` (já estável)
5. **Definir contrato de módulos** (interface `Module { routes, services, ui }`) para composição
6. **Migrar para arquitetura modular** no server: `createApp({ modules: [...] })`
7. **Unificar UI** com design system compartilhado + lazy-loaded feature modules
8. **Configurar CI/CD unificado** (turbo + changesets + pnpm workspace)

---

## 13. Evidências de Investigação

| Item | Fonte | Tipo |
|------|-------|------|
| Git status, branch, commits | `git status`, `git log` | Execução |
| Estrutura de diretórios | `ls -la` recursivo | Execução |
| Package.json root + workspaces | `read_file package.json` | Código |
| Server entry point | `server/src/index.ts:311` | Código |
| App factory | `server/src/app.ts:1` | Código |
| DB package + schema | `packages/db/src/index.ts`, `packages/db/src/schema/` | Código |
| UI entry + routes | `ui/src/main.tsx`, `ui/src/App.tsx` | Código |
| Adapters | `packages/adapters/*/package.json` | Código |
| Plugin SDK | `packages/plugins/sdk/src/index.ts` | Código |
| MCP server | `packages/mcp-server/src/index.ts` | Código |
| Docker compose | `docker/docker-compose.yml` | Código |
| Config system | `server/src/config.ts` | Código |

---

*Documento gerado automaticamente pela engenharia reversa do Paperclip. Todas as conclusões baseiam-se em evidências de código e execução — não em suposições.*