# Arquitetura Alvo — NettosCorp Enterprise

> **Versão:** 1.0  
> **Data:** 21 de novembro de 2026  
> **Status:** **PROPOSTA** — Aguarda aprovação do Founder  
> **Base:** Consolidação de TokenizAi + Agency Agents + Paperclip  
> **Responsável:** Hermes

---

## 1. Princípios Fundamentais

| Princípio | Implementação |
|-----------|---------------|
| **Single Source of Truth** | Catálogo único de agentes (Agency Agents upstream) → sync para Paperclip Skill Catalog + Hermes Plugin |
| **Runtime Agnostic** | Um agente = múltiplos runtimes (ACP, MCP, CLI, HTTP) via renderers determinísticos |
| **Governança Nativa** | RBAC hierárquico + clearance + authority limits + audit trail imutável |
| **Memória Institucional** | RAG + Knowledge Graph + Vector DB + atribuição + clearance-based access |
| **Reconciliação Contínua** | Ledger + hash-match + 5-state (Paperclip) aplicado a skills, plugins, MCP, agents |
| **Isolamento por Design** | Perfil ≠ Instância ≠ Runtime ≠ Organização (RLS nativo + namespaces) |

---

## 2. Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NETTOSCORP ENTERPRISE PLATFORM                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    GOVERNANCE LAYER (Central)                        │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │    │
│  │  │ Identity &  │ │ Authority   │ │ Policy      │ │ Audit &     │   │    │
│  │  │ Access      │ │ Engine      │ │ Engine      │ │ Compliance  │   │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│          ┌─────────────────────────┼─────────────────────────┐             │
│          ▼                         ▼                         ▼             │
│  ┌───────────────┐        ┌───────────────┐        ┌───────────────┐      │
│  │  CATALOG      │        │  ORCHESTRATION│        │  RUNTIME      │      │
│  │  SERVICES     │        │  ENGINE       │        │  FABRIC       │      │
│  │               │        │               │        │               │      │
│  │ • Skill       │        │ • Task        │        │ • ACP Adapters│      │
│  │   Catalog     │        │   Dispatch    │        │   (12 ready)  │      │
│  │ • Agent       │        │ • Delegation  │        │ • MCP Server  │      │
│  │   Registry    │        │   & Handoff   │        │   + Gateway   │      │
│  │ • Division    │        │ • NEXUS       │        │ • Plugin SDK  │      │
│  │   Mapping     │        │   Pipeline    │        │   (v1.0.0)    │      │
│  │ • Reconcile   │        │ • Workflow    │        │ • Sandbox     │      │
│  │   Engine      │        │   Engine      │        │   Providers   │      │
│  └───────────────┘        └───────────────┘        └───────────────┘      │
│          │                         │                         │             │
│          └─────────────────────────┼─────────────────────────┘             │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    DATA & MEMORY LAYER                                │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │    │
│  │  │ PostgreSQL  │ │ Vector DB   │ │ Knowledge   │ │ Ledger &    │   │    │
│  │  │ (RLS +      │ │ (RAG +      │ │ Graph       │ │ Reconcile   │   │    │
│  │  │  Multi-     │ │  Embeddings)│ │ (Attributed)│ │ (5-state)   │   │    │
│  │  │  tenant)    │ │             │ │             │ │             │   │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Camadas Detalhadas

### 3.1 Governance Layer (Novo — Core Diferencial)

| Componente | Função | Fonte |
|------------|--------|-------|
| **Identity & Access** | AuthN/AuthZ central, JWT + session, multi-tenant, RLS enforcement | Paperclip Better Auth + extensões |
| **Authority Engine** | Valida `delegate()` → clearance + authority limits + approval gates | **Novo** — Paperclip RBAC + NEXUS delegation |
| **Policy Engine** | Regras declarativas (OPA/Rego) para budgets, tool access, data access | **Novo** — Extensão Paperclip budgets |
| **Audit & Compliance** | Immutable log (append-only), tamper-evident, queryável | Paperclip activity_log + extensões |

### 3.2 Catalog Services (Paperclip Skill Catalog + Agency Agents)

| Serviço | Função | Fonte |
|---------|--------|-------|
| **Skill Catalog** | CRUD skills, versionamento, dependências, install/reconcile | Paperclip `skill-package-store` + Agency Agents corpus |
| **Agent Registry** | Agentes como skills instanciáveis, com contrato de cargo | Agency Agents corpus (282) + Paperclip `agent-lifecycle` |
| **Division Mapping** | 21 divisões → NettosCorp roles/clearance/department | Agency Agents divisions + **novo mapping** |
| **Reconcile Engine** | Ledger + 5-state (CURRENT/OUTDATED/MODIFIED/REMOVED/FOREIGN) | Paperclip `install/mod.rs` → **generalizado** |

### 3.3 Orchestration Engine (Paperclip + NEXUS)

| Componente | Função | Fonte |
|------------|--------|-------|
| **Task Dispatch** | `dispatch_task(agent, task, context)` → queue → runtime | Paperclip `run-dispatch` + `runtime-api` |
| **Delegation & Handoff** | `delegate(task, context)` → subagent → result + evidence | Hermes `agency_agents_delegate` + NEXUS pipeline |
| **NEXUS Pipeline** | PM → Architect → [Dev ↔ QA Loop] → Integration | Agency Agents `agents-orchestrator` |
| **Workflow Engine** | Rotinas, triggers, pipelines, SLA, escalation | Paperclip `routines`, `pipelines`, `heartbeat` |

### 3.4 Runtime Fabric (Paperclip + Agency Agents + Hermes)

| Camada | Componentes | Fonte |
|--------|-------------|-------|
| **ACP Adapters** | 12 adapters prontos (claude, codex, cursor, gemini, copilot, qwen, etc.) | Paperclip `packages/adapters/*` |
| **MCP Layer** | STDIO server + HTTP/SSE Gateway + OAuth + Apps/Skills registry | Paperclip `mcp-server` + `public-mcp` |
| **Plugin SDK** | Worker isolation, RPC, UI bridge, sandbox providers (9) | Paperclip `plugin-sdk` v1.0.0 |
| **Hermes Bridge** | Plugin router (lazy-load), 4 tools: search/inspect/load/delegate | Agency Agents Hermes plugin (precisa fix) |
| **Sandbox Providers** | 9 providers (Daytona, E2B, Modal, K8s, Cloudflare, Boxd, etc.) | Paperclip `sandbox-providers` |

---

## 4. Data & Memory Layer

### 4.1 PostgreSQL (Multi-tenant + RLS)

- **Schema único, RLS nativo** — `company_id` em todas tabelas, policies ativáveis
- **Tabelas Core** — companies, memberships, roles, agents, skills, workspaces, issues, cases, budgets
- **RLS Policies** — `company_id = current_setting('app.current_company_id')::uuid`
- **Migrations** — Drizzle + 490+ migrations versionadas, drift detection

### 4.2 Vector DB (RAG + Embeddings)

| Componente | Tech | Uso |
|------------|------|-----|
| **Embeddings** | `text-embedding-3-large` (OpenAI) ou local (BGE) | Agent instructions, docs, code |
| **Vector Store** | pgvector (PostgreSQL) ou Pinecone/Weaviate | Similarity search, RAG retrieval |
| **Retrieval** | Hybrid (vector + keyword + graph) | Agent memory, knowledge lookup |

### 4.3 Knowledge Graph (Attributed)

- **Entidades** — Agents, Skills, Decisions, Patterns, Incidents
- **Relacionamentos** — `authored_by`, `derived_from`, `depends_on`, `supersedes`
- **Atribuição** — Cada nó/aresta tem `author`, `timestamp`, `clearance`, `evidence`
- **Query** — Cypher/Gremlin via Apache Age (PostgreSQL) ou Neo4j

### 4.4 Ledger & Reconcile (Generalizado do Paperclip)

| Estado | Definição | Ação |
|--------|-----------|------|
| **CURRENT** | Installed == re-rendered | No-op |
| **OUTDATED** | Corpus moved on (source hash changed) | Auto-update disponível |
| **MODIFIED** | User edited installed file | Flag para review, não sobrescreve |
| **REMOVED** | File missing but in ledger | Alert + restore option |
| **FOREIGN** | File exists but not in ledger | Quarentena, opção de adopt/remove |

**Aplicável a:** Agent installs, Skill versions, Plugin installs, MCP server configs, Sandbox images

---

## 5. Multi-tenancy & Isolamento

| Nível | Isolamento | Implementação |
|-------|------------|---------------|
| **Organization** | RLS `company_id` | PostgreSQL policies |
| **Instance** | Namespace + config隔离 | Settings per instance |
| **Profile** | Perfil de agente + clearance | Frontmatter estendido |
| **Runtime** | Sandbox provider + resource limits | Sandbox provider (9) |
| **Data** | Vector DB namespace + clearance | Vector DB namespaces |

---

## 5. Roadmap de Implementação (Fases)

| Fase | Entregável | Semanas | Dependências |
|------|------------|---------|--------------|
| **0** | Fix Hermes Plugin + Recuperar scripts upstream | 1 | Upstream access |
| **1** | Foundation: `@nettoscorp/shared`, `@nettoscorp/db`, `@nettoscorp/auth` | 2-3 | — |
| **2** | Adapters & MCP: Publicar 12 adapters + MCP server/gateway | 1-2 | Fase 1 |
| **3** | Plugin SDK: `@nettoscorp/plugin-sdk` v2 independente | 1 | Fase 1 |
| **4** | Frontend Shared: `@nettoscorp/ui-primitives`, `@nettoscorp/frontend-query` | 2 | Fase 1 |
| **5** | Module Architecture: Federation no server + UI | 3-4 | Fases 1-4 |
| **6** | Catalog Sync Pipeline: GitHub webhook → Paperclip Skill Catalog | 2 | Fase 1 |
| **7** | Agent Hire Flow: AA corpus → Paperclip agent provisioning | 2 | Fase 5, 6 |
| **8** | Governance Layer: Authority Engine, Policy Engine, Audit | 3-4 | Fase 5 |
| **9** | Memory Layer: Vector DB + RAG + Knowledge Graph | 4-6 | Fase 8 |
| **10** | NEXUS Adoption: Playbooks, Runbooks, Workflow Engine | 3-4 | Fase 8 |
| **11** | Unified CI/CD + Observability | 2 | Fase 5 |
| **12** | Homologação + Documentação Final | 2 | Todas |

---

## 6. Decisões Técnicas Pendentes (Requer Aprovação)

| Decisão | Opções | Recomendação |
|---------|--------|--------------|
| **Vector DB** | pgvector (PG) vs Pinecone vs Weaviate | pgvector (unified PG, custo zero) |
| **Knowledge Graph** | Apache Age (PG extension) vs Neo4j | Apache Age (unified PG) |
| **Workflow Engine** | Paperclip routines + NEXUS vs Temporal vs custom | Paperclip + NEXUS (reutilização) |
| **API Gateway** | Cloudflare Workers (atual) vs Kong vs custom | Cloudflare Workers (já em TokenizAi) |
| **Secrets** | 1Password (Paperclip) vs Vault vs AWS Secrets | 1Password (já integrado) |

---

*Esta é uma proposta de arquitetura alvo. Requer aprovação do Founder (Netto Farias) antes de iniciar implementação. Cada fase terá revisão técnica e validação antes de prosseguir.*