# Auditoria de Aproveitamento Hermes × Paperclip

## Objetivo
Identificar, com base em evidências de código, quais funcionalidades do Paperclip já são nativas do Hermes e quais exigem complementação pela camada empresarial da TokenizAi. O princípio orientador é: **aproveitar o máximo do Hermes, não construir duplicatas.**

---

## 1. Perfis e Bots (Hermes Bot Mode)

### Recurso nativo do Hermes
- **Evidência no código**: `HermesBotDto` (types/platform.ts:312-342) possui campos completos: `id`, `name`, `title`, `role`, `description`, `status`, `capabilities`, `lifecycleState`, `reportsTo`, `chainOfCommand`, `runtimeState`, `permissions`, `access`
- **Endpoints disponíveis** (HermesGateway/index.ts:56-70 e api.ts:406-455):
  - `GET /api/hermes/agents` — listar agentes (bots)
  - `GET /api/hermes/agents/:id` — consultar agente específico
  - `POST /api/hermes/agents/hire` — criar perfil de bot
  - `PATCH /api/hermes/agents/:id` — atualizar agente
  - `DELETE /api/hermes/agents/:id` — excluir agente
  - `POST /api/hermes/agents/:id/wakeup` — wakeup
  - `POST /api/hermes/agents/:id/heartbeat` — heartbeat
  - `POST /api/hermes/agents/:id/pause` — pausar agente
  - `POST /api/hermes/agents/:id/resume` — retomar agente
  - `GET /api/hermes/agents/:id/runtime-state` — estado de runtime
- **Parser existente**: `parseProfileList()` (domainParsers.ts:1-23) — extrai de saída CLI textual, mas retorna apenas `id/name/title/role/status` (fields achatados)

### Lacuna identificado
- O parser `parseProfileList` descarta fields rich como `division`, `model`, `budgetMonthlyCents`, `spentMonthlyCents`, `lastHeartbeatAt`, `lifecycleVersion`, `chainOfCommand`, `runtimeConfig`
- A estrutura `HermesBotDto` no tipo TypeScript já possui esses fields, mas o parser não os preenche totalmente

### Decisão
**REUTILIZAR HERMES** — O Hermes já gerencia perfis de bots completos. A TokenizAi deve expor esses dados via API e UI, não recriar mecanismo de perfil. O que falta é a UI/UX para exibir fields completos e o enterpriseState para persistir atributos empresariais adicionais.

---

## 2. Colaboração e Conversas (Hermes Group Chats)

### Recurso nativo do Hermes
- **Evidência no código**: `HermesChatThreadDto` (types/platform.ts:344-358) e `HermesChatMessageDto` (types/platform.ts:360-367)
- **Endpoints disponíveis**:
  - `GET /api/hermes/chats` — listar threads de conversa
  - `GET /api/hermes/chats/:agentRef` — consultar thread específica
  - `POST /api/hermes/chats/:agentRef` — enviar mensagem
- **Serviço HermesApi** (api.ts:458-468): `listChats`, `getChat`, `sendChatMessage`

### Lacuna identificado
- O frontend (`HermesChatPanel.tsx`) existe mas precisa ser auditado se as funcionalidades de group chat efetivamente funcionam com o Hermes instalado
- Não foi encontrada evidência de `conversationState` ou `conversationAgentId` sendo preenchido na prática

### Decisão
**REUTILIZAR HERMES** — O mecanismo de conversa entre agentes já existe nativamente. A TokenizAi deve integrar essa capacidade na UI (painel de chat) e usar como base para colaboração, em vez de construir sistema próprio de mensageria.

---

## 3. Tarefas e Kanban (Hermes Kanban Multiagente)

### Recurso nativo do Hermes
- **Evidência no código**: `HermesTaskDto` (types/platform.ts:369-382) com `id`, `title`, `description`, `status`, `priority`, `assigneeAgentId`, `projectId`, `parentId`
- **Endpoints disponíveis**:
  - `GET /api/hermes/tasks` — listar tarefas
  - `POST /api/hermes/tasks` — criar tarefa
  - `PATCH /api/hermes/tasks/:id` — atualizar tarefa
- **Serviço HermesService** (ai-workforce/services/hermes.ts:39-51): `listTasks`, `createTask`, `updateTask`
- **Parser**: `parseKanbanJson()` (domainParsers.ts:25-36) — reduz tarefas a `id/title/status` (fields achatados)

### Lacuna identificado
- O parser `parseKanbanJson` descarta `priority`, `projectId`, `parentId`, `description` campos que o DTO suporta
- A hierarquia `parentId` existe no schema mas o frontend `TasksPage` não navega por subtarefas
- O cancelamento de tarefas é `no-op` explícito (Auditoria ETAPA 6)

### Decisão
**REUTILIZAR HERMES** — O Kanban Hermes já suporta tarefas com hierarquia `parentId/childId`, atribuídos a agentes, com estados e prioridades. O que falta é a UI completa para visualizar/editar esses fields e a conexão completa do frontend com as operações de hierarquia.

---

## 4. Rotinas e Agendamentos (Hermes Cron)

### Recurso nativo do Hermes
- **Evidência no código**: `HermesRoutineDto` (types/platform.ts:408-420) com `id`, `name`, `description`, `enabled`, `agentId`, `cron`, `triggers`, `lastRunAt`, `lastRunStatus`, `projectId`
- **Endpoints disponíveis**:
  - `GET /api/hermes/routines` — listar rotinas
  - `POST /api/hermes/routines` — criar rotina
  - `POST /api/hermes/routines/:id/trigger` — disparar rotina
  - `POST /api/hermes/routines/:id/run` — executar rotina
  - `POST /api/hermes/routines/:id/triggers` — criar trigger
  - `GET /api/hermes/routines/:id/runs` — listar runs de rotina
- **Serviço HermesService** (ai-workforce/services/hermes.ts:57-64): `listRoutines`, `createRoutine`
- **Gateway capabilities** (index.ts:63-64): `routines:read`, `routines:manage`

### Lacuna identificado
- O parser `parseCronList()` (domainParsers.ts:38-42) **sempre retorna `[]`** — não extrai dados reais da CLI
- `handleCreateRoutine` no backend engole falhas com `.catch(() => {})` e ainda emite "Rotina criada no Hermes" (Auditoria ETAPA 6)
- O frontend `RoutinesPage` depende de dados que o backend não entrega corretamente

### Decisão
**CORRIGIR INTEGRAÇÃO EXISTENTE** — O Hermes suporta rotinas com cron e triggers, mas a integração TokenizAi quebra em vários pontos: parser que retorna vazio, backend que ignora erros, frontend que não popula. Esses devem ser corrigidos (parsers, error handling) e não substituídos por novo sistema.

---

## 5. Skills (Hermes Skill Catalog)

### Recurso nativo do Hermes
- **Evidência no código**: `HermesSkillDto` (types/platform.ts:479-497) com `id`, `name`, `key`, `slug`, `title`, `description`, `version`, `status`, `installedAt`, `source`, `mediaKind`, `authorName`, `previewText`, `issueId`, `sizeBytes`, `url`, `folderPath`
- **Endpoints disponíveis**:
  - `GET /api/hermes/skills` — listar skills instaladas
- **Serviço HermesService** (ai-workforce/services/hermes.ts:79-80): `getSkills`
- **Capabilities** (index.ts:70): `skills:read`

### Lacuna identificado
- O frontend `SkillsPage` consome `key/slug/version/folderPath/source` (SKILLS:117-126) mas o backend `HermesSkillDto` via API retorna apenas `id/name/description/status` (apenas 4 fields dos 14 possíveis)
- Two HermesSkillDto existências: local minimal (API:577-584) e rico (TYPES:479-497); facade tipa como rico embora chamada retorne minimal
- `AGENCY_SPECIALISTS` (12 entries fixas) apresentados como 283 no AgencyLibraryView — contagem heurística, não mapping real

### Decisão
**CORRIGIR INTEGRAÇÃO EXISTENTE** — O Hermes já tem catálogo de skills versionado. O gap é o parser/endpoint retornar fields completos. A TokenizAi deve corrigir o parser e/ou o DTO de resposta, não criar novo catálogo de skills.

---

## 6. Execuções e Heartbeats (Hermes Runtime)

### Recurso nativo do Hermes
- **Evidência no código**: `HermesRunDto` (types/platform.ts:384-406) com `id`, `agentId`, `model`, `provider`, `taskId`, `status`, `startedAt`, `finishedAt`, `costCents`, `durationMs`, `logs`, `events`
- **Endpoints disponíveis**:
  - `GET /api/hermes/runs` — listar execuções
  - `POST /api/hermes/agents/:id/heartbeat` — invocar heartbeat
- **Serviço HermesService** (ai-workforce/services/hermes.ts:53-55): `listRuns`
- **Capabilities** (index.ts:62): `runs:read`

### Lacuna identificado
- O cancelamento de runs é `no-op` explícito com aviso (Auditoria ETAPA 6) — não cancela na prática
- Logs e eventos são marcados como "não expostos" (RUNS:247-265)
- `handleCancel` avisa mas não executa cancelamento real

### Decisão
**REUTILIZAR HERMES (com correções)** — O Hermes já tem mecanismo de execução e heartbeats. O gap é a operação de cancelamento e exposition de logs. Esses devem ser corrigidos no backend, não reescritos.

---

## 7. Organograma e Relações Hierárquicas

### Recurso nativo do Hermes (parcial)
- **Evidência no código**: `HermesBotDto` possui `team?`, `children?`, `reportsTo?`, `chainOfCommand?` (fields opcionais)
- **Endpoint**: `GET /api/hermes/org` (HermesApi.getOrganization) retorna `tree: HermesBotDto[]` e `agents: HermesBotDto[]`
- **Frontend**: `AiOpsView.tsx:208-245` — `renderOrgBranch` constrói organograma a partir do tree do Hermes, com `reportsTo` e `chainOfCommand` display

### Lacuna identificado
- O organograma Hermes é derivado dos `children` dos bots no runtime, **não de uma estrutura empresarial explícita** `empresa_id`/`department_id`
- `loadOrg` em AiOpsView.tsx:107-121 consome `HermesApi.getOrganization()` mas o `tree` virá da configuração do Hermes, não do modelo de organização da TokenizAi
- Não há vinculação entre `agentes_empresariais` (Supabase) e o `tree` do Hermes via `empresa_id`/`department_id`

### Decisão
**REAPROVEITAR E COMPLEMENTAR TOKENIZAI** — O Hermes oferece visualização de organograma baseada em relações de bot↔bot (`children`, `reportsTo`), mas a estrutura organizacional empresarial (empresas, departamentos, integração com Supabase) pertence à camada TokenizAi. A integração deve conectar esses dois mundos, não um substituir o outro.

---

## 8. Aprovações e Governança

### Recurso nativo do Hermes (parcial)
- **Evidência no código**: `approvals:read` e `approvals:manage` capabilities (index.ts:65-66)
- **Endpoints**: `GET /api/hermes/approvals`, `POST /api/hermes/approvals/:id/approve`, `POST /api/hermes/approvals/:id/reject`, `POST /api/hermes/approvals/:id/revision`
- **Frontend**: `HermesApprovalsPanel` no AiOpsView tem integração completa com `hermesService.approveApproval/rejectApproval/requestApprovalRevision`
- **Mas**: páginas standalone (`ApprovalsPage`, `ApprovalDetailPage`) exibem `EmptyState` "gestão de aprovações não integrada"; governança apresentada apenas como placeholder "—"

### Lacuna identificado
- O backend tem handlers `/approvals` (HROUTER:637-675) mas frontend removeu a integração
- `LIM-006` original recomendava unificar → `ApprovalsPage standalone → HermesApprovalsPanel via AiOpsView` (já feito no código, mas desativado)
- Aprovação atual é "parcialmente derivada de tarefas cujo título contém a palavra 'aprov'" (Auditoria ETAPA 6)

### Decisão
**REAPROVEITAR E COMPLEMENTAR TOKENIZAI** — O Hermes tem capability de approvals, mas a integração TokenizAi estava desativada. Deve-se reativar a integração Hermes→frontend (já existe o painel HermesApprovalsPanel) e conectar ao fluxo empresarial da TokenizAi, não criar sistema novo.

---

## 9. Custos e Orçamentos

### Recurso nativo do Hermes
- **Evidência no código**: `HermesCostSummaryDto` (types/platform.ts:422-433) com `totalCostCents`, `currency`, `budgetMonthlyCents`, `dataQuality`, `byAgent`, `byProject`, `eventCount`
- **Endpoints**: `GET /api/hermes/costs/summary`
- **Capabilities** (index.ts:67): `costs:read`
- **Serviço** (ai-workforce/services/hermes.ts:66-67): `getCostsSummary`

### Lacuna identificado
- `budgetMonthlyCents: null` sempre — dado não vindo do Hermes
- `Coluna "Teto Mensal"` na UI copia `row.costCents` — dado enganoso (custo em vez de orçamento)
- `Promise.allSettled` silencia falhas de `getCostsSummary`, `listActivity`, `listAgentActionsAudit`
- Empty de atividade/auditoria (`614-618, 639-643`) — dados não retornados

### Decisão
**IMPLEMENTAR CAMADA EMPRESARIAL TOKENIZAI** — O Hermes entrega resumo de custos, mas os fields de orçamento (`budgetMonthlyCents`) são nulos e a coluna "Teto Mensal" apresenta dado enganoso. A TokenizAi deve implementar a camada de budgets propria (tabela `budgets` no schema, endpoints `/api/budgets`) para gerenciar `amount_cents - spent_cents = restante` e alerts, integrando-se ao resumo do Hermes mas não dependendo exclusivamente dele.

---

## 10. Conclusão Geral do Aproveitamento

| Categoria | Recurso Hermes | Status Integração TokenizAi | Ação Necessária |
|-----------|---------------|----------------------------|-----------------|
| Perfis/Bots | ✅ Nativo completo | Parser achatado — fields perdidos | Corrigir parser + UI fields completos |
| Conversas/Chat | ✅ Nativo completo | Funcionando (painel Chat) | Manutenção |
| Tarefas/Kanban | ✅ Nativo completo | Parser achatado + hierarquia não exibida | Corrigir parser + hierarchy UI |
| Rotinas/Cron | ✅ Nativo completo | Parser retorna `[]`, backend ignora erros | Corrigir parser + error handling |
| Skills | ✅ Nativo completo | UI consome fields que backend não retorna | Corrigir DTO/parser retorno |
| Execuções/Runs | ✅ Nativo completo | Cancelamento é no-op, logs não expostos | Corrigir cancelation + logs |
| Organograma | ✅ Parcial (tree do bot) | Estrutura empresarial separada | Integrar Supabase↔Hermes tree |
| Aprovações | ✅ Capability existe | Frontend desativado | Reativar integração Hermes→UI |
| Custos/Orçamentos | ✅ Resumo parcial | `budgetMonthlyCents: null`, dado enganoso | Implementar layer empresarial own budgets |

**Princípio**: A TokenizAi deve **complementar** o Hermes onde este não tem capacidade empresarial (orçamentos, estruturas de org, governança por role/permission), mas **reutilizar** integralmente o que Hermes já faz nativamente (perfis, tarefas, chats, skills, execuções).

---