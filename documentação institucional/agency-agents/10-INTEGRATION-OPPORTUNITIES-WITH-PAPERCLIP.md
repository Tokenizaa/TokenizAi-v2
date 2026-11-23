# Agency Agents — Oportunidades de Integração com Paperclip (10-INTEGRATION-OPPORTUNITIES-WITH-PAPERCLIP)

> **Data:** 21 de novembro de 2026  
> **Base:** Engenharia reversa completa (documentos 00-09) + Contexto Paperclip/Hermes/NettosCorp

---

## 1. Resumo de Oportunidades

| # | Oportunidade | Impacto | Esforço | Paperclip Component |
|---|--------------|---------|---------|---------------------|
| 1 | **Agent Catalog as Paperclip Skill Source** | 🔴 Alto | Médio | `packages/skills-catalog`, `server/src/services/skill-package-store.ts` |
| 2 | **Reconcile Engine Reuse** | 🔴 Alto | Baixo | `server/src/services/workspace-recovery*.ts`, `install/mod.rs` pattern |
| 3 | **Hermes Plugin Bridge** | 🔴 Alto | Médio | `packages/adapters/hermes/`, `server/src/routes/tool-gateway.ts` |
| 4 | **Division → Paperclip Role Mapping** | 🟡 Médio | Baixo | `server/src/services/authorization.ts`, company roles |
| 5 | **Agent Hire Flow Integration** | 🟡 Médio | Médio | `server/src/services/agent-lifecycle.ts`, `agents.ts` |
| 6 | **Task Delegation via Hermes** | 🟡 Médio | Médio | `server/src/services/agent-task-sessions.ts`, `runtime-api.ts` |
| 7 | **Corpus Sync as Managed Catalog** | 🟢 Baixo | Baixo | `server/src/services/corpus` (novo) |
| 8 | **NEXUS Methodology Adoption** | 🟢 Baixo | Alto | `server/src/modules/*`, workflow engine |
| 9 | **Tool Gateway Extension** | 🟢 Baixo | Médio | `server/src/routes/tool-gateway.ts`, `mcpGatewayProtocolRoutes` |
| 10 | **Memory/Knowledge Layer** | 🟢 Baixo | Alto | Novo módulo Paperclip |

---

## 2. Detalhamento das Top 5 Oportunidades

### 2.1 Agent Catalog as Paperclip Skill Source

**Conceito:** Usar os 282 agentes do Agency Agents como **skills instaláveis** no Paperclip.

**Mapeamento:**
| Agency Agents | Paperclip Equivalent |
|---------------|---------------------|
| Agent (slug, name, description, body) | Skill Package (name, description, instructions, metadata) |
| Division (21) | Skill Category / Domain |
| Frontmatter `tools` | Skill `required_tools` / `capabilities` |
| `installKind: per-agent` | Skill versioning + installation |
| `convert.sh` renderers | Skill formatters per runtime (Paperclip runner, Hermes, CLI) |

**Arquitetura:**
```
Agency Agents Corpus (source of truth)
       │
       ├── Sync Pipeline (GitHub webhook / polling)
       │       ▼
       ▼
Paperclip Skill Catalog Service
       │
       ├── skill-package-store.ts (adaptado)
       │       ▼
       ▼
Paperclip Agent Hire Flow
       │
       ├── agent-lifecycle.ts → hire_agent(slug)
       │       ▼
       ▼
Skill Package → Agent Config + Runtime State
```

**Vantagens:**
- 282 skills prontos dia 1
- Divisões = categorias organizacionais
- Frontmatter rico = metadata para busca/filtro
- Tools mapping = capacidades declarativas

**Esforço:** ~2-3 semanas (adapter layer + sync pipeline + UI)

---

### 2.2 Reconcile Engine Reuse (O "Killer Feature")

**O Paperclip JÁ TEM reconciliação complexa** (workspace recovery, git restore points, snapshot comparison). **O Agency Agents tem um modelo mais limpo: Ledger + Hash-match 5-state.**

**Comparação:**

| Aspecto | Paperclip (Workspace) | Agency Agents (Agent Install) |
|---------|----------------------|-------------------------------|
| **Unit of reconcile** | Execution workspace (git repo + files) | Single agent file per tool |
| **State tracking** | Snapshots + restore points + leases | Ledger (installs.json) + 3 hashes |
| **States** | Active, stale, corrupted, recovered | CURRENT, OUTDATED, MODIFIED, REMOVED, FOREIGN |
| **Drift detection** | Git status + hash comparison | Render hash vs ledger hash |
| **Remediation** | Restore point, re-clone, fallback | Re-render + overwrite (with backup) |
| **Multi-tool** | N/A (workspace = single project) | **Sim** — mesmo agent em 8 tools simultaneamente |

**Oportunidade:** **Extrair `ReconcileEngine` genérico** do Agency Agents e aplicar no Paperclip para:
- Agent installations across tools
- Skill package versions
- Plugin installations
- MCP server configs

**Código reutilizável (Rust → TypeScript port):**
```typescript
// Conceito: GenericReconciler<T>
interface Reconciler<T> {
  // Ledger entry
  record: LedgerEntry<T>;           // source_hash, rendered_hash, body_hash, dest, metadata
  // Current state
  current: T | null;                // Re-rendered current version
  // 5-state classification
  classify(): 'CURRENT' | 'OUTDATED' | 'MODIFIED' | 'REMOVED' | 'FOREIGN';
  // Remediation
  remediate(action: 'update' | 'restore' | 'remove'): Result;
}
```

**Esforço:** ~1 semana (port do algoritmo + integração nos services Paperclip)

---

### 2.3 Hermes Plugin Bridge

**Status Atual:** Quebrado (`build-hermes-plugin.py` ausente no fork).

**Oportunidade:** **Consertar + Estender** para integração Paperclip↔Hermes bidirecional.

**Arquitetura Alvo:**
```
Paperclip Server                          Hermes Agent
┌─────────────────────────┐               ┌─────────────────────────┐
│ agency-agents catalog   │               │ agency-agents plugin    │
│ (corpus + index)        │◄── sync ────►│ (lazy-load router)      │
│                         │               │                         │
│ agent_hire(slug)        │──────────────►│ agency_agents_load()    │
│                         │               │ injects system prompt   │
│ dispatch_task(agent,    │──────────────►│ agency_agents_delegate()│
│   task, context)        │               │ spawns subagent         │
│                         │               │ returns result          │
│ reconcile_agent_state() │◄──────────────│ plugin reports status   │
└─────────────────────────┘               └─────────────────────────┘
```

**Tarefas:**
1. Recuperar `build-hermes-plugin.py` do upstream msitarzewski/agency-agents
2. Gerar plugin `agency-agents-router` funcional
3. Estender plugin com `agency_agents_sync` (Paperclip → Hermes catalog push)
4. Integrar no Paperclip `agent-lifecycle.ts` → `hire_agent` chama Hermes plugin

**Esforço:** ~2-3 semanas (recover + extend + integrate)

---

### 2.4 Division → Paperclip Role Mapping

**Mapeamento Direto:**

| Agency Division | Paperclip Role/Department | Clearance Default |
|-----------------|---------------------------|-------------------|
| engineering | Engineering | internal |
| specialized | Leadership / Strategy | restricted |
| marketing | Marketing | internal |
| security | Security / Compliance | classified |
| project-management | PMO | internal |
| finance | Finance | classified |
| legal (em specialized) | Legal | classified |
| sales | Business Development | internal |
| product | Product | internal |
| design | Design | internal |
| testing | QA | internal |
| devops (em engineering) | Platform/Infra | restricted |

**Implementação:**
```typescript
// server/src/services/authorization.ts extension
const DIVISION_TO_ROLE: Record<string, { role: string; clearance: ClearanceLevel }> = {
  'engineering': { role: 'engineer', clearance: 'internal' },
  'security': { role: 'security-engineer', clearance: 'classified' },
  'specialized': { role: 'strategist', clearance: 'restricted' },
  // ...
};

// No agent hire:
function hireAgent(slug: string) {
  const agent = corpus.get(slug);
  const mapping = DIVISION_TO_ROLE[agent.category];
  return createAgentConfig({
    ...agent,
    nettoscorp: {
      department: mapping.role,
      clearance: mapping.clearance,
      authority: inferAuthority(mapping.role),
    }
  });
}
```

**Esforço:** ~3 dias (mapping table + integration no `agent-lifecycle.ts`)

---

### 2.5 Agent Hire Flow Integration

**Paperclip Atual:** `agent-lifecycle.ts` → `hireAgent` cria config do zero.

**Com Agency Agents:** `hireAgent(slug)` → busca no corpus → usa agent como base → estende com campos NettosCorp.

**Fluxo:**
```typescript
// server/src/services/agent-lifecycle.ts
async function hireAgent(slug: string, options?: HireOptions): Promise<AgentConfig> {
  // 1. Fetch from Agency Agents corpus (local cache or sync)
  const aaAgent = await corpus.get(slug);
  if (!aaAgent) throw new NotFoundError(`Agent ${slug} not in catalog`);
  
  // 2. Map division → NettosCorp role/clearance
  const roleMapping = DIVISION_TO_ROLE[aaAgent.category];
  
  // 3. Build Paperclip AgentConfig from AA agent
  const config: AgentConfig = {
    name: aaAgent.name,
    description: aaAgent.description,
    instructions: aaAgent.body,  // Full prompt as instructions
    model: options?.model || 'claude-3-5-sonnet',
    tools: mapTools(aaAgent.frontmatter.tools),  // AA tools → Paperclip tool gateway
    metadata: {
      source: 'agency-agents',
      source_slug: slug,
      division: aaAgent.category,
      nettoscorp: {
        department: roleMapping.role,
        clearance: roleMapping.clearance,
        authority: inferAuthority(roleMapping.role),
        knowledge_domains: extractDomains(aaAgent.body),
      }
    }
  };
  
  // 4. Persist + provision in tools (via install service)
  await installAgentInTools(config, options?.tools);
  
  return config;
}
```

**Esforço:** ~2 semanas (corpus client + mapping + tool provisioning integration)

---

## 3. Outras Oportunidades (Resumo)

| # | Oportunidade | Descrição | Paperclip Touchpoints |
|---|--------------|-----------|----------------------|
| 6 | **Task Delegation via Hermes** | `agency_agents_delegate` → Paperclip `run_dispatch` | `runtime-api.ts`, `agent-task-sessions.ts` |
| 7 | **Corpus Sync as Managed Catalog** | Paperclip gerencia sync do corpus (como `catalog_provision_managed`) | Novo `corpus` service, `catalog_source_set` |
| 8 | **NEXUS Methodology** | Adotar playbooks/runbooks do upstream para workflows Paperclip | `server/src/modules/*`, workflow engine |
| 9 | **Tool Gateway Extension** | Expor agents AA como tools no Paperclip tool gateway | `tool-gateway.ts`, `mcpGatewayProtocolRoutes` |
| 10 | **Memory/Knowledge Layer** | Substituir prompt-only memory por RAG persistido | Novo módulo `memory` ou estender `workspace-runtime` |

---

## 4. Mapa de Integração Técnica

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NETTOSCORP INTEGRATION LAYER                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  AGENCY AGENTS (Upstream)                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Corpus (282 agents) │ Divisions (21) │ Tools.json (18) │ NEXUS     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│            │                    │                    │                     │
│            ▼                    ▼                    ▼                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SYNC PIPELINE (GitHub webhook/polling)            │   │
│  │  • Corpus diff → Paperclip Skill Catalog                            │   │
│  │  • Tools.json → Paperclip Tool Registry                             │   │
│  │  • Divisions → Role/Clearance Mapping                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│            │                    │                    │                     │
│            ▼                    ▼                    ▼                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      PAPERCLIP CORE SERVICES                         │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │  │ Skill       │ │ Agent       │ │ Reconcile   │ │ Tool        │    │   │
│  │  │ Catalog     │ │ Lifecycle   │ │ Engine      │ │ Gateway     │    │   │
│  │  │ (adapted)   │ │ (AA source) │ │ (AA port)   │ │ (extended)  │    │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│            │                    │                    │                     │
│            ▼                    ▼                    ▼                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      RUNTIME INTEGRATIONS                            │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │  │ Hermes      │ │ MCP         │ │ Paperclip   │ │ Workspace   │    │   │
│  │  │ Plugin      │ │ Server      │ │ Runner      │ │ Recovery    │    │   │
│  │  │ (fixed)     │ │ (AA skills) │ │ (AA agents) │ │ (AA reconcile)│   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Priorização e Roadmap Sugerido

| Fase | Entregável | Semanas | Dependências |
|------|------------|---------|--------------|
| **0** | Recuperar `build-hermes-plugin.py` + validar Hermes plugin | 1 | Upstream access |
| **1** | Corpus sync pipeline + Skill Catalog adapter | 2-3 | Fase 0 |
| **2** | Reconcile Engine port + integração Paperclip install | 1-2 | Fase 1 |
| **3** | Agent Hire Flow (AA → Paperclip) + Division mapping | 2 | Fase 1, 2 |
| **4** | Hermes Plugin fix + bridge bidirecional | 2-3 | Fase 0, 3 |
| **5** | Task Delegation (Paperclip → Hermes → AA agent) | 2 | Fase 4 |
| **6** | NEXUS playbooks adoption + workflow engine | 4+ | Upstream strategy/ |
| **7** | Memory/Knowledge Layer (RAG) | 6+ | Supabase + vector DB |

---

## 6. Evidências

| Item | Fonte |
|------|-------|
| Paperclip skill catalog | `packages/skills-catalog/`, `server/src/services/skill-package-store.ts` |
| Paperclip agent lifecycle | `server/src/services/agent-lifecycle.ts`, `server/src/services/agents.ts` |
| Paperclip reconcile | `server/src/services/workspace-recovery*.ts`, `server/src/services/workspace-runtime.ts` |
| Paperclip Hermes adapter | `packages/adapters/hermes/`, `server/src/routes/tool-gateway.ts` |
| Paperclip tool gateway | `server/src/routes/tool-gateway.ts`, `server/src/services/tool-gateway.ts` |
| Agency Agents corpus | `src-tauri/resources/corpus-baseline/` (282 agents) |
| Agency Agents tools.json | `src-tauri/data/tools.json` (18 tools) |
| Agency Agents reconcile | `src-tauri/src/install/mod.rs` (ledger + 5-state) |
| Agency Agents Hermes ref | `tools.json:17`, `convert.sh:791-794` |

---

*Documento baseado em análise cruzada de todos os 10 documentos de engenharia reversa + arquitetura Paperclip conhecida da memória.*