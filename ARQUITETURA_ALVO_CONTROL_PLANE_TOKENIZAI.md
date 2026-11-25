# Arquitetura de Controle Pleno — TokenizAi V2

## Visão Geral

Este documento propõe uma arquitetura-alvo para o TokenizAi V2 que permite entregar uma experiência equivalente ao Paperclip usando **Hermes como runtime** e sendo **totalmente independente do Paperclip**. A arquitetura baseia-se nas evidências técnicas coletadas nas ETAPAS 1-9 da auditoria independente.

> **Princípio Orientador:** A TokenizAi deve possuir sua própria camada de organização, governança e persistência empresarial. O Hermes deve executar as capacidades que efetivamente oferece; o que não tem nativo deve ser orquestrado pela arquitetura própria da TokenizAi.

---

## 1. Modelo de Dados Estendido

A atual migration `001_initial_schema.sql` define 21 tabelas. A arquitetura-alvo estende este modelo com as seguintes adições:

| Nova Tabela / Campo | Tipo | Relacionamento | Finalidade |
|---|---|---|---|
| `empresas` | `id uuid PK`, `nome not null`, `cnpj`, `status`, `created_at`, `updated_at` | — | Substitui `departamentos` como unidade organizacional superior; permite múltiplas empresas/órgãos na mesma instância |
| `departamentos` | `id uuid PK`, `nome not null`, `codigo unique not null`, `empresa_id uuid → empresas(id)`, `pai_id uuid → departamentos(self-FK` | `empresas`; `perfis_empresariais.empresa_id` (nova coluna) | Estrutura hierárquica de departamentos dentro de cada empresa; suporte a reporte (`pai_id`) |
| `agentes_runtime` | `id uuid PK`, `slug unique not null`, `empresa_id uuid → empresas(id)`, `departamento_id → departamentos(id)`, `status`, `capabilities text[]`, `hermes_agent_id text`, `runtime_state jsonb`, `life_cycle_state text` (CURRENT/OUTDATED/MODIFIED/REMOVED/FOREIGN) | `empresas`; `departamentos`; **Chave estrangeira para o runtime Hermes** — armazena o ID do agente ativo no Hermes; faz o ponte entre o banco e o runtime | Faz a ponte entre o modelo empresarial e o runtime Hermes; `life_cycle_state` provém do modelo Paperclip (5 states); `hermes_agent_id` permite lookup de status ativo |
| `skills_catalog` | `id uuid PK`, `name not null`, `description`, `version`, `manifest jsonb`, `source enum ('agency-agents', 'paperclip', 'custom')`, `source_ref text`, `install_count integer default 0`, `last_reconciled_at timestamptz` | — | Catálogo de skills versionado; substitui a abordagem achatada atual; `progress` em 5 states (CURRENT/OUTDATED/MODIFIED/REMOVED/FOREIGN) como no Paperclip; reconcile engine pode comparar `manifest` entre catalogo e runtime |
| `agent_lifecycle_events` | `id uuid PK`, `agent_id uuid → agentes_runtime(id)`, `event_type enum (HIRE, CONFIGURE, PAUSE, RESUME, TERMINATE)`, `timestamp timestamptz`, `payload jsonb`, `hermes_response jsonb` | `agentes_runtime`; **Audit trail** completo do lifecycle de cada agente | Substitui `activeTokens` Map em memória (S7); persiste events mesmo após restart; `hermes_response` captura saída do CLI para auditoria |
| `task_hierarchy` | `id uuid PK`, `parent_task uuid → task_hierarchy(self-FK)`, `child_task uuid → task_hierarchy(self-FK)`, `status`, `assigned_agent uuid → agentes_runtime(id)`, `progress integer`, `deadline date` | `agentes_runtime`; permite árvore ilimitada de subtarefas | Substitui tasks planas atuais; `parent_task/child_task` implementa hierarquia Paperclip (parentId); `progress` e `deadline` adicionam controle operacional |
| `executions` | `id uuid PK`, `task_hierarchy_id uuid → task_hierarchy(id)`, `hermes_execution_id text`, `status enum (QUEUED,RUNNING,COMPLETED,FAILED,CANCELLED)`, `started_at timestamptz`, `completed_at timestamptz`, `logs jsonb`, `cost_cents bigint`, `heartbeat_at timestamptz` | `task_hierarchy`; **Rastreamento de execução** com heartbeats e custo | Substitui `runs` table atual (21-table migration); `hermes_execution_id` faz link com o CLI Hermes; `cost_cents` rastreia custo operacional; `heartbeat_at` monitora vida útil |
| `approvals` | `id uuid PK`, `resource_type enum (PROJECT, TASK, EXECUTION, AGENT)`, `resource_id uuid`, `status enum (PENDING, APPROVED, REJECTED, REVISION)`, `requester uuid → agentes_runtime(id)`, `approver uuid → agentes_runtime(id)`, `votes integer default 0`, `decided_at timestamptz`, `payload jsonb`, `audit_log jsonb` | `agentes_runtime`; **Sistema de aprovação** com QA Gate, votos, histórico auditável | Substitui `HermesApprovalsPanel` desativado + EmptyState; implementa Paperclip `approval` system com `authority engine` + `policy engine`; `votes` permite quorum; `audit_log` rastreia quem aprovou/rejeitou e por quê |
| `routines` | `id uuid PK`, `name not null`, `cron text`, `active boolean default true`, `trigger_type enum (CRON, MANUAL, EVENT)`, `definition jsonb`, `last_triggered_at timestamptz`, `execution_limit integer default null`, `created_at timestamptz` | — | Substitui `routines` table atual (parseCronList → []); `trigger_type` enum substitui string livre; `execution_limit` evita loops infinitos; `definition jsonb` armazena config completa |
| `connectors` | `id uuid PK`, `name not null`, `type enum (API, FILE, CLI, MCP)`, `config jsonb`, `status enum (ACTIVE, INACTIVE, ERROR)`, `last_triggered_at timestamptz`, `last_success_at timestamptz`, `error_count integer default 0`, `metadata jsonb` | — | Substitui ausência de endpoint `/api/hermes/connectors`; armazena configuração de conectores API, arquivo, CLI (chamada ao Hermes) e MCP; `error_count` e `error_count` rastreiam falhas |
| `budgets` | `id uuid PK`, `name not null`, `amount_cents integer`, `period enum (MONTHLY, QUARTERLY, ANNUAL)`, `spent_cents integer default 0`, `alert_threshold_pct integer default 50`, `company_id uuid → empresas(id)`, `valid_until date` | `empresas`; **Controle orçamentário** operacional | Substitui display enganoso de "Teto Mensal = gasto"; `alert_threshold_pct` notifica antes do limite; `amount_cents - spent_cents = restante` |
| `audit_log` | `id uuid PK`, `action enum (CREATE, UPDATE, DELETE, APPROVE, REJECT, RUNTIME_EVENT)`, `entity_type enum (EMPRESA, DEPARTAMENTO, AGENTE, TAREFA, EXECUÇÃO, ROTINA, CONNECTOR, ORCAMENTO)`, `entity_id uuid`, `user_id uuid → agentes_runtime(id)`, `old_values jsonb`, `new_values jsonb`, `timestamp timestamptz`, `ip inet`, `session_token text` | — | **Log de auditoria** estruturado; substitui `appendAudit` unused + `enterprise.auditLogs` derivado de mutações cegas; `ip` e `session_token` rastreiam origem; `old_values/new_values` rastreiam mudanças completas |
| `empresa_usuario` | `id uuid PK`, `empresa_id uuid → empresas(id)`, `agente_id uuid → agentes_runtime(id)`, `role enum (ADMIN, MANAGER, OPERATOR, VIEWER)`, `permissions jsonb`, `created_at timestamptz` | `empresas`; `agentes_runtime`; **Controle de acesso por papel** dentro da empresa | Substitui ausência de `org_id`/`tenant_id`; `role` com 4 níveis; `permissions jsonb` lista recursos concedidos; substitui RLS `using (true)` amplo |

### Migração Gradual

As novas tabelas podem ser adicionadas via novas migrations Drizzle (ex: `002_add_organizational_model.sql`, `003_add_agent_lifecycle.sql`, etc.) sem remover a migration original. O `enterpriseState` em memória continua operando em modo degradado enquanto a migration nova é implantada; `useSupabase` passa a ser `true` quando `SUPABASE_SERVICE_ROLE_KEY` for configurado.

---

## 2. Backend — APIs e Endpoints

A extensão das rotas atuais (`server.ts:155-913`) com os novos endpoints:

### 2.1 Rotas de Organização e Empresas (substituindo `server.ts:320-882`)

| Método | Endpoint | Gate | Descrição |
|---|---|---|---|
| `GET /api/empresas` | `requirePermission('empresa:read')` | Listar empresas |
| `POST /api/empresas` | `requirePermission('empresa:create')` | Criar empresa |
| `GET /api/empresas/:id` | `requirePermission('empresa:read')` | Obter empresa |
| `PATCH /api/empresas/:id` | `requirePermission('empresa:update')` | Atualizar empresa |
| `GET /api/departamentos` | `requirePermission('departamento:read')` | Listar departamentos da empresa |
| `POST /api/departamentos` | `requirePermission('departamento:create')` | Criar departamento |
| `GET /api/agentes-runtime` | `requirePermission('agente:read')` | Listar agentes com status atual do Hermes (lookup `hermes_agent_id`) |
| `GET /api/agentes-runtime/:id` | `requirePermission('agente:read')` | Obter agente com `life_cycle_state` e `hermes_agent_id` |
| `POST /api/agentes-runtime` | `requirePermission('agente:create')` | Registrar agente no runtime (cria registro `agentes_runtime`, não chama Hermes CLI imediatamente) |
| `PATCH /api/agentes-runtime/:id` | `requirePermission('agente:update')` | Atualizar configuração; pode disparar CLI `profile create/pause/resume/terminate` se `trigger_hermes` for true |
| `DELETE /api/agentes-runtime/:id` | `requirePermission('agente:delete')` | Encerrar agente; dispara CLI `terminate` e registra `agent_lifecycle_events` |

### 2.2 Rotas de Skills e Catálogo

| Método | Endpoint | Gate | Descrição |
|---|---|---|---|
| `GET /api/skills-catalog` | `requirePermission('skill:read')` | Listar skills do catálogo versionado |
| `POST /api/skills-catalog` | `requirePermission('skill:create')` | Registrar nova skill no catálogo (manifest JSONB, source, source_ref) |
| `PATCH /api/skills-catalog/:id` | `requirePermission('skill:update')` | Atualizar skill (versionamento, manifest) |
| `POST /api/skills-catalog/:id/reconcile` | `requirePermission('skill:reconcile')` | Executar reconcile engine: comparar manifest no catalogo vs runtime Hermes; reportar CURRENT/OUTDATED/MODIFIED/REMOVED/FOREIGN |

### 2.3 Rotas de Tarefas e Hierarquia

| Método | Endpoint | Gate | Descrição |
|---|---|---|---|
| `GET /api/tarefas` | `requirePermission('tarefa:read')` | Listar tarefas com filtros (status, assigned_agent, deadline) |
| `POST /api/tarefas` | `requirePermission('tarefa:create')` | Criar tarefa; `parent_task_id` opcional para hierarquia |
| `GET /api/tarefas/:id` | `requirePermission('tarefa:read')` | Obter tarefa com `parent_task_id` e `child_tasks` |
| `PATCH /api/tarefas/:id` | `requirePermission('tarefa:update')` | Atualizar tarefa; `assigned_agent_id`, `progress`, `deadline` |
| `DELETE /api/tarefas/:id` | `requirePermission('tarefa:delete')` | Excluir tarefa; atualiza `task_hierarchy` |

### 2.4 Rotas de Execuções e Heartbeats

| Método | Endpoint | Gate | Descrição |
|---|---|---|---|
| `POST /api/execucoes` | `requirePermission('execucao:create')` | Criar execução; `hermes_execution_id` gerado localmente; `status` inicial `QUEUED` |
| `GET /api/execucoes` | `requirePermission('execucao:read')` | Listar execuções com filtros (status, task_hierarchy_id, cost_cents range) |
| `GET /api/execucoes/:id` | `requirePermission('execucao:read')` | Obter execução com `logs`, `heartbeat_at`, `cost_cents` |
| `POST /api/execucoes/:id/heartbeat` | `requirePermission('execucao:heartbeat')` | Atualizar `heartbeat_at`; Hermes CLI ou orquestração própria responde |
| `POST /api/execucoes/:id/cancel` | `requirePermission('execucao:cancel')` | Cancelar execução; atualiza `status` para `CANCELLED`; registra evento |
| `GET /api/custos/resumo` | `requirePermission('custo:read')` | Resumo orçamentário: `amount_cents - spent_cents = restante`; `alert_threshold_pct` notification status |

### 2.3 Rotas de Aprovações e Governança

| Método | Endpoint | Gate | Descrição |
|---|---|---|---|
| `GET /api/approvals` | `requirePermission('aprovacao:read')` | Listar aprovações pendentes |
| `POST /api/approvals` | `requirePermission('aprovacao:create')` | Criar aprovação para recurso (project/task/execution/agent) |
| `POST /api/approvals/:id/approve` | `requirePermission('aprovacao:approve')` | Aprovar; `votes++`; `decided_at`; `audit_log` registrado |
| `POST /api/approvals/:id/reject` | `requirePermission('aprovacao:reject')` | Rejeitar; `votes++`; `decided_at`; `audit_log` registrado |
| `POST /api/approvals/:id/revision` | `requirePermission('aprovacao:revision') | Solicitar revisão; `votes++`; `decided_at`; `audit_log` registrado |

### 2.4 Rotinas e Automações

| Método | Endpoint | Gate | Descrição |
|---|---|---|---|
| `GET /api/rotinas` | `requirePermission('rotina:read')` | Listar rotinas ativas |
| `POST /api/rotinas` | `requirePermission('rotina:create')` | Criar rotina com `cron`, `trigger_type`, `definition jsonb` |
| `POST /api/rotinas/:id/trigger` | `requirePermission('rotina:trigger')` | Disparar rotina agora (em vez de esperar próximo cron) |
| `POST /api/rotinas/:id/cancel` | `requirePermission('rotina:cancel')` | Cancelar rotina em curso; `active` = false |

### 2.4 Conectores

| Método | Endpoint | Gate | Descrição |
|---|---|---|---|
| `GET /api/connectores` | `requirePermission('conector:read')` | Listar conectores registrados |
| `POST /api/connectores` | `requirePermission('conector:create')` | Registrar conector (type, config jsonb) |
| `POST /api/connectores/:id/trigger` | `requirePermission('conector:trigger')` | Executar conector agora (chama Hermes CLI ou HTTP target) |

### 2.5 Usuários por Empresa

| Método | Endpoint | Gate | Descrição |
|---|---|---|---|
| `GET /api/empresa-usuarios` | `requirePermission('empresa:read')` | Listar usuários por empresa com role |
| `PATCH /api/empresa-usuarios/:id` | `requirePermission('empresa:update')` | Atualizar role e permissões de usuário |

---

## 3. Integração com Hermes — Ponte Backend ↔ CLI

A arquitetura-alvo não tenta substituir o Hermes, mas define uma ** ponte controlada**:

| Operação Hermes CLI | Ponte Backend | Observação |
|---|---|---|
| `profile create <slug> --no-skills` | `POST /api/agentes-runtime` (com `trigger_hermes: true`) | O backend registra `agentes_runtime` e, opcionalmente, dispara o CLI; se CLI falhar, o registro persiste igual; `activeTokens` Map não é mais a fonte única de truth |
| `profile pause <id>` | `PATCH /api/agentes-runtime/:id` (com `trigger_hermes: true`) | Iguais; `life_cycle_state` updateado para `OUTDATED`/`PAUSED` |
| `profile terminate <id>` | `DELETE /api/agentes-runtime/:id` (com `trigger_hermes: true`) | Iguais; `life_cycle_state` = `REMOVED`; `agent_lifecycle_events` registrado |
| `kanban create` | `POST /api/routinas` (com `trigger_type: MANUAL`) | Rotinas substituem kanban; `cron` field pode ser `null`; `MANUAL` dispara imediatamente |
| `runtime-api` queries | `GET /api/execucoes/:id` + `POST /api/execucoes/:id/heartbeat` | O backend lida com o estado; se Hermes CLI estiver disponível, pode delegar a ele; caso contrário, orquestração própria mantém o estado |
| `getStatus()` | `GET /api/health` (já existente) | `hermesGateway.getStatus()` permanece; mas agora `configured` reflete se as credenciais/CLI estão disponíveis, não hardcode `true` |

> **Nota:** Quando `trigger_hermes` for `false` ou o CLI não estiver disponível, o backend mantém o estado internamente (`agentes_runtime`, `executions`, `task_hierarchy`, etc.). Isso permite que a aplicação opere em ambientes sem o Hermes CLI (ex.: Cloudflare deployment, containers) enquanto mantém funcionalidade completa em ambientes de dev/produção com Hermes.

---

## 4. Integração Supabase — Migração de `useSupabase = false` para `true`

Atualmente `useSupabase` depende de três variáveis de ambiente ausentes do `.env`:

1. `SUPABASE_URL` — presente no `.env` (já verificado)
2. `SUPABASE_ANON_KEY` — presente no `.env` (já verificado)
3. `SUPABASE_SERVICE_ROLE_KEY` — **ausente**; necessário para `useSupabase = true` e para que as RLS policies tenham efeito

**Passo de migração:**

1. **Obter** `SUPABASE_SERVICE_ROLE_KEY` do painel Supabase ou administrador de projeto
2. **Adicionar** ao `.env` (nunca commitar em repositório público; usar GitHub Secrets no CI)
3. **Executar** nova migration que popula as tabelas estendidas (empresas, agentes_runtime, etc.) a partir dos dados existentes ou de seed inicial
4. **Definir** `role` e `permissions` para `empresa_usuario` para cada usuário/empresa
5. **Testar** que as RLS policies agora têm efeito (anteriormente `using (true)` ignorava tudo)

> **Segurança:** `SUPABASE_SERVICE_ROLE_KEY` deve ser tratado como segredo de nível máximo; nunca commitar em código; usar GitHub Actions secrets ou Vault no produção.

---

## 5. Frontend — Correções de UX e Funcionalidade

As correções já iniciadas em ETAPA 8 (S3: admin tokens now sent) devem ser estendidas:

1. **Toasts visuais:** Corrigir `APP:175-178` / `428-433` — `console.log('[toast]', msg)` deve renderizar `Toast` component com `role="alert"`, `aria-live="polite"`
2. **Drawers populados:** 
   - `TasksPage`: `taskDetail` estado vindo do `tasks` store, não `null` initial
   - `AgentsPage`: drawer populado com `agente` do `HermesBotDto` + `life_cycle_state` do `agentes_runtime`
3. **Estado preservado na navegação:** 
   - `taskInitialId` salvo no `sessionStorage` e restaurado ao trocar rota
   - `chatInitialRef` similar
4. **Acessibilidade:**
   - `<tr onClick>` → `<tr role="row">` com `<button role="listitem">` Inside ou uso de `<details>`;
   - Ícones `aria-label` descriptivo;
   - `SlideDrawer` focus-trap via `useFocusTrap`; close por `Escape` já existe mas precisa testar foco inicial;
5. **Rotas perdem estado:** 
   - `useLocation` + `useEffect` para salvar estado antes de `navigate()`
   - `beforeUnload` prompt opcional se há dados não salvos

---

## 6. Roadmap de Implementação (resumo)

A entrega dos 5 artefatos solicitados inclui um roadmap em `ROADMAP_IMPLEMENTACAO_CONTROL_PLANE.md` (a ser criado). As fases principais:

| Fase | Foco | Dependências | Critério de Conclusão |
|---|---|---|---|
| **Fase 1: Dados e Modelo** | Criar novas migrations (empresas, agentes_runtime, skills_catalog, task_hierarchy, executions, approvals, routines, connectors, budgets, audit_log, empresa_usuario); populating inicial | Acesso a `SUPABASE_SERVICE_ROLE_KEY`; seed de dados inicial | Migrations aplicadas; `useSupabase = true`; dados populados nas novas tabelas |
| **Fase 2: Backend APIs** | Implementar endpoints listados em seção 2; conectar com Hermes CLI ponte (trigger_hermes flag); `appendAuditFn` usage ativo; `persistState` atomic write | Fase 1 concluída; acesso ao código fonte | Todos os endpoints listados respondendo com HTTP 200/201; testes de contrato passando |
| **Fase 3: Frontend UX** | Corrigir toasts, drawers, navegação, acessibilidade; conectar novos endpoints via `api.ts` (já corrigido S3); remover `console.log('[toast]')` | Fase 2 concluída; componentes UI disponíveis | UX passauditoria: toasts visíveis, drawers populados, navegação preserva estado, acessibilidade AA/AAA |
| **Fase 4: Hermes Ponte** | Implementar lógica `trigger_hermes` nos endpoints de agente/runtime; testar com e sem CLI disponível; garantir graceful degradation | Fase 2 concluída; CLI Hermes disponível em ambiente de teste | Funcionalidade completa com CLI; operação gracefull sem CLI; `configured: true` reflete realidade |
| **Fase 5: Testes e Homologação** | Battery de testes end-to-end; lint/typecheck/build limpos; homologação `APROVADO` (sem ressalvas) | Todas as fases concluídas; cobertura de teste ≥ 80% | `npm run lint` limpo; `npm run build` limpo; `npx vitest run` com env configurado passando; homologação final |

---

## 7. Transição de Papelidade para Independência

| Aspecto | Paperclip → TokenizAi V2 | Independência Alcançada |
|---|---|---|
| **Organizações/Empresas** | Modelos simplificados (`departamentos` isolados) → `empresas` + `departamentos` hierárquicos com `empresa_id` | ✅ Nova modelagem proposta; depende de migration + dados |
| **Agentes com Lifecycle** | Apenas cadastro estático → `agentes_runtime` com `life_cycle_state` + `hermes_agent_id` + `agent_lifecycle_events` | ✅ Estrutura proposta; operação depende de Hermes CLI ou orquestração própria |
| **Skills** | Catálogo achatado (12→283 fixa) → `skills_catalog` versionado com manifest, reconcile engine | ✅ Estrutura proposta; dados dependem de catálogo externo ou agency-agents fork |
| **Tarefas com Hierarquia** | Tasks planas, parser achatado → `task_hierarchy` com parent/child; progress; deadline | ✅ Estrutura proposta; dado operacional pendente |
| **Execuções com Heartbeats** | Execuções planas, cancelamento sem efeito → `executions` com status, heartbeat, cost_cents, logs | ✅ Estrutura proposta; dado operacional pendente |
| **Aprovações** | Desativadas + EmptyState → `approvals` com votes, QA Gate, audit_log | ✅ Estrutura proposta; depende de definir fluxo de aprovação organizacional |
| **Rotinas** | `parseCronList → []`, sucesso-falso → `routines` com `trigger_type enum`, `execution_limit`, `definition jsonb` | ✅ Estrutura proposta; depende de definir tipos cron e triggers |
| **Orçamentos/Custos** | "Teto Mensal = gasto" (enganoso); `budgetMonthlyCents: null` → `budgets` com `amount_cents`, `spent_cents`, `alert_threshold_pct` | ✅ Estrutura proposta; dado operacional pendente |
| **Conectores** | Ausente no backend; capabilities anunciadas mas não registradas → `connectors` table + endpoint `/api/connectores` | ✅ Estrutura proposta; endpoint a implementar |
| **Auditoria** | `appendAudit` unused + `enterprise.auditLogs` derivado de mutações cegas → `audit_log` estruturado; `ip`, `session_token`, `old_values/new_values` | ✅ Estrutura proposta; `appendAuditFn` deixará de ser unused |
| **Autenticação/RBAC** | RLS `using (true)` amplo; admin tokens never sent (corrigido); founder e-mail fixo → `empresa_usuario` com `role` (ADMIN/MANAGER/OPERATOR/VIEWER) + `permissions jsonb`; admin tokens now sent (ETAPA 8) | ✅ Modelo proposto; depende de `SUPABASE_SERVICE_ROLE_KEY` + migração de dados |
| **Frontend UX** | Toasts invisíveis, drawers vazios, navegação perde estado → toasts visíveis, drawers populados, estado preservado, acessibilidade AA | ✅ Correições ETAPA 8 (S3) + correções propostas aqui |

> **Resumo:** A arquitetura-alvo torna a TokenizAi **arquiteturalmente capaz** de entregar funcionalidades equivalentes ao Paperclip, mas a **implementação requer**:
> - Acesso a `SUPABASE_SERVICE_ROLE_KEY` para migrar dados para o novo modelo
> - Implementação de ~11 novas migrations Drizzle
> - ~25 novos endpoints backend
> - Correções UX no frontend (já iniciadas em ETAPA 8)
> - Definição de fluxos operacionais (aprovações, triggers, etc.)
> - Testes end-to-end para homologação

> **Independência do Paperclip:** Após a implementação da Fase 1, a TokenizAi não dependerá mais do Paperclip para nenhuma das funcionalidades críticas. O Hermes continuará como runtime, mas as operações de organização, governança, persistência e UI serão de propriedade exclusiva da TokenizAi.

---
<tool_call>
<function=todowrite>
<parameter=todos>
[{"content": "ETAPA 1-7 - Concluídas: auditoria completa, correções aplicadas, homologação", "status": "completed"}, {"content": "ETAPA 8 - Correções: api.ts (S3) + audit-visual.spec.ts (S9)", "status": "completed"}, {"content": "ETAPA 9 - Artefato 1: AUDITORIA_COMPARATIVA_PAPERCLIP_TOKENIZAI.md - CONCLUÍDO", "status": "completed"}, {"content": "ETAPA 9 - Artefato 2: MATRIZ_EQUIVALENCIA_FUNCIONAL.md - CONCLUÍDO", "status": "completed"}, {"content": "ETAPA 9 - Artefato 3: CONCILIACAO_271_AGENTES.md - CONCLUÍDO", "status": "completed"}, {"content": "ETAPA 9 - Artefato 4: ARQUITETURA_ALVO_CONTROL_PLANE_TOKENIZAI.md - CONCLUÍDO", "status": "completed"}, {"content": "ETAPA 9 - Artefato 5: ROADMAP_IMPLEMENTACAO_CONTROL_PLANE.md", "status": "in_progress"}]