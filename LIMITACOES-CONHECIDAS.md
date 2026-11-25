# LIMITAÇÕES CONHECIDAS — TokenizAi V2

> **Status:** Documentadas como limitação conhecida (não bugs)  
> **Runtime operacional atual:** **Hermes**, executado pelo backend Express na porta **3000** (`npm run dev` → `tsx server.ts`).  
> **Origem:** Endpoints ainda não expostos pela versão conectada do **Hermes**.  
> **Resolução:** Aguardar exposição de novos endpoints na API Hermes.

> [!IMPORTANT]
> **Runtime oficial = Hermes. Paperclip é LEGADO histórico.**
> O TokenizAi V2 **não depende, não inicia e não inspeciona Paperclip**. A migração foi concluída nos commits
> `e4da7c1`, `140026d`, `aea0a25` e `9667f62` ("remove última referência Paperclip dos dados exibidos").
> Não existe mais pacote `@paperclipai/*`, variável `PAPERCLIP_*`, rota `/api/paperclip/*`, gateway ou serviço Paperclip no código.
> Para executar ou inspecionar a aplicação, use **somente** `npm run dev` (porta 3000). **Não inicie Paperclip, nem na porta 3100.**
> As menções a Paperclip abaixo são **contexto histórico da limitação**, mantidas para rastreabilidade — não são instruções operacionais vigentes.

---

## LIM-001 — Conectores & Integrações (`/ia-conectores`)

**Página:** `/ia-conectores` (ConnectorsPage)  
**Sintoma:** Página exibe "Gerenciamento de conectores indisponível pela API atual"  
**Causa Raiz:** O contrato atual do runtime **Hermes** não expõe operações de listagem, configuração ou gerenciamento de conectores  
**Evidência (código atual):** `src/modules/ai-workforce/pages/ConnectorsPage.tsx:17-20` — "O contrato atual do runtime Hermes não expõe operações de listagem, configuração ou gerenciamento de conectores. A TokenizAi não simula conectores nem solicita credenciais diretamente no navegador."  
**Workaround vigente:** **Nenhum.** Não há painel de conectores em outro runtime para utilizar. A área permanece explicitamente indisponível até existir contrato de backend seguro.  
**Histórico (legado — não usar):** versão anterior deste documento citava `ConnectorsPage.tsx:25-27` com texto sobre "Paperclip" e recomendava "Gerenciar conectores diretamente no Paperclip (porta 3100)". Essa instrução foi **removida**: a migração Paperclip→Hermes eliminou o runtime Paperclip e a porta 3100 não é utilizada pelo TokenizAi V2.  
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
**Causa Raiz:** O contrato atual do runtime **Hermes** não expõe sessão de chat persistente por agente; `POST /api/hermes/chats/:agentRef` depende de execução ativa e não há listagem de histórico (`GET /api/hermes/chats/:agentRef` não está registrado no backend).  
**Arquitetura:** No runtime Hermes, o envio é feito via comando `chat --oneshot` sobre o agente; não há canal de chat de usuário separado com sessão persistida.  
**Histórico (legado — contexto, não instrução):** a descrição original atribuía a causa a uma separação entre "chat de agente" e "chat de usuário" no Paperclip. Essa explicação veio da migração e **não implica runtime Paperclip ativo** — o código Paperclip foi removido nos commits `e4da7c1` / `aea0a25`.  
**Endpoint Atual:** `POST /api/hermes/chats/:agentRef`  
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

## LIM-007 — Métricas operacionais no ExecutiveView

**Componente:** `ExecutiveView` (`/executivo`)  
**Sintoma:** Métricas mostram "—" quando Hermes desconectado ou bundle null  
**Comportamento Atual:** ✅ Tratado graciosamente (mostra loading state após fix `b10c95a`)  
**Limitação:** Métricas operacionais (agentes ativos, tarefas abertas, bloqueadas) dependem 100% de conexão Hermes ativa  
**Design:** Intencional - sem simulação de dados, reflete estado real da operação  
**Nota histórica:** o título anterior era "Métricas Paperclip no ExecutiveView" e incluía "aprovações pendentes". A métrica de aprovações foi removida (`04943d0`) porque o contrato Hermes não a expõe; a nomenclatura Paperclip foi eliminada do componente (`9716cce`). Nenhum desses nomes descreve o comportamento atual.

---

## RESUMO DE ENDPOINTS NECESSÁRIOS PARA RESOLVER TODAS LIMITAÇÕES

| Limitação | Endpoint(s) Necessários | Capacidade Hermes |
|-----------|------------------------|-------------------|
| LIM-001 | `GET/POST /api/hermes/connectors` | `connectors:read`, `connectors:manage` |
| LIM-002 | `GET /api/hermes/agents/:id/tasks`, `:id/runs`, `:id/runtime`, `:id/permissions` | `agents:read` granular |
| LIM-003 | Chat assíncrono ou `POST /api/hermes/agents/:id/run` + chat | `agents:manage` + `chats:write` |
| LIM-004 | `POST /api/hermes/runs/:id/cancel` | `runs:cancel` |
| LIM-005 | Reavaliar hierarquia de sub-tasks (TasksPanel via AiOpsView) | - |
| LIM-006 | N/A — ações de aprovação desativadas até contrato real | - |
| LIM-007 | N/A (design intencional) | - |

> **Atualização de estado (2026-11-25):** as linhas LIM-005/LIM-006 antes recomendavam "Unificar TasksPage/ApprovalsPage standalone → HermesTasksPanel/HermesApprovalsPanel via AiOpsView". Isso já foi feito e posteriormente revisado: as páginas standalone de `ai-workforce/pages` são código morto (o router em `src/App.tsx` usa os wrappers de `ai-ops/pages`) e as ações de aprovação foram **desativadas** (`7163fe7`, `9bafa92`) por não haver contrato persistente no Hermes. `ApprovalsPage` hoje exibe apenas `EmptyState` informando a indisponibilidade. Manter o texto antigo como recomendação atual induziria a uma ação já concluída e a uma integração que não existe.

---

## PRÓXIMOS PASSOS RECOMENDADOS

1. **Monitorar releases do Hermes** para novos endpoints nas capacidades acima
2. **Quando endpoints estiverem disponíveis:** Implementar nas páginas correspondentes
3. **Adicionar testes de integração** quando endpoints forem expostos
4. **Não reintroduzir Paperclip:** qualquer limitação listada deve ser resolvida no contrato Hermes/backend, nunca iniciando Paperclip ou usando a porta 3100

---

**Última Atualização:** 2026-11-25 (revisão operacional: runtime Hermes na porta 3000; referências Paperclip marcadas como legado)  
**Versão Hermes Conectada:** Verificar em `/admin` > Integração Hermes  
**Responsável:** Equipe Hermes/Operações IA