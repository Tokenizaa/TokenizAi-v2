# Comunicação e Orquestração de Equipes

> **DOCUMENTO SUPERADO — 25/11/2026:** O conteúdo abaixo registra o desenho e a implantação históricos da operação no Paperclip. Após a migração, Paperclip não é runtime, servidor, banco, chat ou sistema de orquestração do TokenizAi. Não iniciar, acessar ou configurar Paperclip com base neste documento. A arquitetura vigente utiliza TokenizAi V2 + Hermes + Supabase. Os registros abaixo são evidência histórica, não estado operacional atual.

> **Versão:** 1.1  
> **Data:** 22 de novembro de 2026  
> **Status:** **HISTÓRICO / SUPERADO** — estrutura que esteve implantada no Paperclip antes da migração  
> **Responsável:** Hermes (Chefe de Gabinete Executivo)

---

## 1. Visão Geral

A comunicação na NettosCorp Enterprise opera em **três planos integrados**:

| Plano | Protocolo | Participantes | Latência | Persistência |
|-------|-----------|---------------|----------|--------------|
| **Chat Operacional** | WebSocket + REST (Discord, Slack, GitHub, Telegram, Teams) | Humans + Agents | Real-time | PostgreSQL (chat_deliveries) |
| **Orquestração Interna** | gRPC / Message Queue (Paperclip runtime-api) | Agents ↔ Orchestrator | < 10ms | PostgreSQL (tasks, delegations) |
| **Delegação Externa** | HTTP/SSE (Hermes Gateway) + ACP stdio | Hermes ↔ Subagents | ~100ms | Hermes context + Paperclip ledger |

---

## 2. Chat Operacional (Paperclip Chat Channels)

### 2.1 Providers Suportados (EVIDENCIADO)

| Provider | Tipo | Autenticação | Features |
|----------|------|--------------|----------|
| **Discord** | Bot + Slash Commands | Bot Token | Threads, embeds, components |
| **Slack** | Socket Mode + Bot | Bot Token + Signing Secret | Blocks, modals, shortcuts |
| **GitHub** | Webhooks + GraphQL | GitHub App | PR reviews, issues, discussions |
| **Telegram** | Bot API + Webhooks | Bot Token | Inline keyboards, commands |
| **Teams** | Bot Framework | Azure Bot Service | Adaptive cards, messaging extensions |

### 2.2 Arquitetura de Delivery (Paperclip)

```
Inbound Message (Provider WebSocket/Webhook)
         │
         ▼
┌─────────────────────────────────────────────┐
│         Chat Channel Adapter                │
│  (Normaliza payload → ChatDelivery struct)  │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│         Conversation Router                 │
│  • Resolve conversation_id                  │
│  • Identifica agent/user destinatário       │
│  • Aplica rate limits, filters              │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│         Agent Spawner / Notifier            │
│  • Se agent online → push via WS            │
│  • Se agent offline → queue + notify        │
│  • Cria task se action required             │
└─────────────────────────────────────────────┘
```

### 2.3 Estrutura de Mensagem (Unificada)

```typescript
interface ChatMessage {
  id: string;                           // UUID
  conversation_id: string;              // UUID
  direction: 'inbound' | 'outbound';
  sender: {
    type: 'user' | 'agent' | 'system';
    id: string;                         // user_id ou agent_id
    name: string;
    avatar?: string;
  };
  content: string;                      // Markdown/texto
  content_type: 'text' | 'markdown' | 'blocks' | 'files';
  blocks?: ChatBlock[];                 // Structured (Slack blocks, Discord embeds)
  attachments?: Attachment[];
  thread_id?: string;                   // Thread reply
  metadata: {
    provider_message_id: string;
    provider_timestamp: string;
    raw_payload?: any;                  // Para debug/auditoria
  };
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  timestamps: {
    created: Date;
    sent?: Date;
    delivered?: Date;
    read?: Date;
  };
}
```

---

## 3. Orquestração Interna (Paperclip Runtime)

### 3.1 Task Dispatch Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Client     │────►│  API        │────►│  Task       │────►│  Agent      │
│  (User/     │     │  Gateway    │     │  Dispatcher │     │  Runtime    │
│   Agent)    │     │  (REST)     │     │  (Queue)    │     │  (ACP/MCP)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                          │                    │                    │
                          ▼                    ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
                    │  AuthZ      │     │  Budget     │     │  Sandbox    │
                    │  Check      │     │  Reserve    │     │  Provider   │
                    └─────────────┘     └─────────────┘     └─────────────┘
```

### 3.2 Runtime API (Paperclip `runtime-api.ts`)

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/runtime/agents/:id/spawn` | POST | Inicia agent no sandbox |
| `/runtime/agents/:id/execute` | POST | Executa task no agent |
| `/runtime/agents/:id/cancel` | POST | Cancela execução |
| `/runtime/agents/:id/status` | GET | Status + heartbeat |
| `/runtime/agents/:id/logs` | GET | Stream de logs (SSE) |
| `/runtime/workspaces/:id/snapshot` | POST | Cria snapshot |
| `/runtime/workspaces/:id/restore` | POST | Restaura snapshot |

### 3.3 Heartbeat & Admission Control

- **Heartbeat interval:** 30s (configurável)
- **Admission policy:** `max_concurrent_runs_per_agent`, `max_concurrent_runs_per_company`
- **Idle detection:** 10min sem atividade → suspende sandbox
- **Watchdog:** 5min sem heartbeat → marca agent unhealthy, trigger recovery

---

## 4. Delegação Externa (Hermes Gateway + Agency Agents)

### 4.1 Hermes Plugin Tools (4 ferramentas)

| Tool | Input | Output | Uso |
|------|-------|--------|-----|
| `agency_agents_search` | `{query?, division?, skills?, limit?}` | `AgentSummary[]` | Discovery |
| `agency_agents_inspect` | `{slug}` | `AgentFull` | Inspecionar metadados + body |
| `agency_agents_load` | `{slug, context?}` | `{systemPrompt, metadata}` | Injetar no contexto Hermes |
| `agency_agents_delegate` | `{slug, task, context?}` | `{result, evidence, artifacts}` | Spawn subagent |

### 4.2 Delegação Lazy-Load (Não carrega todo catálogo)

```typescript
// Hermes Main Agent
const searchResults = await agency_agents_search({
  query: "rust performance optimization",
  division: "engineering",
  limit: 5
});

// Usuário escolhe ou auto-seleciona top match
const agent = await agency_agents_inspect({ slug: searchResults[0].slug });

// Injeta system prompt no contexto atual
await agency_agents_load({ slug: agent.slug, context: { project: "nettoscorp-enterprise" } });

// Para tarefas complexas, delega a subagente especializado
const result = await agency_agents_delegate({
  slug: "engineering-rust-refactoring-specialist",
  task: "Optimize the hot path in workspace-recovery.ts",
  context: {
    repo: "paperclip",
    files: ["server/src/services/workspace-recovery.ts"],
    constraints: "Maintain backward compatibility, zero downtime"
  }
});
```

### 4.3 Ciclo de Vida do Subagente Hermes

```
Hermes Main Agent
      │
      ├── agency_agents_delegate(slug, task, context)
      │       │
      │       ▼
      │  Hermes Gateway (HTTP/SSE)
      │       │
      │       ▼
      │  Agency Agents Plugin Router
      │       │
      │       ▼
      │  Spawn Subagent (ACP stdio ou HTTP)
      │       │
      │       ▼
      │  Subagent executa com system prompt do agente
      │       │
      │       ▼
      │  Retorna: {result, evidence, artifacts, cost, duration}
      │       │
      ▼       │
Result + Evidence integrado ao contexto principal
```

### 4.4 Timeouts, Cancelamento, Fallback

| Cenário | Mitigação |
|---------|-----------|
| **Timeout** | Default 5min (configurável). Retorna partial + `timeout: true` |
| **Cancelamento** | `Hermes cancel_task` propaga `SIGTERM` ao subagent via Gateway |
| **Agente não encontrado** | Erro estruturado `AGENT_NOT_FOUND` com sugestões de search |
| **Catálogo desatualizado** | Plugin expõe `catalog_version` + `last_synced`; Hermes compara |
| **Subagent failure** | Retry 1x com contexto de erro; se persistir, retorna erro ao main |
| **Context window overflow** | `delegate` roda em sub-contexto isolado; `load` injeta só system prompt |

---

## 5. NEXUS Pipeline Integration (Agency Agents)

### 5.1 Fases do Pipeline (Integrado ao Task Dispatch)

| Fase | Agente NEXUS | Paperclip Equivalente | Trigger |
|------|--------------|----------------------|---------|
| **Planning** | `project-manager-senior` | `dispatch_task` → cria task list | Nova spec recebida |
| **Architecture** | `ArchitectUX` (design/ux-architect) | Cria spec técnica + arquitetura | Task list aprovada |
| **Development** | `Frontend Developer`, `Backend Architect`, etc. | `dispatch_task` por task | Task atribuída |
| **QA Loop** | `EvidenceQA` (testing-evidence-collector) | `dispatch_task` → QA agent | Dev completa task |
| **Integration** | `testing-reality-checker` | Final validation + smoke tests | Todas tasks PASS |

### 5.2 QA Gate (NEXUS → Paperclip)

```typescript
interface QAGateResult {
  status: 'PASS' | 'FAIL';
  evidence: {
    screenshots: string[];           // URLs ou base64
    test_results: TestResult[];      // Unit, integration, e2e
    manual_verification: string;     // Descrição do que foi verificado
  };
  feedback: string;                  // Específico para retry
  severity: 'critical' | 'major' | 'minor' | 'info';
}

// No Paperclip Task Dispatcher:
async function executeWithNexusQA(taskId: string, agentId: string) {
  const maxRetries = 3; // NEXUS default

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // 1. Executa Dev agent
    const devResult = await dispatchTask(agentId, taskId);

    // 2. Spawn QA Agent (EvidenceQA)
    const qaResult = await dispatchTask('testing-evidence-collector', {
      task: `Verify task ${taskId}: ${devResult.summary}`,
      context: { implementation: devResult.artifacts }
    });

    // 3. Avalia gate
    if (qaResult.status === 'PASS') {
      await markTaskComplete(taskId);
      return { success: true, attempts: attempt };
    }

    // 4. FAIL → feedback para retry
    await addTaskFeedback(taskId, qaResult.feedback);
  }

  // 5. Escalate após 3 tentativas
  await escalateTask(taskId, { attempts: maxRetries, lastFeedback: qaResult.feedback });
  return { success: false, escalated: true };
}
```

### 5.3 Handoffs Estruturados (Task Delegation)

| Handoff | De | Para | Contexto Passado | Validação |
|---------|-----|------|------------------|-----------|
| Spec → Plan | User/PM | PM Agent | Spec doc + constraints | Task list criada |
| Plan → Arch | PM Agent | Architect | Task list + spec | Arch docs criados |
| Arch → Dev | Architect | Dev Agent | Arch docs + task | Implementation |
| Dev → QA | Dev Agent | QA Agent | Implementation + task | PASS/FAIL + evidence |
| QA → Decision | QA Agent | Orchestrator | PASS/FAIL + feedback | Continue/Retry/Escalate |
| All → Integration | Orchestrator | Reality Checker | All implementations | Final PASS/FAIL |

---

## 6. Team Presets (Agency Agents → Paperclip Teams)

| Preset | Divisões | Agentes-Chave | Uso Típico |
|--------|----------|---------------|------------|
| **Full Stack Squad** | engineering (4), design (1), testing (1) | frontend-dev, backend-arch, ux-arch, evidence-qa | Feature completa |
| **Security Audit** | security (3), engineering (1) | security-arch, pentest, threat-intel, code-review | Security review |
| **Data Pipeline** | engineering (2), gis (1) | data-engineer, gis-analyst, ml-engineer | ETL/ML pipeline |
| **Growth Team** | marketing (3), sales (1), product (1) | growth-hacker, seo, content, account-strategist | Launch campaign |
| **Incident Response** | security (2), engineering (2) | incident-responder, sre, threat-intel, debugger | Production incident |

---

## 7. Observabilidade da Comunicação

| Métrica | Fonte | Alerta |
|---------|-------|--------|
| **Message latency (p95)** | Chat delivery timestamps | > 2s |
| **Agent response time (p95)** | Task dispatch → first response | > 30s |
| **Delegation success rate** | Hermes delegate → result | < 95% |
| **QA first-pass rate** | NEXUS Dev→QA PASS | < 70% |
| **Retry rate** | Task retry_count > 0 | > 30% |
| **Context overflow events** | Hermes subagent context truncation | > 5% |
| **Sandbox startup time** | Workspace ready timestamp | > 60s |

---

## 8. Gaps e Trabalho Futuro

| Gap | Status | Prioridade |
|-----|--------|------------|
| Hermes plugin quebrado (`build-hermes-plugin.py` ausente) | 🔴 Crítico | P0 |
| NEXUS playbooks/runbooks não disponíveis no checkout | 🟡 Alto | P1 |
| Multi-project orchestration (NEXUS) | 🟢 Planejado | P2 |
| Cross-agent memory sharing (RAG) | 🟢 Planejado | P2 |
| Structured handoff protocol (protobuf/JSON Schema) | 🟢 Planejado | P3 |

---

## 9. Estrutura Operacional Implanta — TokenizAi no Paperclip

A estrutura abaixo foi registrada historicamente no banco do Paperclip antes da migração. Não comprova o estado atual e não deve ser usada operacionalmente.

### 9.1 Hierarquia da Organização TokenizAi

| Nível | Cargo | UUID | Status | Subordinação |
|-------|-------|------|--------|--------------|
| Fundador | Netto Farias | — | Autoridade máxima | — |
| Chefe de Gabinete | Hermes | — | Coordenador operacional | Reporta ao Founder |
| Diretor Executivo | CEO | 78fb964b-0c1e-4b1c-9656-241a053bb111 | running | Reporta ao Founder |
| Diretor Comercial | CCO | dce13e51-7927-47b4-bb83-3a975ccb721e | idle | Reporta ao CEO |
| Diretor Financeiro | CFO | 1584c40b-a34c-48b0-983e-5c9c48b7bb76 | idle | Reporta ao CEO |
| Diretor de Marketing | CMO | df803b1c-6bb9-4d65-a36a-9fa93ad593de | idle | Reporta ao CEO |
| Diretor de Operações | COO | f6a35541-1b68-4f07-86f7-8fb0553ebb83 | idle | Reporta ao CEO |
| Diretor de Produto | CPO | 557aea55-3a1b-4e45-9262-7292aedaa005 | idle | Reporta ao CEO |
| Diretor de Tecnologia | CTO | 8e5dee7f-5508-4680-bc2a-032db517b19c | idle | Reporta ao CEO |
| Função de Apoio | Summarizer | ff982e58-d038-4cb4-a293-4296dfead797 | paused | Reporta ao CEO |

### 9.2 Equipes e Membros (267 Agentes da Agency Agents)

| Diretor | Divisões | Membros |
|---------|----------|---------|
| CTO | engineering, security, testing, gis, spatial-computing, game-development | 111 |
| CMO | marketing, paid-media | 44 |
| CEO | research, academic, healthcare, specialized | 69 |
| COO | project-management, support | 13 |
| CPO | product, design | 16 |
| CCO | sales | 9 |
| CFO | finance | 5 |
| Summarizer | Função de apoio | 0 |

**Total:** 267 agentes especialistas + 7 diretores executivos = 275 agentes na organização TokenizAi.

### 9.3 Documentação dos Agentes

| Documento | Qtd Esperada | Qtd Encontrada | Status |
|-----------|--------------|----------------|--------|
| AGENTS.md | 267 | 267 | ✅ Completo |
| SOUL.md | 267 | 267 | ✅ Completo |
| HEARTBEAT.md | 267 | 267 | ✅ Completo |
| TOOLS.md | 267 | 267 | ✅ Completo |

Todos os 267 agentes possuem documentação individual completa, específica de cada agente, extraída do corpus original da Agency Agents.

### 9.4 Hierarquia Conferida

- CEO sem superior (`reports_to = NULL`).
- 7 diretores operacionais subordinados ao CEO.
- Summarizer subordinado ao CEO como função de apoio.
- 267 especialistas subordinados aos respectivos diretores.
- Zero agentes sem hierarquia (exceto o CEO como raiz).
- Zero relações circulares.
- Zero superiores inexistentes.

---

*Registro histórico da estrutura anterior à migração. O modelo Paperclip foi substituído pela integração direta com Hermes; este documento não descreve o runtime atual.*
