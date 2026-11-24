# Arquitetura TokenizAi-v2 — Hermes Direto (sem Paperclip)

## Visão Geral

O TokenizAi-v2 deixa de depender do Paperclip como camada de execução de agentes e passa a integrar o **Hermes diretamente** como runtime de agentes, tarefas, rotinas, aprovações, chat e auditoria. O backend Express continua responsável pelas rotas de enterprise (projetos, clientes, negócios, produtos, assinaturas, finanças) e autenticação Supabase, mas a camada de IA/agentes passa a ser nativa do Hermes.

## Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENTE (React/Vite + Tailwind)                   │
│  └─ src/modules/ai-ops/*     └─ src/modules/ai-workforce/*                  │
│  └─ src/services/api.ts ───┬─→ /api/enterprise/*  (backend Express)        │
│                           └─→ /api/hermes/*      (backend Hermes adapter)  │
└───────────────────────────┴─────────────────────────────────────────────────┘
                                     │
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BACKEND EXPRESS (server.ts + buildApp)                 │
│  ├─ /api/auth/*            Supabase Auth (JWT validation)                   │
│  ├─ /api/enterprise/*      Projetos, clientes, deals, products, finance    │
│  ├─ /api/hermes/agents     Listagem e criação de Bots Hermes                │
│  ├─ /api/hermes/chats      Chat com agentes (Hermes sessions)               │
│  ├─ /api/hermes/tasks      Issues/tarefas (Hermes kanban + delegate_task)   │
│  ├─ /api/hermes/runs       Execuções (Hermes subagent runs)                 │
│  ├─ /api/hermes/routines   Rotinas/automações (Hermes cron)                 │
│  ├─ /api/hermes/approvals  Aprovações e governança (Hermes skills)           │
│  ├─ /api/hermes/costs      Custos e orçamentos (Hermes memory)              │
│  ├─ /api/hermes/activity   Atividade e auditoria (Hermes memory)            │
│  ├─ /api/hermes/org        Organograma (Hermes Bot sections)                │
│  └─ /api/health            Health status (Hermes connectivity)              │
└───────────────────────────┬─────────────────────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │   HERMES      │
                    │  (CLI/API)    │
                    │               │
                    │  ├─ Bots      │  (perfis isolados em ~/.hermes/profiles/)
                    │  ├─ Skills    │  (~/.hermes/skills/, padrão agentskills.io)
                    │  ├─ Kanban    │  (hermes kanban - gestão de tarefas)
                    │  ├─ Cron      │  (hermes cron - rotinas agendadas)
                    │  ├─ Memory    │  (FTS5 - auditoria, custos, atividade)
                    │  └─ Delegate  │  (delegate_task - execução de subagentes)
                    └───────────────┘
```

## Mapeamento Paperclip → Hermes

| Domínio Paperclip | Implementação Hermes | Novo endpoint |
|---|---|---|
| Agents (listar, criar, wakeup, heartbeat, pause, resume, hire) | Bots do Hermes + `delegate_task` | `/api/hermes/agents/*` |
| Agent Chat | Sessões de chat Hermes | `/api/hermes/chats/*` |
| Issues (tarefas/delegações) | Kanban Hermes + `delegate_task` | `/api/hermes/tasks/*` |
| Runs (execuções/heartbeats) | Runs de subagentes Hermes | `/api/hermes/runs/*` |
| Routines (rotinas/triggers) | Cron Hermes | `/api/hermes/routines/*` |
| Approvals (aprovações/governança) | Skills Hermes + auditoria | `/api/hermes/approvals/*` |
| Costs (custos/orçamentos) | Memory Hermes + tracking | `/api/hermes/costs/*` |
| Activity (atividade/auditoria) | Memory Hermes (FTS5) | `/api/hermes/activity/*` |
| Org (organograma) | Sections do Bot Mode | `/api/hermes/org/*` |
| Skills (skills da empresa) | Skills Hermes | `/api/hermes/skills/*` |
| Inbox/Attention | Notificações Hermes + memory | `/api/hermes/inbox/*`, `/api/hermes/attention/*` |
| Artifacts/Attachments | Sistema de arquivos local + memory | `/api/hermes/artifacts/*` |

## Arquivos a Remover

Todos os arquivos em `server/integrations/paperclip/` (23 arquivos):

1. `activity.ts`
2. `adminAuth.ts` → RBAC mantido, mas adaptado para Hermes (sem paperclipUserId)
3. `agents.ts`
4. `approvals.ts`
5. `artifacts.ts`
6. `attachments.ts`
7. `attention.ts`
8. `auth.ts` → config Paperclip removida
9. `capabilities.ts` → matriz de capacidades Hermes
10. `chats.ts`
11. `client.ts` → HTTP client Paperclip removido
12. `costs.ts`
13. `errors.ts` → erros Hermes
14. `health.ts` → health check Hermes
15. `inbox.ts`
16. `index.ts` → PaperclipGateway removido
17. `issues.ts`
18. `openapi.ts`
19. `org.ts`
20. `projects.ts`
21. `router.ts` → router Hermes
22. `routines.ts`
23. `runs.ts`
24. `skills.ts`
25. `types.ts` → tipos Hermes

## Arquivos a Modificar

### server.ts
- Remover import de `paperclipGateway` e `createPaperclipRouter`
- Remover `paperclipGateway.initialize()` do `startServer()`
- Remover `app.use(createPaperclipRouter(appendAudit))`
- Adicionar rotas `/api/hermes/*` via novo router
- Manter `/api/health` reportando status Hermes

### src/services/api.ts
- Remover `PaperclipApi` (todos os métodos `/api/paperclip/*`)
- Adicionar `HermesApi` com métodos `/api/hermes/*`
- Manter `PlatformApi` e `AuthSessionApi` inalterados

### src/types/platform.ts
- Remover todos os tipos `Paperclip*` (AgentDto, IssueDto, RunDto, etc.)
- Adicionar tipos `Hermes*` (BotDto, TaskDto, RunDto, etc.)

### src/modules/ai-workforce/services/paperclip.ts
- Renomear/remover, substituir por serviço Hermes

### src/modules/ai-ops/* (PaperclipChatPanel, PaperclipGovernancePanels, PaperclipRunsPanel, PaperclipStatusPanel, PaperclipTasksPanel)
- Substituir referências `PaperclipApi` por `HermesApi`
- Substituir `PaperclipStatusPanel` por `HermesStatusPanel`

### .env.example
- Remover variáveis `PAPERCLIP_*`
- Adicionar variáveis de configuração Hermes (se necessário)

## Novos Arquivos a Criar

1. `server/integrations/hermes/index.ts` — HermesGateway (status, health, config)
2. `server/integrations/hermes/router.ts` — Rotas `/api/hermes/*`
3. `server/integrations/hermes/bots.ts` — Serviço de Bots Hermes
4. `server/integrations/hermes/tasks.ts` — Serviço de tarefas (kanban)
5. `server/integrations/hermes/chats.ts` — Serviço de chat Hermes
6. `server/integrations/hermes/runs.ts` — Serviço de execuções
7. `server/integrations/hermes/routines.ts` — Serviço de rotinas (cron)
8. `server/integrations/hermes/approvals.ts` — Serviço de aprovações
9. `server/integrations/hermes/costs.ts` — Serviço de custos
10. `server/integrations/hermes/activity.ts` — Serviço de atividade/auditoria
11. `server/integrations/hermes/org.ts` — Serviço de organograma
12. `server/integrations/hermes/types.ts` — Tipos Hermes DTO
13. `server/integrations/hermes/errors.ts` — Erros Hermes
14. `ARQUITETURA-HERMES-DIRETO.md` — Este documento

## Estratégia de Migração (Faseada)

### Fase 1: Preparação (1 semana)
- Criar skills Hermes para cada domínio (agents, tasks, chats, approvals, costs, activity, org)
- Criar 12 Bots Hermes a partir de `src/data/agencyCatalog.ts`
- Documentar mapeamento completo

### Fase 2: Backend — Novas rotas Hermes (2 semanas)
- Criar `server/integrations/hermes/*`
- Adicionar rotas `/api/hermes/*` ao server.ts
- Manter rotas `/api/paperclip/*` temporariamente (compatibilidade)

### Fase 3: Frontend — Migração módulos IA (2 semanas)
- Migrar `src/services/api.ts` (remover PaperclipApi, adicionar HermesApi)
- Migrar `src/modules/ai-ops/*` e `src/modules/ai-workforce/*`
- Atualizar tipos em `src/types/platform.ts`

### Fase 4: Remoção Paperclip (1 semana)
- Remover `server/integrations/paperclip/`
- Remover rotas `/api/paperclip/*`
- Remover variáveis `PAPERCLIP_*` do .env.example

### Fase 5: Testes e Validação (1 semana)
- Executar testes E2E: entrar → acessar organograma → contratar agente → chat → delegar → concluir
- Verificar artefatos em disco
- Rodar `npm run test`, `npm run lint`, `npm run build`

## Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Perda de dados operacionais do Paperclip | Migrar apenas metadados; dados operacionais ficam no Hermes memory/kanban |
| Quebra de frontend durante migração | Manter rotas Paperclip até Fase 4, migração incremental por módulo |
| Perda de RBAC granular | Adaptar `adminAuth.ts` para permissões Hermes sem paperclipUserId |
| Complexidade de deploy Hermes | Usar `hermes plugins` e `hermes cron` já disponíveis no ambiente |

## Critérios de Aceite

- [ ] `server/integrations/paperclip/` removido completamente
- [ ] Nenhuma rota `/api/paperclip/*` restante
- [ ] Todas as rotas `/api/hermes/*` funcionais
- [ ] Frontend consome Hermes sem referência a Paperclip
- [ ] `npm run test`, `npm run lint`, `npm run build` passam
- [ ] Fluxo E2E: entrar → organograma → contratar agente → chat → delegar → concluir
