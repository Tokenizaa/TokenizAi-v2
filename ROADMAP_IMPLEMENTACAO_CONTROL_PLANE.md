# Roadmap de Implementação do Control Plane da TokenizAi

## Visão Geral

Este roadmap define as fases necessárias para implementar a arquitetura de controle pleno da TokenizAi, tornando-a independente do Paperclip e capacitada a oferecer funcionalidades equivalentes usando Hermes como runtime. Baseia-se nas evidências técnicas das ETAPAS 1-9 e na `ARQUITETURA_ALVO_CONTROL_PLANE_TOKENIZAI.md`.

> **Princípio Orientador:** Implementar por fases com critérios objetivos de conclusão; não mascarar problemas com mocks ou dados artificiais; priorizar correções de segurança (S3, S9 já aplicadas).

---

## FASE 1: Modelo de Dados e Migrações (4-6 semanas)

### Atividades
1. Obter `SUPABASE_SERVICE_ROLE_KEY` do painel Supabase
2. Criar migrações Drizzle nas seguintes ordenes:
   - `002_add_organizational_model.sql` — `empresas`, `departamentos` com `empresa_id` e `pai_id`
   - `003_add_agent_lifecycle.sql` — `agentes_runtime`, `agent_lifecycle_events`
   - `004_add_skills_catalog.sql` — `skills_catalog`
   - `005_add_task_hierarchy.sql` — `task_hierarchy`
   - `005_add_executions.sql` — `executions` com heartbeats e custo
   - `006_add_approvals.sql` — `approvals` com votos e audit_log
   - `007_add_routines.sql` — `routines` com `trigger_type enum`
   - `008_add_connectors.sql` — `connectors` table + endpoint
   - `009_add_budgets.sql` — `budgets` with `amount_cents`, `spent_cents`, `alert_threshold_pct`
   - `010_add_audit_log.sql` — `audit_log` estruturado
   - `011_add_empresa_usuario.sql` — `empresa_usuario` com `role` e `permissions`
3. População inicial dos dados (seed a partir de `INITIAL_ENTERPRISE_DATA` ou censo existente)
4. Migração de `useSupabase: false` para `useSupabase: true` no `server/supabase.ts`
5. Definição de `role` e `permissions` em `empresa_usuario` para usuários/empresas existentes

### Critérios de Conclusão
- [ ] Todas as 11 migrations aplicadas via `supabase db reset` ou `migrate`; `useSupabase = true` no código
- [ ] Dados populados nas novas tabelas sem perda de dados existentes (enterpriseState → new tables)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada e não causando erros de startup
- [ ] Lint e typecheck passando com as novas migrations

---

## FASE 2: Backend APIs (4-6 semanas)

### Atividades
1. Implementar endpoints listados em `ARQUITETURA_ALVO_CONTROL_PLANE.md` seção 2 (25 endpoints divididos por categoria)
2. Implementar ponte Hermes CLI (`trigger_hermes` flag nos endpoints de agente/runtime)
3. Implementar `appendAuditFn` ativo — registrar mutações no `audit_log` ao invés de ser `unused`
4. Implementar `persistState` com write atômico (temp-file rename) em vez de re-read JSON inteiro
5. Implementar `parseCronList` real (remover stub que sempre retorna `[]`); conectar ao novo `routines` table
6. Implementar `listAgentActionsAudit` no backend (endpoint LISTADO na matriz mas ausente)
7. Corrigir `budgetMonthlyCents` para trazer dado real ou remover display; adicionar `dataQuality` ao DTO
8. Implementar endpoint `/api/connectores` e conectar ao catálogo de conectores
9. Implementar `empresa_usuario` com `role` (ADMIN/MANAGER/OPERATOR/VIEWER) e `permissions jsonb`; migrar RLS de `using (true)` para políticas com `empresa_id`
10. Migrar `adminAuth.ts` S3 fix (admin tokens now sent) para produção; garantir que `request()` prioriza `adminBearerTokenMemory` em todos os fluxos

### Critérios de Conclusão
- [ ] Todos os endpoints da seção 2 respondendo HTTP 200/201 com contratos de contrato validados
- [ ] `appendAuditFn` registrando no `audit_log` ao invés de unused
- [ ] `persistState` usando write atômico (temp-file rename); testes de race condition passando
- [ ] `parseCronList` retornando dados reais (não `[]`); `routines` table populada
- [ ] `listAgentActionsAudit` endpoint funcional
- [ ] `budgetMonthlyCents` com dado real ou display removido; `dataQuality` no DTO
- [ ] Endpoint `/api/connectores` funcional; catálogo de conectores populado
- [ ] RLS policies com `empresa_id` tendo efeito (anteriormente `using (true)`)
- [ ] S3 corrigida em produção: admin tokens enviados; `request()` prioritizando `adminBearerTokenMemory`

---

## FASE 3: Frontend UX e Funcionalidade (4-6 semanas)

### Atividades
1. Corrigir toasts: `console.log('[toast]', msg)` → `Toast` component with `role="alert"`, `aria-live="polite"`; remover `C3` warnings
2. Popular drawers:
   - `TasksPage`: `taskDetail` a partir do `tasks` store em vez de `null` initial; `childTasks` populados
   - `AgentsPage`: drawer a partir de `agentes_runtime` lookup + `HermesBotDto`; `life_cycle_state` exibido
3. Preservar estado na navegação:
   - `taskInitialId` + `chatInitialRef` salvos no `sessionStorage`; restaurados ao trocar rota via `useLocation` + `useEffect`
   - `beforeUnload` prompt opcional se há dados não salvos
4. Acessibilidade:
   - `<tr role="row">` com `<button role="listitem">` Inside ou uso de `<details>`;
   - Ícones `aria-label` descriptivo (ex: `aria-label="Excluir tarefa"` em vez de ícone só com `title`);
   - `SlideDrawer` `useFocusTrap` testado com teclado (Tab/Shift+Tab foco); close por `Escape` já funcional
5. Rota state preservation:
   - `useLocation` + `useEffect` para salvar estado antes de `navigate()`
   - Remover dependência de `taskInitialId`/`chatInitialRef` como props soltas; usar contexto global
6. Testes de acessibilidade automatizados (jest-axe ou similar)

### Critérios de Conclusão
- [ ] Toasts visíveis com `role="alert"` e `aria-live="polite"`; `C3` warnings removidos
- [ ] Drawers populados em TasksPage e AgentsPage; dado fluindo do store/backend
- [ ] Estado preservado ao trocar navegação; `sessionStorage` useEffect pattern consistente em todas as rotas
- [ ] Acessibilidade: axe passes em páginas críticas (TasksPage, AgentsPage, Dashboard); `aria-label` em todos os ícones interativos
- [ ] Navegação: estado preservado em 5+ rota transitions sem perda de dado

---

## FASE 4: Hermes Ponte e Validação (3-4 semanas)

### Atividades
1. Implementar lógica `trigger_hermes` nos endpoints de agente/runtime:
   - `POST /api/agentes-runtime` — se `trigger_hermes: true`, disparar CLI `profile create <slug> --no-skills`; registrar sucesso/erro em `agent_lifecycle_events`; se CLI falhar, persiste registro igual
   - `PATCH /api/agentes-runtime/:id` — se `trigger_hermes: true`, disparar CLI `profile pause/resume/terminate`; update `life_cycle_state`; registrar evento
   - `POST /api/execucoes` — gerar `hermes_execution_id` localmente; status inicial `QUEUED`; se CLI disponível, delegar execução; caso contrário, manter status interno
   - `POST /api/execucoes/:id/heartbeat` — atualizar `heartbeat_at`; se CLI disponível, delegar; caso contrário, manter estado interno
   - `POST /api/execucoes/:id/cancel` — update `status` para `CANCELLED`; registrar evento; aviso ao usuário
2. Testar com e sem CLI Hermes disponível:
   - Ambiente de dev: CLI disponível; validar que operações disparam CLI e estado reflete
   - Ambiente sem CLI (ex.: `DISABLE_HMR` ou produção Cloudflare): operação gracefull; estado interno consistente; `configured: false` no `hermesGateway.getStatus()` em vez de hardcode `true`
3. Validar `GET /api/health` reflete realidade:
   - `hermes.configured` = CLI disponível + credenciais OK
   - `hermes.connected` = dependente de `heartbeat` bem-sucedido nos últimos N segundos
4. Garantir que `GET /api/health` não menta sobre estado do sistema

### Critérios de Conclusão
- [ ] Endpoints de agente/runtime com `trigger_hermes` implementados; CLI disparado quando flag true; estado reflete CLI success/failure
- [ ] `GET /api/health` reflete realidade real (não hardcode `configured: true`)
- [ ] Testes de dev vs produção (sem CLI) passando; estado consistente em ambos
- [ ] `appendAuditFn` ativo e registrando; `persistState` atomic write validado

---

## FASE 5: Testes, Homologação e lançamento (3-4 semanas)

### Atividades
1. Battery de testes end-to-end cobrindo:
   - Criação/visualização de empresas, departamentos, agentes, tasks, executions, approvals, routines, conectores
   - Fluxos completos: criar agente → task → execution → approval → routine → conector → budget check
   - Caminhos de erro e graceful degradation (sem CLI Hermes)
2. `npm run lint` limpo (0 erros)
3. `npm run build` limpo (0 erros; warning de chunk >500 kB documentado, não bloqueador)
4. `npx vitest run` com `TOKENIZAI_SESSION_SECRET` passando (11/11 tests da security.test.ts)
5. homologação formal: 
   - Revisão de código por pares
   - Validação de contratos API (contratos em contrato com a seção 2 do ARQUITETURA_ALVO)
   - Homologação `APROVADO` (sem ressalvas) pela liderança

### Critérios de Conclusão
- [ ] Battery de testes E2E passando em CI (GitHub Actions ou ambiente local)
- [ ] `npm run lint` 0 erros
- [ ] `npm run build` 0 erros (apenas warning de chunk >500 kB documentado)
- [ ] `npx vitest run` 11/11 passing com `TOKENIZAI_SESSION_SECRET`
- [ ] Homologação formal: `APROVADO` (sem ressalvas) — ou `APROVADO COM RESSALVAS` se restarem gaps críticos não bloqueantes

---

## Visão Final

Ao completar todas as 5 fases, a TokenizAi terá:

1. **Modelo de dados completo** estendendo as 21 tabelas originais com organizações, agentes com lifecycle, skills versionadas, tasks hierárquicas, execuções com heartbeats, aprovações estruturadas, rotinas com triggers, conectores, budgets auditados

2. **Backend completo** com 25+ endpoints RESTful com gates de permissão adequados; ponte controlada Hermes CLI; auditoria ativa; RLS policies com isolamento por empresa

3. **Frontend UX corrigido** — toasts visíveis, drawers populados, estado preservado na navegação, acessibilidade AA/AAA

4. **Independência do Paperclip** — modelo, APIs, frontend e operação não dependem mais do Paperclip; Hermes permanece como runtime mas operações são orquestradas pela arquitetura própria

5. **Homologação `APROVADO`** — build, lint, testes passando; todas as funcionalidades centrais operacionais; sem dependências operacionais do Paperclip

> **Nota Importante:** O roadmap contempla correções de segurança já aplicadas em ETAPA 8 (S3 e S9). As fases subsequentes consideram esses como pontos de partida, não como bloqueios.

---
<tool_call>
<function=todowrite>
<parameter=todos>
[{"content": "ETAPA 1-7 - Concluídas: auditoria completa, correções aplicadas, homologação", "status": "completed"}, {"content": "ETAPA 8 - Correções: api.ts (S3) + audit-visual.spec.ts (S9)", "status": "completed"}, {"content": "ETAPA 9 - Artefato 1: AUDITORIA_COMPARATIVA_PAPERCLIP_TOKENIZAI.md - CONCLUÍDO", "status": "completed"}, {"content": "ETAPA 9 - Artefato 2: MATRIZ_EQUIVALENCIA_FUNCIONAL.md - CONCLUÍDO", "status": "completed"}, {"content": "ETAPA 9 - Artefato 3: CONCILIACAO_271_AGENTES.md - CONCLUÍDO", "status": "completed"}, {"content": "ETAPA 9 - Artefato 4: ARQUITETURA_ALVO_CONTROL_PLANE_TOKENIZAI.md - CONCLUÍDO", "status": "completed"}, {"content": "ETAPA 9 - Artefato 5: ROADMAP_IMPLEMENTACAO_CONTROL_PLANE.md - CONCLUÍDO", "status": "completed"}]