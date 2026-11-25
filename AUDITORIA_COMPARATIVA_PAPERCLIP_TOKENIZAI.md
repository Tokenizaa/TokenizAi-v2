# AUDITORIA COMPARATIVA — Paperclip vs TokenizAi V2

## 1. CONTEXTUALIZAÇÃO

Este documento apresenta diagnóstico comparativo entre o Paperclip (referência de engenharia reversa) e o TokenizAi V2 (plataforma corrente), fundamentado unicamente em evidências de código e inspeção estática realizadas nas branches `main` de ambos os repositórios.

**Paperclip** — Plataforma de orquestração de agentes de IA (monorepo Node.js/pnpm, referência `cb64a236b` v0.3.1).  
**TokenizAi V2** — Plataforma de gestão empresarial com runtime Hermes (commit `b4c58b2f30f9cc68214da0e1d680c6757b0f0a43`, `main` = `origin/main`).

> **Status da migração:** Concluída nos commits `e4da7c1`, `140026d`, `aea0a25` e `9667f62`. Zero dependências operacionais do Paperclip permanecem no código da TokenizAi V2.

---

## 2. ARQUITETURA E INFRAESTRUTURA

| Camada | Paperclip | TokenizAi V2 | Evidência |
|---|---|---|---|
| **Runtime** | Node.js monorepo com pnpm workspaces; CLI `paperclipai`; embedded postgres; 27 packages; 480+ tabelas | Node.js + Express + Vite + React + Hermes CLI; 21 tabelas; `npm run dev` → `tsx server.ts`; porta 3000 | `package.json` sem `@paperclipai/*`; `git ls-files | grep -i paperclip` → apenas docs históricas |
| **Banco de Dados** | 480+ tabelas via Drizzle ORM; embedded postgres dev; 490+ migrations; `packages/db/` | 21 tabelas; único migration `001_initial_schema.sql`; `uuid-ossp` extension; RLS `using (true)` em todas | `supabase/migrations/001_initial_schema.sql` (525 linhas); audit read-only confirmou contagem |
| **Autenticação** | Better Auth + extensões; chaves de serviço; OAuth flows | Supabase JWT + `app_metadata.platform_role`; HMAC workspace tokens (`TOKENIZAI_SESSION_SECRET`); founder e-mail fixo | `server/supabase.ts:63-82`; `server.ts:288` compara `email === 'nettoscorp@gmail.com'` |
| **APIs** | ACP (Agent Client Protocol) v1.9.0; MCP (Model Context Protocol) v1.0; 12 adapters prontos | `/api/hermes/*` (30 rotas montadas em `server.ts:913`); `/api/enterprise/*` (23 rotas); Sem `/api/paperclip/*` | `server/integrations/hermes/router.ts:117-804`; `server.ts:155-913` |
| **Plugin System** | Plugin SDK v1.0.0; Worker isolation; 9 sandbox providers | Integração via execução CLI (`/home/lg/.local/bin/hermes`); `exec()` sem HTTP auth; `getStatus()` hardcode `configured: true` | `server/integrations/hermes/index.ts:29; domainCache.ts:3`; `HermesGateway.getStatus()` `index.ts:19` |
| **Frontend** | React 19 + Vite; painel de controle completo; 7 docs de engenharia reversa | React 19 + Vite; 17+ rotas IA + 16 rotas empresariais; catálogo estático 12→283 agents | `src/App.tsx` roteador; `src/modules/ai-workforce/services/hermes.ts`; `metadata.json` descrição |
| **Persistência** | Dados em `~/.paperclip/; embedded-postgres; file storage; worktrees; logs; backups` | `enterpriseState` módulo-level + `data/enterprise-state.json` (gitignorado, 33748 bytes); mirror fire-and-forget para Supabase; RPC `claim_initial_platform_admin` referenciado mas ausente | `server/persistence.ts:5-23`; `server.ts:53-60,110-113,141-146`; `001_initial_schema.sql:449-517` |

---

## 3. MODELOS DE DOMÍNIO

### 3.1 Organizações e Empresas

| Paperclip | TokenizAi V2 |
|---|---|
| Empresas com `company_id`; `departamentos` com self-FK; `agentes_empresariais` vinculados a departamentos; `Cargo`; `Líder/Subordinado`; histórico de alterações | `departamentos` table (chave estrangeira para sí mesmo); `perfis_empresariais` com `role` CHECK (Diretoria Executiva, Gestor Operacional, Comercial & CRM, Financeiro, Auditor); `enterpriseState` módulo-level; nenhuma política de org_id ou multi-tenant; `cliente_id → clientes → projetos` — relacionamento hierárquico limitado |
| `company_memberships`; `organization` table; `team` table; `role` com hierarquia; `permissions` por recurso | `enterpriseState` sem campo `org_id` ou `tenant_id`; todas as 21 políticas RLS `to authenticated using (true)` — qualquer authenticated lê todas as rows; `supabaseRepo.useSupabase` depende de `SUPABASE_SERVICE_ROLE_KEY` estar configurado (não o está no repo) |
| **Diferença:** Paperclip tem modelo de organização estruturado com equipes, líderes, subordinados, memberships. TokenizAi V2 tem `departamentos` como tabela de catálogo, sem relacionamento de reporte, sem políticas de tenant, enterpriseState global sem filtro de organização. |

### 3.2 Agentes

| Paperclip | TokenizAi V2 |
|---|---|
| 27 packages; `packages/adapters/*` (12 adapters: Claude, Codex, Cursor, Gemini, Copilot, Qwen, etc.); `skills` instanciáveis; `agent_lifecycle` (hire, onboard, configure, pause, resume, terminate); `agent_runtime_state`; `run_identity_contexts`; skills com `manifest JSONB`; `source_ref`; `progress` em 5 estados (CURRENT/OUTDATED/MODIFIED/REMOVED/FOREIGN); `reconcile engine` ledger + hash-match | `agentes_empresariais` table (21-table migration); `capabilities text[] default '{}'`; Hermes correlation ids; `backend` não persiste agentes — `runs` e `activities` são JSON-only; `HermesBotDto` retorna `id/name/description/status` via `parseProfileList` (apenas 6 fields); `ui` apresenta 283 agents baseados em catálogo estático de 12 entries (`AGENCY_SPECIALISTS`); ` parseProfileList` retorna apenas `id/name/description/status`; `skills` no frontend declarados em `TYPES:479-497` mas backend retorna apenas `id/name/description/status` |
| | **Diferença:** Paperclip tem modelo de agente com lifecycle completo, skills configuráveis, estado de runtime persiste, reconcile engine. TokenizAi V2 tem agente empresarial básico (perfil com nome/slug/status), runtime Hermes executa comandos CLI mas não persiste estado de agente; 12 specialists hardcoded apresentados como 283; skills não conectadas ao banco. |

### 3.3 Skills e Catálogo

| Paperclip | TokenizAi V2 |
|---|---|
| `skill-package-store`; CRUD skills; versionamento; dependências; install/reconcile; `Reconcile Engine` ledger + 5-state; `@paperclipai/plugin-sdk`; `@paperclipai/shared`; `@paperclipai/db` | `Hermes skills` via `GET /api/hermes/skills`; retorna `id/name/description/status` (HPARSERS:44-69); frontend consome `key/slug/version/folderPath/source` que o backend não retorna; dois `HermesSkillDto`: local minimal (API:577-584) e rico (TYPES:479-497); facade tipa como rico embora chamada retorne minimal; `AGENCY_SPECIALISTS` (12 entries) apresentados como 283 no `AgencyLibraryView`; `convert.sh` renderers para Paperclip runner, Hermes, CLI; Nenhum skill catalog service funcional |
| | **Diferença:** Paperclip tem catálogo de skills instaláveis com versionamento e reconcile engine. TokenizAi V2 tem parser achatado skills (apenas id/name/description/status); UI consome fields que não vêm do backend; catálogo é estático/mock (12 entries → 283); skills não conectados a persistência. |

### 3.4 Tarefas e Execuções

| Paperclip | TokenizAi V2 |
|---|---|
| `tasks` com `parent_id` self-FK; hierarquia via `parentId`; `executions` com `run_identity_contexts`; `heartbeat`; `recovery` engine; `5 states` (CURRENT/OUTDATED/MODIFIED/REMOVED/FOREIGN); `dispatch_task` → queue → runtime; `runtime-api` | `tasks` via `GET/POST/PATCH /api/hermes/tasks` (HROUTER:501-583); `DTO HermesTaskDto` com `id/title/status` apenas; `parser` retorna `id/title/status` — prioridade/agente/projeto são placeholder; `TasksPage` drawer nunca populado; `taskInitialId` perdido ao trocar de rota; `runs` via `GET /api/hermes/runs` (HROUTER:230+); `parseCronList` sempre `[]` → rotinas sempre vazias; `HermesRunDto`; execuções mostram loading/erro/empty mas cancelamento é `no-op` explícito com aviso |
| | **Diferença:** Paperclip tem hierarquia de tarefas com `parentId`, `5 states` de lifecycle, reconcile engine, heartbeats. TokenizAi V2 tem tasks planas (sem subtarefas reais), parsers achatados, cancelamento sem efeito, histórico vazio. |

### 3.5 Aprovações e Governança

| Paperclip | TokenizAi V2 |
|---|---|
| `approve/reject/revision` handlers; `QA Gate` NEXUS → Paperclip Evidence; `approval` system; `NEXUS + Paperclip Dispatch`; `authority engine` RBAC + approval system; `policy engine` budgets | `HermesApprovalsPanel` no AiOpsView tem integração completa com `hermesService.approveApproval/rejectApproval/requestApprovalRevision`; páginas standalone (`ApprovalsPage`, `ApprovalDetailPage`) exibem `EmptyState` "gestão de aprovações não integrada"; `backend` tem `/approvals` (HROUTER:637-675) mas frontend desativou; `LIM-006` da documentação original recomendava unificar → ApprovalsPage standalone → HermesApprovalsPanel via AiOpsView (já feito); texto declara ações desativadas para não simular governança |
| | **Diferença:** Paperclip tem sistema de aprovações com QA Gate e NEXUS evidence. TokenizAi V2 tem integração de aprovações desativadas na UI; backend tem capability mas frontend removed; governança apresentada apenas como placeholder "—". |

### 3.6 Rotinas e Automações

| Paperclip | TokenizAi V2 |
|---|---|
| `routines` com `pipelines`, `triggers`, `SLA`, `escalation`; `NEXUS Playbooks`; `reusable workflows`; `heartbeat` | `routines` via `GET/POST /api/hermes/routines` (HROUTER:588-635); `parseCronList` stub sempre `[]` → tela sempre vazia; `handleCreateRoutine` engole falha do trigger com `.catch(() => {})` e ainda emite "Rotina criada no Hermes."; `handleCreateRoutine` create sem criar trigger; `GET /routines/:id/run`, `POST /routines/:id/run`, `POST/PATCH /routines/:id/triggers` — endpoints chamados pelo frontend **não existem** no backend; rotinas sempre vazias na prática |
| | **Diferença:** Paperclip tem rotinas com pipelines, triggers, SLA, escalation. TokenizAi V2 tem rotinas que aparentam existir mas parser retorna `[]` sempre; criação reporta sucesso mesmo com falha silenciosa; gatilhos e execução não têm handler backend. |

### 3.7 Orçamentos e Custos

| Paperclip | TokenizAi V2 |
|---|---|
| Orçamentos; custos por agente; limites operacionais; `task_execution_time` histograma; `context_window_usage` gauge | `costs/summary` via `GET /api/hermes/costs/summary` (HROUTER:679-716); `budgetMonthlyCents: null` sempre; `dataQuality` nenhum; `Coluna "Teto Mensal"` na UI copia `row.costCents` (dado enganoso, não orçamento); `Promise.allSettled` de `getCostsSummary`, `listActivity(50)`, `listAgentActionsAudit(50)`; `allSettled` silencia falhas; empty de atividade/auditoria (`614-618, 639-643`) |
| | **Diferença:** Paperclip tem orçamentos e limites operacionais. TokenizAi V2 tem display de custos que apresenta dado enganoso (teto = gasto), campos ausentes no DTO, falhas silentadas por `allSettled`. |

---

## 4. INTEgração HERMES

| Aspecto | Paperclip | TokenizAi V2 |
|---|---|---|
| **Runtime** | Plataforma completa; gRPC/Message Queue (runtime-api); Agents ↔ Orchestrator < 10ms; PostgreSQL (tasks, delegations) | Express + Hermes CLI; CLI path hardcoded `/home/lg/.local/bin/hermes`; `getStatus()` hardcode `configured: true` independente de CLI; status verificado uma vez no startup via `execSync('<cli> --version')` sem timeout |
| **Transport** | gRPC/Message Queue; STDIO + HTTP/SSE (MCP); ACP stdio | CLI Shell execution; Nenhum auth header enviado ao Hermes; CLI herda ambiente do processo servidor |
| **Endpoints** | APIs completas; `hiring`, `delegation`, `runtime-api` | 30 rotas `/api/hermes/*` montadas; `GET /api/hermes/overview`, `/api/hermes/status`, `/api/hermes/agents`, `/api/hermes/tasks`, `/api/hermes/runs` funcionam; mas 15+ endpoints chamados pelo frontend **não têm handler** no servidor (lifecycle agentes, `runtime-state`, `GET /chats/:agentRef`, `routines/:id/run/trigger`, `activity/agent-actions`) |
| **Capacidades** | `agents:read`, `agents:manage`, `chats:write`, `runs:cancel`, `connectors:read/manage`, `approvals:decide` | Capabilities definidas no `HermesCapability` mas muitas não têm endpoint correspondente; `HermesCapability` anuncia rotas não registradas; `parseCronList` sempre `[]`; `parseKanbanJson` retorna `[]` on failure |
| **Injeção de Tokens** | Tokens persistidos; re-hydration possível | `TOKENIZAI_SESSION_SECRET` lido no topo do módulo (falha `npm run dev` puro); admin tokens armazenados em `adminBearerTokenMemory` mas **nunca enviados** nas requisições (`request()` usa apenas JWT Supabase) — **corrigido em ETAPA 8** |
| | **Diferença:** Paperclip tem runtime completo com API, transportes múltiplos, capacidades definidas. TokenizAi V2 tem runtime CLI-based com gaps de contrato significativos — 15+ endpoints frontend sem handler backend, parsers achatados, dados simulados. |

---

## 5. SEGURANÇA E RBAC

| Paperclip | TokenizAi V2 |
|---|---|
| `Better Auth` + extensões; `company_memberships`; `role` com hierarquia; `authority engine` RBAC + NEXUS delegation; `policy engine` budgets; `audit_log` + extensões | `21 políticas RLS` todas `to authenticated using (true)` — qualquer authenticated lê todas as rows; Sem políticas INSERT/UPDATE/DELETE; `supabaseServiceRoleKey` contorna RLS completamente; `isPlatformAdmin` lê `app_metadata.platform_role`; `hasPermission('read')` cai em `default: false` para não-admin; `requirePermission('read')` protege `GET /api/enterprise/state`; founder e-mail fixo `nettoscorp@gmail.com` em `server.ts:288`; `TOKENIZAI_SESSION_SECRET` crash no init; admin tokens never sent (corrigido: agora `request()` prioriza adminBearerTokenMemory); Sem CORS, helmet, rate-limiter |
| | **Diferença:** Paperclip tem RBAC estruturado com authority engine, policy engine, audit log. TokenizAi V2 tem RBAC fraca — qualquer authenticated lê tudo, sem tenant isolation, sem políticas INSERT/UPDATE/DELETE, dependente de service-role key que não está configurada no repo. |

---

## 6. FRONTEND E UX

| Paperclip | TokenizAi V2 |
|---|---|
| Painel de controle completo; dashboards; páginas de detalhes por agente/equipe/tarefa; navegação estruturada; toasts visuais; drawers com focus-trap; acessibilidade considerada | 17+ rotas IA + 16 rotas empresariais; toasts quebrados (`console.log('[toast]', msg)` nunca renderizado); drawers never populated (tasks, agents); navegação perde estado (`taskInitialId`, `chatInitialRef`); `<tr onClick>` sem teclado; ícones sem `aria-label`; `SlideDrawer` sem focus-trap explícito; grids responsivos `grid-cols-1 md:/lg:/xl`; `SegmentedTabs` com `role="tablist"`/`aria-selected`; `SlideDrawer` com `role="dialog"`/`aria-modal`/close por `Escape` |
| | **Diferença:** Paperclip tem UX de painel completo. TokenizAi V2 tem interface funcional mas com UX quebrada: toasts invisíveis, drawers vazios, navegação que perde estado, acessibilidade parcial. |

---

## 7. CONCLUSÃO COMPARATIVA

| Categoria | Paperclip | TokenizAi V2 | Gap |
|---|---|---|---|
| **Arquitetura de orquestração** | Completa (gRPC/MQ, runtime-api, reconcile engine) | CLI-based; gaps de contrato | ⬜ Grande |
| **Modelo de organizações/equipes** | Estruturado (company, departments, leaders, teams, hierarchies) | Básico (departamentos como catálogo, sem reporte, sem tenant) | ⬜ Grande |
| **Modelo de agentes e skills** | Completo (lifecycle, skills instaláveis, reconcile engine, 5 states) | Plano (agentes empresariais básicos; skills achatadas; catálogo estático 12→283) | ⬜ Grande |
| **Tarefas e execuções** | Hierárquicas (parentId), 5 states, heartbeats, reconcile | Planas (sem subtarefas), parsers achatados, cancelamento sem efeito | ⬜ Grande |
| **Aprovações e governança** | QA Gate, NEXUS evidence, authority engine | Desativadas na UI; backend capability exists mas frontend removed | ⬜ Médio |
| **Rotinas e automações** | Completo (pipelines, triggers, SLA, escalation) | Parser `[]` sempre; criação com sucesso-falso; gatilhos sem handler | ⬜ Grande |
| **Orçamentos e custos** | Orçamentos, limites, histograma | Display enganoso (teto = gasto); campos ausentes; falhas silenciadas | ⬜ Médio |
| **Autenticação e RBAC** | Better Auth + authority engine + policy engine + audit log | RLS `using (true)` amplo; sem tenant; sem políticas CRUD; admin tokens nunca enviados (corrigido); founder e-mail fixo | ⬜ Grande |
| **Frontend/UX** | Painel completo, toasts visuais, drawers funcionais, acessibilidade | Toasts invisíveis; drawers vazios; navegação perde estado; A11y parcial | ⬜ Grande |
| **Integração externa** | 12 adapters, MCP, sandboxes, chat providers (5) | CLI exclusivo do dev-machine; sem CORS/helmet/rate-limit; `HERMES_URL`/`HERMES_TOKEN` inexistentes | ⬜ Grande |
| **Persistência** | `~/.paperclip/; embedded-postgres; file storage; worktrees; logs; backups` + reconcile engine | `enterpriseState` memória + JSON gitignorado; mirror fire-and-forget; RPC admin ausente | ⬜ Grande |

**Resumo executivo:** A migração Paperclip → Hermes na TokenizAi V2 removeu **zero dependências operacionais** do código (já confirmado), mas a arquitetura funcional foi **revertida em vários aspectos críticos**: o modelo de organizações/equipes foi simplificado para `departamentos` isolados sem reporte ou tenant; o modelo de agentes foi simplificado para perfis empresariais básicos sem lifecycle, skills ou reconcile; as tarefas perderam hierarquia e estado; as aprovações foram desativadas; os custos apresentam dado enganoso; o frontend tem quebras UX significativas. O que resta é uma aplicação que roda e exibe interface TokenizAi V2, mas com capacidades de gestão e execução de agentes considerablemente reduzidas em comparação ao Paperclip.

> **Nota:** As correções aplicadas em ETAPA 8 (S3: admin tokens now sent; S9: senha hardcoded removida) melhoram a segurança mas não resolvem os gaps arquiteturais descritos acima.

---
<tool_call>
<function=todowrite>
<parameter=todos>
[{"content": "ETAPA 1-7 - Concluídas: auditoria completa, correções aplicadas, homologação", "status": "completed"}, {"content": "ETAPA 8 - Correções: api.ts (S3) + audit-visual.spec.ts (S9)", "status": "completed"}, {"content": "ETAPA 9 - Artefato 1: AUDITORIA_COMPARATIVA_PAPERCLIP_TOKENIZAI.md - CONCLUÍDO", "status": "completed"}, {"content": "ETAPA 9 - Artefato 2: MATRIZ_EQUIVALENCIA_FUNCIONAL.md", "status": "in_progress"}, {"content": "ETAPA 9 - Artefato 3: CONCILIACAO_271_AGENTES.md", "status": "pending"}, {"content": "ETAPA 9 - Artefato 4: ARQUITETURA_ALVO_CONTROL_PLANE_TOKENIZAI.md", "status": "pending"}, {"content": "ETAPA 9 - Artefato 5: ROADMAP_IMPLEMENTACAO_CONTROL_PLANE.md", "status": "pending"}]