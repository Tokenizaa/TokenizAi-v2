# Relatório de Estado Atual e Plano de Ação — Produção (TokenizAi v2)

**Data:** 27/11/2026 | **Branch:** main (atualizada com origin/main, HEAD c9537ac) | **Ambiente:** WSL, Node 22

---

## 1. Contexto

TokenizAi v2 é o painel empresarial e camada de governança da NettosCorp. O **Hermes** é o runtime operacional dos agentes (bots, tarefas, chats, skills, execuções) na porta 3000 (`npm run dev` → `tsx server.ts`). Paperclip foi removido por completo nos commits `e4da7c1`, `140026d`, `aea0a25`, `9667f62` — é legado histórico, não deve ser reativado.

---

## 2. O que os commits recentes trouxerdo

| Commit | Tipo | O que mudou |
|--------|------|-------------|
| `c9537ac` | build | `Projetos/` e `agency-agents-app/` (projetos externos com node_modules) ignorados no `.gitignore` para não inflar o pacote de deploy acima do limite do Vercel. |
| `8a4c1ca` | merge | Correções de inicialização serverless/Vercel: `api/[...path].ts` com try/catch que retorna 503 + stack real (`BACKEND_INITIALIZATION_FAILED`); `server.ts` sem top-level await, `initializeServerState()` idempotente, `startServer` chama a inicialização, `hermesGateway.initialize` pulado na Vercel; `adminAuth.ts` com `SESSION_SECRET` lazy; `persistence.ts` pula gravação local JSON na Vercel (sistema de arquivos somente-leitura); `vercel.json`, `DEPLOYMENT_VERCEL.md`, `.env.example`, `vite.config.ts` atualizados. |
| `6d8f475` | fix | Entry point serverless inicial: `api/[...path].ts`, `server.ts`, `adminAuth.ts`, `persistence.ts`, `vercel.json` (primeira versão das rotas de função serverless). |

**Leitura direta dos commits:** o time vem estabilizando o backend para rodar como função serverless (Vercel/Cloudflare), com degradacao graciosa quando Hermes CLI ou Supabase não estão disponíveis.

---

## 3. Estado real (verificado por execução, não por suposição)

### 3.1 Typecheck / lint (`npm run lint` = `tsc --noEmit`)
- **Código próprio da TokenizAi v2: 0 erros.**
- Os 4 erros TS reportados estão todos sob `Projetos/` (apps externos DefesaI Saúde / AdeusMultas), que já foram adicionados ao `.gitignore` do deploy mas ainda são compilados pelo `tsconfig` (sem `exclude` para `Projetos/`). São pré-existentes e não pertencem à TokenizAi v2.

### 3.2 Build de produção (`npm run build` = `vite build`)
- **Passou (exit 0, 8.6s).** `dist/` gerado: `index-CCeoA9hT.css` (63 kB) + `index-er9pO3Mv.js` (835 kB).
- Aviso (não-bloqueador): um chunk >500 kB após minificação. Documentado no PLANO_DE_CORRECAO como aceitável.

### 3.3 Testes (`npm run test` = `vitest run`)
- **TRAVA.** O processo não conclui (rodou vários minutos sem saída; foi encerrado manualmente). Suspeita forte: testes de integração em `server/integrations/hermes/` (`cliRunner.test.ts`, `hermes.integration.test.ts`) invocam o CLI Hermes real (`/home/lg/.local/bin/hermes`) e travam sem saída.
- **Consequência:** o job `unit-tests` do CI (`.github/workflows/ci-cd.yml`) não passa hoje. É o principal bloqueador de CI.

### 3.4 Variáveis de ambiente
- `.env.example` existe com todos os placeholders **vazios**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TOKENIZAI_SESSION_SECRET`, `TOKENIZAI_ADMIN_PASSCODE`, `GEMINI_API_KEY`, etc.
- Localmente nada está configurado; sem essas credenciais não há persistência durável nem sessões válidas.

### 3.5 Supabase e migrações
- `001_initial_schema.sql` é a base (21 tabelas: departamentos, agentes_empresariais, projetos, metas, aprovacoes, runs, tasks, activities, costs, etc.).
- Migrações **002–011 escritas e não rastreadas (untracked)**:
  - `002_add_organizational_model.sql` — `empresas`, `departamentos.empresa_id` + `pai_id`
  - `003_add_agent_lifecycle.sql` — `agentes_runtime`, `agent_lifecycle_events`
  - `004_add_skills_catalog.sql` — `skills_catalog`
  - `005_add_task_hierarchy.sql` — `task_hierarchy`
  - `006_add_executions.sql` — `executions`
  - `007_add_routines.sql` — `routines`
  - `008_add_connectors.sql` — `connectors`
  - `009_add_budgets.sql` — `budgets`
  - `010_add_audit_log.sql` — `audit_log`
  - `011_add_empresa_usuario.sql` — RBAC por empresa (ADMIN/MANAGER/OPERATOR/VIEWER), RLS com isolamento por `empresa_id`
- Nenhuma delas foi aplicada em banco; `useSupabase` ainda não está `true` em produção no código (o plano prevê essa migração na Fase 1).
- `server/supabase.ts` e `server/supabase/repository.ts` já existem e usam service role key; `server/persistence.ts` grava JSON local + espelha no Supabase quando disponível.

### 3.6 Hermes CLI
- Binário disponível em `/home/lg/.local/bin/hermes` (39 MB). `HERMES_CLI` defaultiza para esse caminho via `domainCache.ts`.
- O backend consulta Hermes via CLI com cache por domínio (TTL 5s–5min) e degradacao graciosa (stale-while-revalidate, fallback a `[]`).
- Na Vercel, `hermesGateway` permanece **desconectado** até existir uma ponte remota autenticada (não apontar o Vercel para o binário local do fundador).

### 3.7 Deploy / CI
- `.github/workflows/ci-cd.yml`: jobs `lint-and-typecheck` → `build` → `unit-tests` → `e2e-tests` (Playwright) → `deploy-preview` / `deploy-production`.
- **Deploy para Cloudflare Pages** (projetos `tokenizai` e `tokenizai-preview`) via `cloudflare/pages-action@v1`.
- **Conflito de alvo:** `DEPLOYMENT_VERCEL.md` documenta deploy na **Vercel** (`vercel.json` existe), mas o CI de fato deploya na **Cloudflare Pages** e há `wrangler.toml` + `.wrangler/` no repo. Alvo de deploy não unificado.
- Variáveis exigidas em produção (ver `DEPLOYMENT_VERCEL.md`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `TOKENIZAI_SESSION_SECRET`, `TOKENIZAI_ADMIN_PASSCODE`, `FOUNDER_EMAIL`. Nenhuma confirmada configurada no ambiente de deploy.

---

## 4. Limitações conhecidas (documentadas em `LIMITACOES-CONHECIDAS.md`)

LIM-001 conectores, LIM-002 abas do AgentDetailPage (tarefas/execuções/runtime/permissoes), LIM-003 chat direto, LIM-004 cancelamento de execução, LIM-005 sub-tasks standalone, LIM-006 aprovações standalone, LIM-007 métricas do ExecutiveView. Todas dependem de endpoints Hermes ainda não expostos (`GET /api/hermes/connectors`, `agents/:id/tasks`, `agents/:id/runs`, `runs/:id/cancel`, chats persistentes, etc.). **Design intencional: não simular dados; refletir o estado real do Hermes.** Quando a Hermes expor esses contratos, o frontend já tem os wrappers (`ai-ops/pages`) prontos para consumir.

---

## 5. Bloqueadores para ir à produção

1. **Testes travam** (`vitest` não conclui) — CI job `unit-tests` não passa.
2. **Supabase não configurado** — sem `SUPABASE_SERVICE_ROLE_KEY` não há fonte de verdade durável nem RLS.
3. **Migrações 002–011 não aplicadas** em banco.
4. **`useSupabase` ainda não `true`** no código de servidor.
5. **Alvo de deploy divergente** (docs dizem Vercel; CI deploya Cloudflare Pages).
6. **Variáveis de produção não definidas** no ambiente de deploy.

---

## 6. Plano de ação para produção (5 fases — do `PLANO_DE_CORRECAO_E_IMPLEMENTACAO.md`)

Critério final de homologação: `APROVADO` somente quando (1) build 0 erros, (2) lint 0 erros, (3) vitest 11/11 passando com `TOKENIZAI_SESSION_SECRET`, (4) E2E passando em staging/local, (5) 5 fases concluídas, (6) revisão de pares aprovada, (7) contratos de API validados, (8) sem referência Paperclip no código, (9) `SUPABASE_SERVICE_ROLE_KEY` + RLS funcionando, (10) `hermes.configured` reflete realidade (não hardcode `true`).

| Fase | Objetivo | Prazo estimado | Critérios de conclusão |
|------|----------|----------------|------------------------|
| **Fase 1** | Modelo de dados e migrações | 4–6 semanas | 11 migrações aplicadas (001 já existe); `useSupabase = true`; `SUPABASE_SERVICE_ROLE_KEY` configurada sem erros de startup; seed populado; lint/typecheck OK; RLS com `empresa_id` testado |
| **Fase 2** | Backend APIs | 4–6 semanas | ~25 endpoints da seção 2 do `ARQUITETURA_FINAL_TOKENIZAI_HERMES.md` respondendo 200/201; `appendAuditFn` ativo; `persistState` com write atômico; `parseCronList` real (não `[]`); `listAgentActionsAudit`; `budgetMonthlyCents` real ou removido; `/api/connectores`; RLS migrada de `using (true)` para `empresa_id` |
| **Fase 3** | Frontend UX | 4–6 semanas | Toasts com `role="alert"` + `aria-live="polite"`; drawers populados (TasksPage, AgentsPage); estado preservado na navegação (`sessionStorage`); acessibilidade (axe) nas páginas críticas |
| **Fase 4** | Ponte Hermes + validação | 3–4 semanas | `trigger_hermes` nos endpoints de agente/runtime; `GET /api/health` reflete realidade (não hardcode); testes com e sem CLI Hermes (degradação graciosa) |
| **Fase 5** | Testes, homologação, lançamento | 3–4 semanas | Bateria E2E passando; lint 0; build 0; vitest 11/11; homologação `APROVADO` pela liderança |

**Total estimado: ~10–12 semanas.** Fases sequenciais; a Fase 1 é pré-requisito de todas as seguintes (dados estruturais).

---

## 7. Próximos passos imediatos (esta semana)

1. **Desbloquear os testes:** isolar qual teste do `server/integrations/hermes/` trava o vitest (provavelmente chamada ao CLI Hermes real sem timeout de processo) e corrigir para que `npm run test` conclua. Sem isso, o CI não passa.
2. **Unificar alvo de deploy:** decidir entre Vercel (documentado em `DEPLOYMENT_VERCEL.md`) e Cloudflare Pages (alvo do CI), alinhando `vercel.json`/`wrangler.toml`/`.github/workflows/ci-cd.yml` e removendo a duplicidade.
3. **Configurar Supabase de homologação:** definir `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e aplicar migrações `002` a `011` no ambiente de staging.
4. **Definir variáveis de produção** no ambiente de deploy conforme a tabela de `DEPLOYMENT_VERCEL.md` (nunca prefixar segredos com `VITE_`).

---

## 8. Artefatos relacionados no repositório

- `PLANO_DE_CORRECAO_E_IMPLEMENTACAO.md` — plano detalhado 5 fases (fonte da seção 6 deste relatório)
- `ROADMAP_IMPLEMENTACAO_CONTROL_PLANE.md` — roadmap de implementação do Control Plane
- `ARQUITETURA_FINAL_TOKENIZAI_HERMES.md` — arquitetura alvo (~25 endpoints, Hermes-first)
- `ARQUITETURA_ALVO_CONTROL_PLANE_TOKENIZAI.md` — arquitetura do control plane
- `LIMITACOES-CONHECIDAS.md` — LIM-001 a LIM-007
- `DEPLOYMENT_VERCEL.md` — variáveis e critérios de homologação Vercel
- `.github/workflows/ci-cd.yml` — pipeline CI/CD

**Nota:** Nenhuma alteração foi commitada neste relatório (o usuário não solicitou commit). O arquivo fica em `RELATORIO_ESTADO_ATUAL_E_PLANO_PRODUCAO.md` na raiz do repositório.
