# Plano de Correção e Implementação — 5 Fases para Homologação `APROVADO`

## Visão Geral

Este plano divide a implementação em 5 fases sequenciais, com critérios objetivos de conclusão para cada uma. As correções de segurança S3 (admin tokens now sent) e S9 (senha hardcoded removida) já foram aplicadas em ETAPA 8 e servem como ponto de partida.

> **Princípio Orientador:** Aproveitar o máximo do Hermes nativo. Implementar somente a camada empresarial que realmente faltar. Não criar duplicatas. Critérios de conclusão são verificáveis (build, lint, testes, endpoints responding).

---

## FASE 1: Modelo de Dados e Migrações (4-6 semanas)

### Atividades

1. Obter `SUPABASE_SERVICE_ROLE_KEY` do painel Supabase
2. Criar migrações Drizzle nas seguintes ordenes:
   - `002_add_organizational_model.sql` — `empresas`, `departamentos` com `empresa_id` e `pai_id`
   - `003_add_agent_lifecycle.sql` — `agentes_runtime`, `agent_lifecycle_events`
   - `004_add_skills_catalog.sql` — `skills_catalog`
   - `005_add_task_hierarchy.sql` — `task_hierarchy`
   - `005_add_executions.sql` — `executions` com heartbeats e custo (usar nome diferente ou prefixar)
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

- [ ] Todas as 10 migrations aplicadas (a migration 001 já existe); `useSupabase = true` no código
- [ ] Dados populados nas novas tabelas sem perda de dados existentes (enterpriseState → new tables)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada e não causando erros de startup
- [ ] Lint e typecheck passando com as novas migrations
- [ ] RLS policies com `empresa_id` tendo efeito (testado via supabase admin client)

### Entregas Parciais

- `supabase/migrations/002-011_*.sql` aplicadas
- `server/supabase.ts` com `useSupabase = true`
- `empresa_usuario` table populada com roles
- `RLS policies` testadas e funcionando

---

## FASE 2: Backend APIs (4-6 semanas)

### Atividades

1. Implementar endpoints listados em `ARQUITETURA_FINAL_TOKENIZAI_HERMES.md` seção 2 (25 endpoints divididos por categoria)
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

### Entregas Parciais

- Todos os 25 endpoints listados no ARQUITETURA_FINAL_TOKENIZAI_HERMES.md seção 2
- `appendAuditFn` ativo e testado
- `parseCronList` funcional
- `listAgentActionsAudit` endpoint
- `budgets` table + endpoint `/api/custos/resumo`
- RLS policies migradas de `using (true)` para `empresa_id`

---

## FASE 3: Frontend UX e Funcionalidade (4-6 semanas)

### Atividades

1. Corrigir toasts: `console.log('[toast]', msg)` → `Toast` component with `role="alert"`, `aria-live="polite"`; remover `C3` warnings
2. Popular drawers:
   - `TasksPage`: `taskDetail` a partir do `tasks` store em vez de `null` initial; `childTasks` populados
   - `AgentsPage`: drawer populado com `agente` do `HermesBotDto` + `life_cycle_state` do `agentes_runtime`
3. Preservar estado na navegação:
   - `taskInitialId` + `chatInitialRef` salvos no `sessionStorage`; restaurados ao trocar rota via `useLocation` + `useEffect`
   - `beforeUnload` prompt opcional se há dados não salvos
4. Acessibilidade:
   - `<tr role="row">` com `<button role="listitem">` Inside ou uso de `<details>`
   - Ícones `aria-label` descriptivo (ex: `aria-label="Excluir tarefa"` em vez de ícone só com `title`)
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

### Entregas Parciais

- Toasts corrigidos em componentes críticos (Dashboard, AiOpsView)
- Drawers populados em TasksPage
- Acessibilidade básica implementada (aria-label em ícones principais)
- sessionStorage pattern em 3 rotas críticas

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
4. Garantir que `GET /api/health` não menti sobre estado do sistema

### Critérios de Conclusão

- [ ] Endpoints de agente/runtime com `trigger_hermes` implementados; CLI disparado quando flag true; estado reflete CLI success/failure
- [ ] `GET /api/health` reflete realidade real (não hardcode `configured: true`)
- [ ] Testes de dev vs produção (sem CLI) passando; estado consistente em ambos
- [ ] `appendAuditFn` ativo e registrando; `persistState` atomic write validado

### Entregas Parciais

- `trigger_hermes` em `POST /api/agentes-runtime` e `PATCH /api/agentes-runtime/:id`
- Testes de dev vs produção (pelo menos 2 cenários)
- `GET /api/health` reflete realidade (configured conectado à realidade de CLI/credenciais)

---

## FASE 5: Testes, Homologação e Lançamento (3-4 semanas)

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
   - Validação de contratos API (contratos em contrato com a seção 2 do ARQUITETURA_FINAL_TOKENIZAI_HERMES)
   - Homologação `APROVADO` (sem ressalvas) pela liderança

### Critérios de Conclusão

- [ ] Battery de testes E2E passando em CI (GitHub Actions ou ambiente local)
- [ ] `npm run lint` 0 erros
- [ ] `npm run build` 0 erros (apenas warning de chunk >500 kB documentado, não bloqueador)
- [ ] `npx vitest run` 11/11 passing com `TOKENIZAI_SESSION_SECRET`
- [ ] Homologação formal: `APROVADO` (sem ressalvas) — ou `APROVADO COM RESSALVAS` se restarem gaps críticos não bloqueantes

### Entregas Finais

- Relatório de homologação assinado pela liderança
- Todos os 5 artefatos ETAPA 9 atualizados e validados
- Build limpo, lint limpo, testes passing
- Documentação de operação atualizada

---

## Resumo de Dependências entre Fases

| Fase | Depende de | Habilita |
|------|-----------|----------|
| **Fase 1** | Acesso a `SUPABASE_SERVICE_ROLE_KEY` | Toda a fase seguinte (dados estruturais) |
| **Fase 2** | Fase 1 concluída | APIs funcionais; integração Hermes ponte |
| **Fase 3** | Fase 2 concluída (pelo menos endpoints críticos) | UX funcional; usuários conseguem operar o sistema |
| **Fase 4** | Fase 2 concluída (lógica `trigger_hermes`); Hermes CLI disponível em dev | Operação completa com e sem CLI; health check real |
| **Fase 5** | Fase 1-4 todas concluídas | Homologação formal; entrega `APROVADO` |

---

## Cronograma Estimado

| Semana | Conquista Principal |
|--------|---------------------|
| 1-2 | Fase 1: Migrações aplicadas; `useSupabase = true`; `SUPABASE_SERVICE_ROLE_KEY` configurada |
| 3-4 | Fase 2: Endpoints críticos operacionais (agents, tasks, org, health); `appendAuditFn` ativo |
| 5-6 | Fase 3: Toasts corrigidos; drawers populados; acessibilidade básica; navegação preservada |
| 7-8 | Fase 4: `trigger_hermes` implementado; testes dev vs production; `GET /api/health` real |
| 9-10 | Fase 5: E2E battery passing; lint 0 erros; build limpo; 11/11 vitest passing; homologação `APROVADO` |

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| **Sem acesso a `SUPABASE_SERVICE_ROLE_KEY`** | Média | Alta | Solicitar ao administrador Supabase; sem isso, Fase 1 bloqueia tudo; usar modo degradado temporário com documentação |
| **CLI Hermes não disponível em CI** | Alta | Média | Fase 4 considera graceful degradation; testes mock o CLI behavior; `trigger_hermes: false` path testado |
| **Parser `parseCronList` quebrado honda banco** | Baixa | Alta | Testes unitários isolados antes de aplicar; backup do `routines` data em JSON antes de migração |
| **RLS policies quebram acesso de admin** | Média | Alta | Testar em ambiente de staging antes de produção; ter rollback script preparado; `using (true)` como fallback temporário |
| **Frontend UX regressões não detectadas** | Média | Média | Testes de acessibilidade (axe) em cada mudança; checklist de toasts/drawers/navigation em cada PR |
| **Timeout em homologação por falta de CI/CD** | Baixa | Média | Critérios objetivos (lint, build, vitest) podem ser validados localmente antes de push para main |

---

## Critério Final de Homologação

A homologação `APROVADO` (sem ressalvas) é concedida quando **todos** os seguintes conditions são verdadeiros:

1. `npm run build` — 0 erros (apenas warnings de chunk >500 kB documentados)
2. `npm run lint` — 0 erros
3. `npx vitest run` (com `TOKENIZAI_SESSION_SECRET`) — 11/11 passing
4. Battery de testes E2E — passando em ambiente de staging (ou local com mocks adequados)
5. Todas as 5 fases completadas com critérios de conclusão atendidos
6. Revisão de código aprovada por pares
7. Validação de contratos API bem-sucedida
8. Nenhuma dependência operacional do Paperclip no código (verificada por grep)
9. `SUPABASE_SERVICE_ROLE_KEY` configurada e RLS policies funcionando
10. `hermes.configured` reflete realidade (não hardcode `true`)

Se houver 1-2 itens críticos não bloqueantes (ex.: uma funcionalidade Hermes que não foi testada ainda, ou uma UX edge case), a classificação pode ser `APROVADO COM RESSALVAS` com documentação das ressalvas.

> **Nota:** As correções S3 e S9 já aplicadas em ETAPA 8 são consideradas **pontos de partida** desta roadmap, não bloqueios. Elas já garantiam segurança mínima para o ambiente operar.

---