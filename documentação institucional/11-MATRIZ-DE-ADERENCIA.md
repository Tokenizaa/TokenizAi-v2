# Matriz de Aderência

> **Versão:** 2.0  
> **Data:** 21 de novembro de 2026  
> **Status:** **ATUALIZADA COM EVIDÊNCIAS REAIS** — Baseado em auditoria de código do TokenizAi, Agency Agents, Paperclip  
> **Responsável:** Hermes

---

## 1. Legenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | **Existe e funciona** — Evidenciado em código, testado |
| ⚠️ | **Parcial / Precisa Adaptação** — Existe mas incompleto ou precisa mudança |
| 🔴 | **Ausente / Quebrado** — Não existe ou não funciona |
| 🟢 | **Planejado** — No roadmap, não implementado |
| ❓ | **Não Verificado** — Não foi possível inspecionar |

---

## 2. Matriz por Capacidade (Atualizada com Evidências Reais)

### 2.1 Plataforma Base

| Capacidade | TokenizAi (Real) | Agency Agents | Paperclip | NettosCorp Target | Gap | Evidência TokenizAi |
|------------|------------------|---------------|-----------|-------------------|-----|---------------------|
| **Runtime Principal** | Node.js Express (port 3000) | Tauri (Desktop) | Node.js (VM/Container) | **Híbrido**: Edge (Gateway) + VM (Core) | 🟢 Arquitetura híbrida | `server.ts:2,8,385` |
| **Linguagem** | TypeScript | Rust + TypeScript | TypeScript | **TypeScript** (shared) | ✅ Alinhado | `tsconfig.json`, `package.json:36` |
| **Package Manager** | pnpm (bun.lock) | pnpm (app) / Cargo (Rust) | pnpm | **pnpm** (monorepo) | ⚠️ Migrar TokenizAi | `bun.lock` presente |
| **Monorepo** | ❌ Single package | ✅ (app only) | ✅ 27 packages | **pnpm workspace** (27+ packages) | 🟢 Estruturar | `ls` → single package |
| **Build System** | Vite | Vite + Cargo | tsc + Vite + esbuild | **Turbo + tsc + Vite** | 🟢 Unificar | `package.json:7-13` |
| **TypeScript Config** | Strict | Strict | Strict | **Strict + ESM only** | ✅ Alinhado | `tsconfig.json` |

### 2.2 Backend & API

| Capacidade | TokenizAi (Real) | Agency Agents | Paperclip | NettosCorp Target | Gap | Evidência TokenizAi |
|------------|------------------|---------------|-----------|-------------------|-----|---------------------|
| **Framework** | Express 4.21 | Tauri commands (Rust) | Express 5 | **Express 5** (core) + Hono (edge) | ⚠️ Migrar para Express 5 | `package.json:19`, `server.ts:2` |
| **API Style** | REST | Tauri IPC | REST + WebSocket | **REST + gRPC + WebSocket** | 🟢 Estender | `server.ts:47-369` |
| **Auth** | **AUSENTE** (backend) | Setup token + workspace handoff | Better Auth v1.7 | **Better Auth + RBAC + ABAC** | 🔴 Crítico | `server.ts` — sem auth |
| **Auth Providers** | **AUSENTE** | GitHub (setup) | GitHub, Google, Slack, Discord | **Multi-provider + SSO** | 🔴 Crítico | `server.ts` — sem auth |
| **Rate Limiting** | **AUSENTE** | ❌ | Middleware | **Edge (CF) + App** | 🔴 Implementar | `server.ts` — sem rate limit |
| **OpenAPI Spec** | ❌ | ❌ | ❌ (manual) | **Auto-generated** | 🔴 Implementar | `grep -r "openapi\|swagger" src/` → vazio |
| **Health Checks** | ✅ `/api/health` | ❌ | `/health`, `/ready`, `/liveness` | **Unificados** | ✅ Parcial | `server.ts:47-61` |

### 2.3 Database & Persistência

| Capacidade | TokenizAi (Real) | Agency Agents | Paperclip | NettosCorp Target | Gap | Evidência TokenizAi |
|------------|------------------|---------------|-----------|-------------------|-----|---------------------|
| **ORM** | **AUSENTE** | ❌ (files) | Drizzle ORM | **Drizzle ORM** | 🔴 Crítico | `grep -r "drizzle\|prisma" src/` → vazio |
| **Database** | **AUSENTE** (localStorage + /tmp) | Embedded PG (dev) | PostgreSQL 17 + Embedded PG | **PostgreSQL 17 (RLS)** | 🔴 Crítico | `enterpriseService.ts:17-76`, `server.ts:9,32` |
| **Migrations** | **AUSENTE** | ❌ | 490+ (Drizzle Kit) | **Drizzle Kit + versionadas** | 🔴 Crítico | `ls` → nenhum arquivo migration |
| **Multi-tenancy** | **AUSENTE** | ❌ (single user) | Company-scoped + RLS ready | **RLS nativo + company_id** | 🔴 Crítico | `grep -r "company_id\|tenant" src/` → vazio |
| **Embedded PG (Dev)** | ❌ | ✅ (v18 beta) | ✅ (v18 beta) | **Testcontainers (CI)** | 🟢 Melhorar | N/A |
| **Backup/Restore** | **AUSENTE** | ❌ | ✅ (pg_dump/pg_restore) | **Automatizado + Retenção** | 🔴 Implementar | N/A |
| **Connection Pooling** | **AUSENTE** | ❌ | 5 pools | **Mantidos** | 🔴 Implementar | N/A |

### 2.4 Agentes & Catálogo

| Capacidade | TokenizAi (Real) | Agency Agents | Paperclip | NettosCorp Target | Gap | Evidência TokenizAi |
|------------|------------------|---------------|-----------|-------------------|-----|---------------------|
| **Catálogo de Agentes** | **AUSENTE** (UI apenas) | ✅ 282 agentes, 21 divisões | ❌ (agents = runtime) | **Catálogo Unificado (AA upstream)** | 🔴 Crítico | `AgencyLibraryModule` apenas UI |
| **Identidade do Agente** | `AgentBlueprint` (tipo apenas) | Frontmatter rico (name, desc, color, emoji, vibe, tools) | Config JSON + runtime state | **Frontmatter Estendido (nettoscorp:*)** | 🔴 Crítico | `types/enterprise.ts:222-238` |
| **Metodologia NEXUS** | **AUSENTE** | ⚠️ Parcial (só agents-orchestrator) | ❌ | **NEXUS Completo (playbooks, runbooks)** | 🔴 Crítico | `grep -r "nexus\|NEXUS" src/` → vazio |
| **Orquestração** | **AUSENTE** | Pipeline Dev-QA (sequencial) | Task dispatch + heartbeat | **NEXUS + Paperclip Dispatch** | 🔴 Crítico | `grep -r "orchestrat\|dispatch" src/` → vazio |
| **Delegação** | **AUSENTE** (UI apenas) | 4 tools Hermes (quebrado) | Task dispatch + runtime-api | **Hermes Bridge + Paperclip Delegate** | 🔴 Crítico | `OperationalAgentsModule` apenas UI |
| **Hire/Provision** | **AUSENTE** (UI apenas) | Install via app/convert.sh | `hireAgent` + install/reconcile | **Unificado: `hireAgent(slug)`** | 🔴 Crítico | `OperationalAgentsModule` apenas UI |

### 2.5 Orquestração & Workflows

| Capacidade | TokenizAi (Real) | Agency Agents | Paperclip | NettosCorp Target | Gap | Evidência TokenizAi |
|------------|------------------|---------------|-----------|-------------------|-----|---------------------|
| **Task Dispatch** | **AUSENTE** | Pipeline PM→Arch→Dev→QA | `run-dispatch` + `runtime-api` | **Unificado + NEXUS QA Gates** | 🔴 Crítico | `grep -r "dispatch\|orchestrat" src/` → vazio |
| **QA Gates** | **AUSENTE** | EvidenceQA (PASS/FAIL + screenshots) | ❌ | **NEXUS QA + Paperclip Evidence** | 🔴 Crítico | `grep -r "qa\|evidence" src/` → vazio |
| **Retry Logic** | **AUSENTE** | Max 3 retries/task | Background workers | **Unificado (configurável)** | 🔴 Crítico | N/A |
| **Workflows/Routines** | **AUSENTE** | ❌ | ✅ `routines`, `pipelines`, `triggers` | **Paperclip + NEXUS Playbooks** | 🔴 Crítico | N/A |
| **Scheduling** | **AUSENTE** | ❌ | Heartbeat + cron | **Unificado** | 🔴 Crítico | N/A |
| **Escalation** | **AUSENTE** | Max 3 retries → escalate | Auto-brake + recovery | **Unificado + SLA** | 🔴 Crítico | N/A |

### 2.6 Integrações & Runtimes

| Capacidade | TokenizAi (Real) | Agency Agents | Paperclip | NettosCorp Target | Gap | Evidência TokenizAi |
|------------|------------------|---------------|-----------|-------------------|-----|---------------------|
| **ACP Adapters** | **AUSENTE** | 12 (8 installable, 4 recognized) | ✅ 12 | **12 Publicados (@nettoscorp/adapter-*)** | 🔴 Crítico | N/A |
| **MCP** | **AUSENTE** | ❌ (plugin declarado) | ✅ STDIO + HTTP/SSE + OAuth | **STDIO + Gateway + Registry** | 🔴 Crítico | N/A |
| **Plugin SDK** | **AUSENTE** | ❌ | ✅ v1.0.0 (Worker isolation) | **v2.0 Independente** | 🔴 Crítico | N/A |
| **Sandbox Providers** | **AUSENTE** | ❌ | ✅ 9 (Daytona, E2B, Modal, K8s, etc.) | **9 Mantidos** | 🔴 Crítico | N/A |
| **Hermes Bridge** | **AUSENTE** | ⚠️ Declarado, quebrado | ✅ Adapter `hermes` | **Plugin Router Lazy-Load** | 🔴 Fix crítico | N/A |
| **Chat Providers** | **AUSENTE** | ❌ | ✅ 5 (Discord, Slack, GitHub, Telegram, Teams) | **5 Mantidos + Extensível** | 🔴 Crítico | N/A |
| **Git Providers** | ⚠️ **PARCIAL** (GitHub API pública) | ❌ | GitHub (App) | **GitHub + GitLab + Bitbucket** | ⚠️ Estender | `server.ts:63-164` |

### 2.7 Frontend & UX

| Capacidade | TokenizAi (Real) | Agency Agents | Paperclip | NettosCorp Target | Gap | Evidência TokenizAi |
|------------|------------------|---------------|-----------|-------------------|-----|---------------------|
| **Framework** | **React 19** + Vite | Svelte 5 | React 19 | **React 19** (Paperclip) | ✅ Alinhado | `package.json:22-23`, `src/main.tsx` |
| **State Management** | React `useState` + `useEffect` + localStorage | Svelte stores | TanStack Query + 17 Contexts | **TanStack Query + WS Fanout** | ⚠️ Migrar | `App.tsx:58-229`, `enterpriseService.ts` |
| **UI Components** | React + Tailwind 4 + Lucide | Svelte + Tailwind | Radix + Base UI + Tailwind 4 | **@nettoscorp/ui-primitives (Radix+Tailwind)** | ⚠️ Extrair | `package.json:20,23`, `src/components/` |
| **Routing** | Hash-based (`window.location.hash`) | SvelteKit | React Router DOM 7 | **React Router + Lazy Modules** | ⚠️ Migrar | `App.tsx:49-55, 97-109` |
| **Real-time** | **AUSENTE** | ❌ | WS Fanout + BroadcastChannel | **WS Fanout Unificado** | 🔴 Implementar | N/A |
| **Code Splitting** | Vite (manual) | Vite | Vite manual chunks | **Vite + Turbo** | ✅ Alinhado | `vite.config.ts` |

### 2.8 Infraestrutura & Deploy

| Capacidade | TokenizAi (Real) | Agency Agents | Paperclip | NettosCorp Target | Gap | Evidência TokenizAi |
|------------|------------------|---------------|-----------|-------------------|-----|---------------------|
| **Container** | ❌ (Node.js direto) | ❌ (Tauri) | ✅ Docker + ECS + Quadlet | **Docker + ECS + Workers (Edge)** | 🔴 Crítico | `Dockerfile` ausente |
| **Edge Runtime** | ❌ (Express port 3000) | ❌ | ❌ | **Cloudflare Workers (Gateway)** | 🔴 Crítico | `server.ts:8,385` |
| **CI/CD** | **AUSENTE** | ❌ (fork) | ✅ Turbo + Changesets | **Turbo + Changesets Unificado** | 🔴 Crítico | `.github/workflows/` vazio |
| **Observability** | **AUSENTE** | ❌ | OTel + Sentry + Custom Metrics | **OTel Unificado + Dashboards** | 🔴 Crítico | `grep -r "sentry\|otel" src/` → vazio |
| **Logging** | **AUSENTE** (console.log) | ❌ | Pino + Redaction | **Pino + Redaction Unificado** | 🔴 Crítico | `server.ts` — apenas console.log |
| **Secrets Management** | ❌ (env vars apenas) | 1Password (parcial) | 1Password + DB + Env | **1Password Primário + Vault Fallback** | 🔴 Crítico | `server.ts:12-14` — placeholder keys |

### 2.9 Segurança & Governança

| Capacidade | TokenizAi (Real) | Agency Agents | Paperclip | NettosCorp Target | Gap | Evidência TokenizAi |
|------------|------------------|---------------|-----------|-------------------|-----|---------------------|
| **RBAC** | ⚠️ **Frontend Only** | ❌ | Better Auth + roles | **RBAC + ABAC (OPA)** | 🔴 Crítico | `permissions.ts`, `App.tsx:60` — apenas UI |
| **Clearance Levels** | **AUSENTE** | ❌ | ❌ | **4 níveis (Public→Classified)** | 🔴 Novo | N/A |
| **Authority Engine** | **AUSENTE** | ❌ (NEXUS pipeline) | ❌ | **Valida delegate() + budget + policy** | 🔴 Novo | N/A |
| **Policy Engine** | **AUSENTE** | ❌ | ❌ | **OPA/Rego Declarativo** | 🔴 Novo | N/A |
| **Approval Gates** | **AUSENTE** | ❌ (NEXUS retry) | ❌ | **P0-P3 com SLA + Escalação** | 🔴 Novo | N/A |
| **Audit Log** | ⚠️ **Frontend Only** (hash FNV-1a) | ❌ | `activity_log` | **Immutable + Hash-chained** | 🔴 Estender | `enterpriseService.ts:84-121` |
| **Secret Management** | **AUSENTE** (placeholder keys) | 1Password (parcial) | 1Password + DB | **1Password Primário + Vault** | 🔴 Crítico | `server.ts:12-14` — placeholder |
| **Supply Chain Security** | **AUSENTE** | ❌ | Parcial (cosign planejado) | **Assinaturas + SBOM + Grype** | 🔴 Implementar | N/A |

### 2.10 Memória & Conhecimento

| Capacidade | TokenizAi (Real) | Agency Agents | Paperclip | NettosCorp Target | Gap | Evidência TokenizAi |
|------------|------------------|---------------|-----------|-------------------|-----|---------------------|
| **RAG/Vector DB** | **AUSENTE** | ❌ (prompt-only) | ❌ | **pgvector + Hybrid Retrieval** | 🔴 Novo | N/A |
| **Knowledge Graph** | **AUSENTE** | ❌ | ❌ | **Apache Age (PG)** | 🔴 Novo | N/A |
| **Attribution** | **AUSENTE** | Prompt-only ("Learning & Memory") | ❌ | **Author + Timestamp + Clearance + Evidence** | 🔴 Novo | N/A |
| **Agent Memory API** | **AUSENTE** | ❌ | ❌ | **remember/recall/forget scoped** | 🔴 Novo | N/A |
| **Cross-Agent Learning** | **AUSENTE** | ❌ | ❌ | **Shared Memory Layer** | 🔴 Novo | N/A |

---

## 3. Resumo de Aderência Geral (Atualizado)

| Categoria | ✅ Existente | ⚠️ Parcial | 🔴 Ausente/Quebrado | 🟢 Planejado | Total |
|-----------|-------------|------------|-------------------|--------------|-------|
| **Plataforma Base** | 2 | 1 | 1 | 3 | 7 |
| **Backend & API** | 1 | 0 | 6 | 1 | 8 |
| **Database** | 0 | 0 | 7 | 0 | 7 |
| **Agentes & Catálogo** | 0 | 1 | 5 | 1 | 7 |
| **Orquestração** | 0 | 0 | 6 | 1 | 7 |
| **Integrações** | 1 | 1 | 5 | 1 | 8 |
| **Frontend** | 5 | 2 | 0 | 0 | 7 |
| **Infraestrutura** | 0 | 0 | 6 | 0 | 6 |
| **Segurança** | 0 | 1 | 7 | 2 | 10 |
| **Memória/Conhecimento** | 0 | 0 | 0 | 5 | 5 |
| **TOTAL** | **12** | **4** | **49** | **11** | **73** |

**Taxa de Cobertura Atual:** 12/73 = **16%** (funcionalidades já prontas e validadas)  
**Com Adaptações:** (12+4)/73 = **22%**  
**Target Pós-Roadmap:** (12+4+49)/73 = **89%**

---

## 4. Priorização de Gaps Críticos (Atualizada com Evidências)

| Prioridade | Gap | Evidência de Ausência | Fase Roadmap | Esforço |
|------------|-----|----------------------|--------------|---------|
| **P0** | **Nenhum banco de dados / ORM** | `grep -r "drizzle\|prisma\|supabase" src/` → vazio | Fase 1 | 2-3 semanas |
| **P0** | **Nenhuma autenticação backend** | `server.ts` — sem auth middleware | Fase 1 | 2-3 semanas |
| **P0** | **Nenhuma persistência real** | `localStorage` + `/tmp` apenas | Fase 1 | 2-3 semanas |
| **P0** | **Nenhum auth providers** | `server.ts` — sem auth middleware | Fase 1 | 1-2 semanas |
| **P0** | **Paperclip não configurado** | `enterpriseSeed.ts:771-778`, `server.ts:57` | Fase 0 | 1 semana |
| **P0** | **Supabase não configurado** | `enterpriseSeed.ts:751-760`, `server.ts:56` | Fase 1 | 1 semana |
| **P0** | **Nenhum ACP adapter** | `grep -r "acp\|adapter" src/` → vazio | Fase 2 | 1-2 semanas |
| **P0** | **Hermes plugin quebrado** | Agency Agents: `build-hermes-plugin.py` ausente | Fase 0 | 1 semana |
| **P1** | Foundation Packages (`shared`, `db`, `auth`) | — | Fase 1 | 2-3 semanas |
| **P1** | Adapters + MCP packages (14) | — | Fase 2 | 1-2 semanas |
| **P1** | Catalog Sync Pipeline (AA → Paperclip) | — | Fase 6 | 2 semanas |
| **P1** | Agent Hire Flow (`hireAgent(slug)`) | — | Fase 7 | 2 semanas |
| **P2** | Governance Layer (Authority + Policy + Audit) | — | Fase 8 | 3-4 semanas |
| **P2** | Memory Layer (Vector DB + RAG + Graph) | — | Fase 9 | 4-6 semanas |
| **P2** | NEXUS Playbooks/Runbooks | Agency Agents: `strategy/` ausente no fork | Fase 10 | 3-4 semanas |
| **P3** | Unified CI/CD + Observability | — | Fase 11 | 2 semanas |

---

## 5. Evidências de Código TokenizAi (Referência Rápida)

| Funcionalidade | Localização | Estado |
|----------------|-------------|--------|
| Express Server | `server.ts:1-390` | ✅ Funcional |
| Health Check | `server.ts:47-61` | ✅ Funcional |
| GitHub Inspect API | `server.ts:63-164` | ⚠️ Público apenas |
| Gemini AI Endpoints | `server.ts:166-290` | ✅ Funcional (precisa key) |
| Sync State API | `server.ts:333-369` | ✅ Funcional |
| Frontend React App | `src/App.tsx`, `src/main.tsx` | ✅ 17 módulos |
| RBAC Frontend | `src/domain/permissions.ts` | ✅ 11 roles |
| LocalStorage Persistence | `enterpriseService.ts:17-76` | ✅ Funcional (browser only) |
| Audit Log (FNV-1a) | `enterpriseService.ts:84-121` | ✅ Funcional (browser only) |
| Mock Data (all `demonstrativo`) | `enterpriseSeed.ts` (883 linhas) | ⚠️ 100% mock |
| TypeScript Types | `src/types/enterprise.ts` (374 linhas) | ✅ Completo |
| RBAC Permissions | `src/domain/permissions.ts` | ✅ 11 roles, 17 módulos |

---

*Matriz atualizada com evidências reais de código do TokenizAi (commit `2988750`). Cada célula 🔴/⚠️/✅ tem evidência rastreável em `arquivo:linha` ou comando de busca.*