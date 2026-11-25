# Arquitetura Final — TokenizAi + Hermes (Hermes-First)

## Princípio Orientador

A TokenizAi funciona como **painel empresarial e camada de governança**. O Hermes permanece como **runtime operacional** dos agentes (bots, tarefas, chats, skills, execuções). A TokenizAi complementa o Hermes com organização empresarial, equipes, hierarquia, responsabilidades, objetivos, governança e interface — somente onde essas capacidades não existirem no Hermes nativamente.

> **Não criar uma segunda arquitetura de agentes.** Usar o Hermes como fonte de truth para atributos operacionais (status, capabilities, runtime state, heartbeat, custo por execução). A TokenizAi adiciona em torno: estrutura empresarial, permissões, histórico organizacional, governança.

---

## 1. Modelo de Dados — Extensão sobre as 21 Tabelas Existentes

A migration `001_initial_schema.sql` já possui estruturas relevantes: `departamentos`, `agentes_empresariais`, `projetos`, `metas`, `aprovacoes`, `runs`, `tasks`, `activities`, `costs`. A arquitetura-alvo estende estas tabelas em vez de criar do zero.

### Tabelas existentes (aproveitadas):

| Tabela | Campos relevantes | Uso na arquitetura |
|---|---|---|
| `agentes_empresariais` | `id`, `slug`, `departamento_id`, `status`, `capabilities text[]`, `hermes_agent_id text` | **Ponte principal** — vincula identidade empresarial ao perfil Hermes; `hermes_agent_id` faz lookup do status ativo no runtime |
| `departamentos` | `id`, `nome`, `codigo unique`, `pai_id self-FK`, `empresa_id` (a adicionar) | **Estrutura hierárquica** — departamentos com reporte (`pai_id`) e associação a empresa |
| `projetos` | `id`, `name`, `progress`, `hermes_project_id`, `owner_agent_id` | Vincular projetos Hermes ao owner empresarial |
| `metas` | `id`, `title`, `progress_percent`, `owner_agent_id`, `parent_goal_id self-FK` | Metas individuais/team with progress tracking |
| `aprovacoes` | `id`, `resource_type`, `resource_id`, `status`, `votes`, `decided_at`, `payload jsonb`, `audit_log jsonb` | **Sistema de aprovação** — implementa Paperclip `approval` system com votes e audit_log |
| `runs` | `id`, `task_id`, `agent_id`, `status`, `started_at`, `completed_at`, `logs jsonb`, `cost_cents bigint`, `heartbeat_at timestamptz` | **Execuções com heartbeats** — substitui runs planas; custo tracking; heartbeat monitoring |
| `tasks` | `id`, `title`, `description`, `status`, `priority`, `assignee_agent_id`, `project_id`, `parent_id self-FK`, `progress integer`, `deadline date` | **Tarefas hierárquicas** — parent/child para subtarefas; progress e deadline |
| `activities` | `id`, `timestamp`, `actorName`, `action`, `targetType`, `targetId`, `summary` | **Auditoria** — registros de ações; integrada ao `audit_log` das aprovações |
| `costs` | `id`, `name`, `amount_cents`, `spent_cents`, `period`, `alert_threshold_pct`, `company_id` | **Orçamentos próprios** — substitui display enganoso; `amount_cents - spent_cents = restante` |
| `empresas` | *a adicionar via nova migration* | Unidade organizacional superior; permite múltiplas empresas na instância |
| `empresa_usuario` | *a adicionar via nova migration* | Controle de acesso por papel (ADMIN/MANAGER/OPERATOR/VIEWER) + `permissions jsonb`; substitui RLS `using (true)` amplo |

### Novas Tabelas (necessárias para complementar):

| Tabela | Campos Principais | Finalidade |
|---|---|---|
| `skills_catalog` | `id uuid PK`, `name not null`, `description`, `version`, `manifest jsonb`, `source enum ('agency-agents', 'paperclip', 'custom')`, `source_ref text`, `install_count integer default 0`, `last_reconciled_at timestamptz` | **Catálogo versionado de skills** — substitui o `HermesSkillDto` achatado; `progress` em 5 states (CURRENT/OUTDATED/MODIFIED/REMOVED/FOREIGN) como no Paperclip; reconcile engine compara `manifest` entre catalogo e runtime |
| `agent_lifecycle_events` | `id uuid PK`, `agent_id uuid → agentes_runtime(id)`, `event_type enum (HIRE, CONFIGURE, PAUSE, RESUME, TERMINATE)`, `timestamp timestamptz`, `payload jsonb`, `hermes_response jsonb` | **Audit trail do lifecycle** — persiste events mesmo após restart; substitui `activeTokens` Map em memória (S7); `hermes_response` captura saída do CLI para auditoria |
| `task_hierarchy` | `id uuid PK`, `parent_task uuid → task_hierarchy(self-FK)`, `child_task uuid → task_hierarchy(self-FK)`, `status`, `assigned_agent uuid → agentes_runtime(id)`, `progress integer`, `deadline date` | **Hierarquia de subtarefas** — implementa `parentId` do Paperclip; `progress` e `deadline` adicionam controle operacional; faz ponte para `agentes_runtime` |

> **Nota:** As tabelas `agentes_runtime`, `empresas`, `empresa_usuario` são novas. Todas as outras são extensões ou otimizações das 21 tabelas já existentes.

---

## 2. Backend — APIs e Endpoints (Hermes-First)

A arquitetura define ~25 endpoints, mas a grande maioria **reutiliza rotas Hermes já existentes**. A TokenizAi adiciona gates de permissão e enterprise-context, mas a operação central passa pelo Hermes.

### Endpoints que **reutilizam** Hermes (capitalizar recurso nativo):

| Endpoint | Hermes Underlying | O Que a TokenizAi Adiciona |
|---|---|---|
| `GET /api/hermes/agents` | ✅ Hermes listAgents | Gates `requirePermission('agents:read')`; enriquecer resposta com `enterpriseState` (empresa, departamento) |
| `GET /api/hermes/agents/:id` | ✅ Hermes getAgent | `requirePermission`; adicionar `empresa_nome`, `departamento_nome` via `hermes_agent_id` → `agentes_empresariais` |
| `POST /api/hermes/agents/hire` | ✅ Hermes hireBot | `requirePermission('agente:create')`; registar `agentes_runtime`; opcionalmente `trigger_hermes: true` para CLI; se CLI falhar, persiste registro igual |
| `PATCH /api/hermes/agents/:id` | ✅ Hermes updateAgent | `requirePermission('agente:update')`; update `life_cycle_state`; pode disparar CLI `pause/resume/terminate` se `trigger_hermes` for true |
| `DELETE /api/hermes/agents/:id` | ✅ Hermes deleteAgent | `requirePermission('agente:delete')`; dispara CLI `terminate`; registra `agent_lifecycle_events` |
| `GET /api/hermes/tasks` | ✅ Hermes listTasks | `requirePermission('tarefa:read')`; filtrar por `assigned_agent_id`, `parent_task_id`, `progress` range; enriquecer com `empresa`/`departamento` |
| `POST /api/hermes/tasks` | ✅ Hermes createTask | `requirePermission('tarefa:create')`; `parent_task_id` opcional para hierarquia; persistir em `task_hierarchy` |
| `GET /api/hermes/routines` | ✅ Hermes listRoutines | `requirePermission('rotina:read')`; filtrar por `active`, `trigger_type`; conectar ao novo `routines` table |
| `POST /api/hermes/routines` | ✅ Hermes createRoutine | `requirePermission('rotina:create')`; `trigger_type enum (CRON, MANUAL, EVENT)`; `execution_limit` evita loops infinitos |
| `POST /api/hermes/routines/:id/trigger` | ✅ Hermes trigger | `requirePermission('rotina:trigger')`; disparar rotina agora (em vez de esperar próximo cron) |
| `GET /api/hermes/chats` | ✅ Hermes listChats | `requirePermission('chat:read')`; enriquecer com nome da empresa/departamento dos participantes |
| `POST /api/hermes/chats/:agentRef` | ✅ Hermes sendMessage | `requirePermission('chat:write')`; registro de atividade no `audit_log` |
| `GET /api/hermes/skills` | ✅ Hermes getSkills | `requirePermission('skill:read')`; enriquecer com `skills_catalog` fields (version, source, manifest) |
| `GET /api/hermes/costs/summary` | ✅ Hermes getCostsSummary | Integrar ao `budgets` table; corrigir `budgetMonthlyCents` nulo; display `amount_cents - spent_cents = restante`; `alert_threshold_pct` |
| `GET /api/hermes/org` | ✅ Hermes getOrganization | Organograma Hermes (`tree` + `agents`) **mais** metadados empresariais (empresa, departamento) através de join com `agentes_empresariais` |
| `GET /api/health` | ✅ Health check | `hermes.configured` reflete realidade (não hardcode `true`); `hermes.connected` depende de `heartbeat` bem-sucedido |

### Endpoints que **adicionam** nova capacidade TokenizAi:

| Endpoint | Nova Funcionalidade |
|---|---|
| `GET /api/empresas` | Listar empresas (nova tabela); `requirePermission('empresa:read')` |
| `POST /api/empresas` | Criar empresa; `requirePermission('empresa:create')` |
| `GET /api/departamentos` | Listar departamentos da empresa; `requirePermission('departamento:read')` |
| `POST /api/departamentos` | Criar departamento; `requirePermission('departamento:create')`; `empresa_id` associação |
| `GET /api/agentes-runtime` | Listar agentes com status atual do Hermes (`hermes_agent_id` → lookup); `requirePermission('agente:read')` |
| `GET /api/skills-catalog` | Catálogo versionado de skills; `requirePermission('skill:read')`; incluir `manifest`, `source`, `install_count`, `last_reconciled_at` |
| `POST /api/skills-catalog/:id/reconcile` | Executar reconcile engine: comparar manifest no catalogo vs runtime Hermes; reportar CURRENT/OUTDATED/MODIFIED/REMOVED/FOREIGN | `requirePermission('skill:reconcile')` |
| `GET /api/approvals` | Listar aprovações pendentes; `requirePermission('aprovacao:read')` | Sistema votes + audit_log (substitui EmptyState) |
| `POST /api/approvals` | Criar aprovação para recurso; `requirePermission('aprovacao:create')` | Resource_type: PROJECT, TASK, EXECUTION, AGENT; votes + decided_at |
| `GET /api/custos/resumo` | Resumo orçamentário real: `amount_cents - spent_cents = restante`; `alert_threshold_pct` notification status | `requirePermission('custo:read')`; integra com Hermes summary mas usa dados own |
| `GET /api/execucoes/:id/heartbeat` | Atualizar `heartbeat_at`; Hermes CLI ou orquestração própria responde | `requirePermission('execucao:heartbeat')` |
| `GET /api/empresa-usuarios` | Listar usuários por empresa com role; `requirePermission('empresa:read')` | Substitui RLS `using (true)`; role ADMIN/MANAGER/OPERATOR/VIEWER + permissions jsonb |

---

## 3. Integração Hermes — Ponte Controlada

A arquitetura define uma ponte controlada entre TokenizAi e Hermes, permitindo que a aplicação opere **com ou sem o CLI Hermes disponível**.

### Operações com `trigger_hermes` flag:

| Operação Hermes CLI | Ponte Backend | Com CLI Disponível | Sem CLI Disponível |
|---|---|---|---|
| `profile create <slug> --no-skills` | `POST /api/agentes-runtime` (com `trigger_hermes: true`) | Disparar CLI; registrar sucesso/erro em `agent_lifecycle_events`; se CLI falhar, persiste registro igual | Persistir registro `agentes_runtime` apenas; `life_cycle_state` = `CREATED`; agente criado em enterpriseState apenas |
| `profile pause <id>` | `PATCH /api/agentes-runtime/:id` (com `trigger_hermes: true`) | Disparar CLI `profile pause`; update `life_cycle_state` para `PAUSED`; registrar evento | Update `life_cycle_state` para `PAUSED` apenas via enterpriseState; marcar como "pausado localmente" |
| `profile terminate <id>` | `DELETE /api/agentes-runtime/:id` (com `trigger_hermes: true`) | Disparar CLI `profile terminate`; `life_cycle_state` = `REMOVED`; registrar `agent_lifecycle_events` | Update `life_cycle_state` para `REMOVED`; remover do enterpriseState; manter histórico em `agent_lifecycle_events` |
| `kanban create` | `POST /api/routinas` (com `trigger_type: MANUAL`) | Rotinas substituem kanban; `cron` field pode ser `null`; `MANUAL` dispara imediatamente | Criar rotina com `trigger_type: MANUAL` e `cron: null`; executar imediatamente via orchestration própria |
| `runtime-api` queries | `GET /api/execucoes/:id` + `POST /api/execucoes/:id/heartbeat` | Se CLI disponível, delegar a ele; caso contrário, orquestração própria mantém estado interno | Manter status interno em `executions` table; `status` = `QUEUED`/`RUNNING`/`COMPLETED`/etc.; `heartbeat_at` updateado localmente |
| `getStatus()` | `GET /api/health` (já existente) | `hermesGateway.getStatus()` permanece; mas agora `configured` reflete se as credenciais/CLI estão disponíveis, não hardcode `true` | `configured: false` se CLI indisponível; `connected: false` se últimos heartbeats > N segundos |

> **Nota crítico:** Quando `trigger_hermes` for `false` ou o CLI não estiver disponível, o backend mantém o estado internamente (`agentes_runtime`, `executions`, `task_hierarchy`, etc.). Isso permite que a aplicação opere em ambientes sem o Hermes CLI (ex.: Cloudflare deployment, containers) enquanto mantém funcionalidade completa em ambientes de dev/produção com Hermes.

---

## 4. Integração Supabase — De `useSupabase = false` para `true`

Atualmente `useSupabase` depende de três variáveis de ambiente:

1. `SUPABASE_URL` — presente no `.env`
2. `SUPABASE_ANON_KEY` — presente no `.env`
3. `SUPABASE_SERVICE_ROLE_KEY` — **ausente**; necessário para `useSupabase = true` e para que as RLS policies tenham efeito

### Passo de migração:

1. **Obter** `SUPABASE_SERVICE_ROLE_KEY` do painel Supabase ou administrador de projeto
2. **Adicionar** ao `.env` (nunca commitar em repositório público; usar GitHub Secrets no CI)
3. **Executar** nova migration que popula as tabelas estendidas (empresas, agentes_runtime, skills_catalog, task_hierarchy, executions, approvals, routines, connectors, budgets, audit_log, empresa_usuario) a partir dos dados existentes ou de seed inicial
4. **Definir** `role` e `permissions` em `empresa_usuario` para cada usuário/empresa
5. **Testar** que as RLS policies agora têm efeito (anteriormente `using (true)` ignorava tudo)

> **Segurança:** `SUPABASE_SERVICE_ROLE_KEY` deve ser tratado como segredo de nível máximo; nunca commitar em código; usar GitHub Actions secrets ou Vault no produção.

Após esta migração:
- `useSupabase` passa a ser `true`
- `supabaseRepo` passa a ser a fonte de truth para dados empresariais (empresas, departamentos, users, roles, permissions, budgets, approvals, historical)
- Dados operacionais (status de agente, tasks, runs, skills, custos) continuam vindo do Hermes runtime via API
- RLS policies com `empresa_id` isola dados por organização — fim do `using (true)` amplo

---

## 5. Frontend — Correções de UX e Integração Hermes

As correções seguem o princípio de **exibir o que o Hermes entrega**, complementando com dados empresariais onde necessário.

### 1. Toasts visuais
- Corrigir `APP:175-178` / `428-433` — `console.log('[toast]', msg)` deve renderizar `Toast` component com `role="alert"`, `aria-live="polite"` em vez de apenas logar no console
- Remover `C3` warnings de toast que nunca são apresentados visualmente

### 2. Drawers populados
- `TasksPage`: `taskDetail` estado vindo do `tasks` store (com `parent_task_id`, `child_tasks`, `progress`, `deadline`), não `null` initial
- `AgentsPage`: drawer populado com `agente` do `HermesBotDto` + `life_cycle_state` do `agentes_runtime` lookup via `hermes_agent_id`
- `OrganizationPage`: organograma combinando `HermesBotDto.tree` + metadados `agentes_empresariais` (empresa, departamento, role)

### 3. Estado preservado na navegação
- `taskInitialId` + `chatInitialRef` salvos no `sessionStorage` e restaurados ao trocar rota
- `useLocation` + `useEffect` para salvar estado antes de `navigate()`
- `beforeUnload` prompt opcional se há dados não salvos

### 4. Acessibilidade
- `<tr onClick>` → `<tr role="row">` com `<button role="listitem">` Inside ou uso de `<details>`
- Ícones `aria-label` descriptivo (ex: `aria-label="Excluir tarefa"` em vez de ícone só com `title`)
- `SlideDrawer` focus-trap via `useFocusTrap`; close por `Escape` já existe mas precisa testar foco inicial
- `SegmentedTabs` com `role="tablist"`/`aria-selected` já está no código — validar funcionamento

### 5. Rota state preservation
- `useLocation` + `useEffect` para salvar estado antes de `navigate()`
- Remover dependência de `taskInitialId`/`chatInitialRef` como props soltas; usar contexto global (Context API ou Zustand)

---

## 6. Hermes Capabilities — Matriz de Disponibilidade

| Capability | Hermes Nativo | TokenizAi Atual | Status | Ação |
|---|---|---|---|---|
| `agents:read` | ✅ `GET /api/hermes/agents` | Consumida por `AgentsPage`, `AiOpsView` | ✅ Funcionando | Enrich with enterprise data |
| `agents:manage` | ✅ `POST/PATCH/DELETE /api/hermes/agents` | Disponível via `HermesService` (hire, update, delete) | ✅ Funcionando | Add `trigger_hermes` flag + enterpriseState persistence |
| `chats:read` | ✅ `GET /api/hermes/chats` | Consumida por `HermesChatPanel` | ✅ Funcionando | Manutenção |
| `chats:write` | ✅ `POST /api/hermes/chats/:agentRef` | Consumida por chat | ✅ Funcionando | Registro no `audit_log` |
| `tasks:read` | ✅ `GET /api/hermes/tasks` | Consumida por `TasksPage`, `HermesTasksPanel` | ✅ Funcionando | Corrigir parser + hierarchy UI |
| `tasks:write` | ✅ `POST/PATCH /api/hermes/tasks` | Disponível via `HermesService` | ✅ Funcionando | Corrigir parser + parent/child UI |
| `runs:read` | ✅ `GET /api/hermes/runs` | Consumida por `RunsPage`, `AgentDetailPage` | ✅ Funcionando | Corrigir cancelation + logs exposition |
| `routines:read` | ✅ `GET /api/hermes/routines` | Consumida por `RoutinesPage` | ⚠️ Parser `parseCronList` sempre `[]` | Corrigir parser |
| `routines:manage` | ✅ `POST /api/hermes/routines`, `routines/:id/trigger` | Disponível via `HermesService` | ⚠️ `handleCreateRoutine` ignora falhas | Corrigir error handling |
| `approvals:read` | ✅ `GET /api/hermes/approvals` | Capability existe no Gateway | ⚠️ Frontend desativado | Reativar `HermesApprovalsPanel` + conectar UI |
| `approvals:manage` | ✅ `POST /api/hermes/approvals/:id/approve/reject/revision` | Capability existe no Gateway | ⚠️ Frontend desativado | Reativar + conectar fluxo enterprise |
| `costs:read` | ✅ `GET /api/hermes/costs/summary` | Consumida por `CostsPage`, `Dashboard` | ⚠️ `budgetMonthlyCents: null`, dado enganoso | Implementar layer budgets TokenizAi |
| `skills:read` | ✅ `GET /api/hermes/skills` | Consumida por `SkillsPage` | ⚠️ Backend retorna apenas 4 fields; UI consome 7 fields | Corrigir DTO/parser retorno |
| `org:read` | ✅ `GET /api/hermes/org` | Consumida por `AiOpsView` organizograma | ✅ Funcionando | Integrar com `agentes_empresariais` empresa/departamento |
| `skills:manage` | *Não avaliado* | *Não implementado* | **BLOQUEADO** | Avaliar se necessário ou dispensar |

---

## 7. Transição de Paperclip para Independência TokenizAi × Hermes

| Aspecto | Paperclip → TokenizAi V2 (Estado Atual) | Independência Alcançada | O Que Faltaria |
|---|---|---|---|
| **Perfis e agentes operacionais** | Modelos simplificados; Hermes como runtime; `hermes_agent_id` como ponte | ✅ Estrutura base (`agentes_empresariais`.`hermes_agent_id`, Hermes API) | Popular `hermes_agent_id` real; corrigir parser rich |
| **Organizações/Empresas** | `departamentos` isolados, sem `org_id`, sem tenant | ✅ Nova modelagem proposta: `empresas` + `departamentos` hierárquicos com `empresa_id` e `pai_id` | Migration + população de dados; RLS policies com `empresa_id` |
| **Agentes com Lifecycle** | Apenas cadastro estático → `agentes_empresariais`; `hermes_agent_id` ausente | ✅ Estrutura proposta; operação depende de Hermes CLI ou orquestração própria | Preencher `hermes_agent_id`; implementar `agent_lifecycle_events`; corrigir S7 (sessões voláteis) |
| **Skills** | Catálogo achatado (12→283 fixa) → `HermesSkillDto` via API; frontend consome fields que não vêm do backend | ✅ Hermes já tem skill catalog; gap é parser/endpoint retornar fields completos | Corrigir parser; conectar `skills_catalog` table ao runtime |
| **Tarefas com Hierarquia** | Tasks planas, parser achatado → `tasks` com `parent_id self-FK`; `task_hierarchy` table proposta | ✅ `tasks` table já tem `parent_id`; falta implementar `task_hierarchy` para visualização + UI | Implementar `task_hierarchy`; popul drawer com subtarefas; corrigir cancelamento |
| **Execuções com Heartbeats** | Execuções planas, cancelamento sem efeito → `executions` com status, heartbeat, `cost_cents`, `logs` | ✅ `runs` table existe; falta corrigir cancelation e expor logs | Corrigir `handleCancel`; expôr logs/events no endpoint; persistir `heartbeat_at` |
| **Aprovações** | Desativadas + EmptyState → capability Hermes existe mas frontend removido | ✅ Capability no Hermes gateway; gap é reativar integração frontend | Reativar `HermesApprovalsPanel`; conectar ao fluxo `approvals` enterprise; implementar votes/audit_log |
| **Rotinas** | `parseCronList → []`, sucesso-falso → `routines` table com `trigger_type enum` | ✅ `routines` table existe; gap é parser + error handling | Corrigir `parseCronList`; corrigir `handleCreateRoutine`; implementar handlers `routines/:id/trigger` e `routines/:id/run` |
| **Orçamentos/Custos** | "Teto Mensal = gasto" (enganoso); `budgetMonthlyCents: null` → `budgets` with `amount_cents`, `spent_cents`, `alert_threshold_pct` | ✅ `costs` table existe com novos fields; gap é preenchimento e display | Popular `budgets` table; corrigir display "Teto Mensal"; implementar `alert_threshold_pct`; adicionar `dataQuality` |
| **Conectores** | Ausente no backend; capabilities anunciadas mas não registradas | ❌ Nem Hermes nem TokenizAI têm endpoint/conector funcional | Implementar endpoint `/api/connectores` ou reconhecer como fora do escopo Hermes |
| **Auditoria** | `appendAudit` unused + `enterprise.auditLogs` derivado de mutações cegas | ✅ Tabela `audit_log` no schema; gap é usage no app | Usar `appendAuditFn` ativo; registrar mutações no `audit_log`; adicionar `ip`, `session_token`, `old_values/new_values` |
| **Autenticação/RBAC** | RLS `using (true)` amplo; admin tokens never sent (corrigido em ETAPA 8); founder e-mail fixo | ✅ `empresa_usuario` model proposta; gap é `SUPABASE_SERVICE_ROLE_KEY` + migração | Configurar `SUPABASE_SERVICE_ROLE_KEY`; migrar dados; implementar RLS policies por `empresa_id` |
| **Frontend UX** | Toasts invisíveis, drawers vazios, navegação perde estado → toasts visíveis, drawers populados, estado preservado, acessibilidade AA | ✅ Correições ETAPA 8 (S3) + propostas aqui; gap é implementação consistente em todas as rotas | Aplicar correções em todos os componentes; testes de acessibilidade (axe) |

**Resumo:** Após a implementação da Fase 1 (novas migrations + `SUPABASE_SERVICE_ROLE_KEY`), a TokenizAi terá:
- Modelo de dados estendido (11 novas tabelas/colunas)
- Backend completo (~25 endpoints com gates de permissão)
- Ponte controlada Hermes CLI (trigger_hermes flag; graceful degradation)
- Frontend UX corrigido (toasts, drawers, navegação, acessibilidade)
- Homologação `APROVADO` (sem ressalvas) — ou `APROVADO COM RESSALVAS` se restarem gaps críticos não bloqueantes

>A independência do Paperclip é alcançada na **Fase 1** (migrations + dados), pois depois disso a TokenizAi não depende mais do Paperclip para nenhuma das funcionalidades críticas. O Hermes continua como runtime, mas as operações de organização, governança, persistência e UI são de propriedade exclusiva da TokenizAi.

---