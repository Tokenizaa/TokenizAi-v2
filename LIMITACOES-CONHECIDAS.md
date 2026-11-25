# LIMITAÇÕES CONHECIDAS — TokenizAi V2

> **Status:** Documentadas como limitação conhecida (não bugs)  
> **Origem:** Endpoints não expostos pela versão conectada do Hermes/Paperclip  
> **Resolução:** Aguardar exposição de novos endpoints na API Hermes

---

## LIM-001 — Conectores & Integrações (`/ia-conectores`)

**Página:** `/ia-conectores` (ConnectorsPage)  
**Sintoma:** Página exibe "Não exposto pela versão conectada"  
**Causa Raiz:** Hermes API não expõe endpoint de listagem/gerenciamento de conectores  
**Evidência:** `ConnectorsPage.tsx:25-27` - "A versão conectada do Paperclip não expõe um endpoint dedicado de listagem de conectores na matriz de capacidades"  
**Workaround:** Gerenciar conectores diretamente no Paperclip (porta 3100)  
**Endpoint Necessário:** `GET /api/hermes/connectors` + capacidades `connectors:read`, `connectors:manage`

---

## LIM-002 — Abas do AgentDetailPage (tarefas, execucoes, runtime, permissoes)

**Página:** `/ia-agentes/:agentId` (AgentDetailPage)  
**Abas Afetadas:**
- **Tarefas** (`tarefas`): "Tarefas são gerenciadas no kanban Hermes. Use a seção Tarefas para visualizar."
- **Execuções** (`execucoes`): "Execuções são gerenciadas na seção Execuções do Hermes."
- **Runtime State** (`runtime`): Mostra apenas JSON bruto do agente
- **Permissões & Acesso** (`permissoes`): "Permissões são gerenciadas via RBAC do Hermes no backend."

**Causa Raiz:** Hermes API não expõe endpoints granulares por agente:
- `GET /api/hermes/agents/:agentId/tasks`
- `GET /api/hermes/agents/:agentId/runs`
- `GET /api/hermes/agents/:agentId/runtime-state`
- `GET /api/hermes/agents/:agentId/permissions`

**Endpoints Necessários:** Capacidades `agents:read` granular + sub-recursos

---

## LIM-003 — ChatPage: Envio Direto Indisponível

**Página:** `/ia-chat` (ChatPage)  
**Sintoma:** "Envio de mensagem direta indisponível neste modo"  
**Causa Raiz:** Envio de mensagem requer sessão de agente autenticada (task run) no Paperclip, não apenas referência de agente  
**Arquitetura:** Paperclip separa "chat de agente" (requer run ativa) de "chat de usuário"  
**Endpoint Atual:** `POST /api/hermes/chats/:agentRef` - funciona apenas para agentes com run ativa  
**Endpoint Necessário:** Suporte a chat assíncrono ou criação de run sob demanda

---

## LIM-004 — Cancelamento de Execução (HermesRunsPanel)

**Componente:** `HermesRunsPanel` (usado em `/ia-execucoes` e AiOpsView)  
**Sintoma:** "Cancelamento de execução não disponível no contrato Hermes atual. A execução segue seu ciclo de vida."  
**Causa Raiz:** Endpoint de cancelamento não exposto pela versão conectada do Hermes  
**Código:** `HermesRunsPanel.tsx:69-72`  
**Endpoint Necessário:** `POST /api/hermes/runs/:runId/cancel` + capacidade `runs:cancel`

---

## LIM-005 — Sub-tasks / Hierarquia de Tarefas (TasksPage)

**Páginas Afetadas:** 
- `/ia-tarefas` (TasksPage standalone) - **não funciona**
- AiOpsView > HermesTasksPanel - **funciona parcialmente**

**Sintoma:** Hierarquia de sub-tasks só funciona no HermesTasksPanel do AiOpsView  
**Causa Raiz:** Duplicação de lógica entre:
- `modules/ai-workforce/pages/TasksPage.tsx` (standalone, sem hierarquia)
- `modules/ai-ops/HermesTasksPanel.tsx` (com hierarquia via `parentId`)

**Resolução Parcial:** Consolidar para usar apenas HermesTasksPanel via AiOpsView  
**Nota:** A página standalone `/ia-tarefas` ainda usa TasksPage antiga

---

## LIM-006 — Decisões de Aprovação (ApprovalsPage vs ApprovalsDetailPage)

**Páginas Afetadas:**
- `/ia-aprovacoes` (ApprovalsPage standalone) - botões mostram "não disponível"
- `/ia-aprovacoes/:approvalId` (ApprovalDetailPage standalone) - botões mostram "não disponível"
- AiOpsView > HermesApprovalsPanel - **funciona completamente**

**Sintoma:** Handlers `approve/reject/revision` mostram toast "não disponível via REST do Hermes" nas páginas standalone  
**Causa Raiz:** Duplicação de lógica entre:
- `modules/ai-workforce/pages/ApprovalsPage.tsx` + `ApprovalDetailPage.tsx`
- `modules/ai-ops/HermesGovernancePanels.tsx` > `HermesApprovalsPanel`

**Resolução Parcial:** HermesApprovalsPanel no AiOpsView tem integração completa com `hermesService.approveApproval/rejectApproval/requestApprovalRevision`

---

## LIM-007 — Métricas Paperclip no ExecutiveView

**Componente:** `ExecutiveView` (`/executivo`)  
**Sintoma:** Métricas mostram "—" quando Hermes desconectado ou bundle null  
**Comportamento Atual:** ✅ Tratado graciosamente (mostra loading state após fix `b10c95a`)  
**Limitação:** Métricas operacionais (agentes ativos, tarefas abertas, bloqueadas, aprovações pendentes) dependem 100% de conexão Hermes ativa  
**Design:** Intencional - sem simulação de dados, reflete estado real da operação

---

## RESUMO DE ENDPOINTS NECESSÁRIOS PARA RESOLVER TODAS LIMITAÇÕES

| Limitação | Endpoint(s) Necessários | Capacidade Hermes |
|-----------|------------------------|-------------------|
| LIM-001 | `GET/POST /api/hermes/connectors` | `connectors:read`, `connectors:manage` |
| LIM-002 | `GET /api/hermes/agents/:id/tasks`, `:id/runs`, `:id/runtime`, `:id/permissions` | `agents:read` granular |
| LIM-003 | Chat assíncrono ou `POST /api/hermes/agents/:id/run` + chat | `agents:manage` + `chats:write` |
| LIM-004 | `POST /api/hermes/runs/:id/cancel` | `runs:cancel` |
| LIM-005 | Unificar TasksPage → HermesTasksPanel (já feito via AiOpsView) | - |
| LIM-006 | Unificar ApprovalsPage → HermesApprovalsPanel (já feito via AiOpsView) | - |
| LIM-007 | N/A (design intencional) | - |

---

## PRÓXIMOS PASSOS RECOMENDADOS

1. **Monitorar releases do Hermes** para novos endpoints nas capacidades acima
2. **Quando endpoints estiverem disponíveis:** Implementar nas páginas correspondentes
3. **Consolidar duplicações restantes:**
   - TasksPage standalone → remover, usar apenas AiOpsView/HermesTasksPanel
   - ApprovalsPage standalone → remover, usar apenas AiOpsView/HermesApprovalsPanel
4. **Adicionar testes de integração** quando endpoints forem expostos

---

**Última Atualização:** 2026-11-25  
**Versão Hermes Conectada:** Verificar em `/admin` > Integração Hermes  
**Responsável:** Equipe Hermes/Operações IA