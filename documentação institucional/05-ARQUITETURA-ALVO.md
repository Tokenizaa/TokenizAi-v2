# Arquitetura Alvo — NettosCorp Enterprise

> **REVISÃO OBRIGATÓRIA — 25/11/2026:** Este documento foi escrito antes da migração e contém propostas baseadas no Paperclip que não representam a arquitetura operacional atual. TokenizAi V2 utiliza integração direta com Hermes; Paperclip não deve ser instalado, iniciado, configurado ou acessado. As referências remanescentes abaixo são contexto histórico e não requisitos de implementação.

> **Versão:** 1.0  
> **Data:** 21 de novembro de 2026  
> **Status:** **PROPOSTA HISTÓRICA — REBASELINE NECESSÁRIA; NÃO EXECUTAR SEM REVISÃO**  
> **Base:** TokenizAi + Agency Agents + Hermes (sem dependência Paperclip)  
> **Responsável:** Hermes

---

## 1. Princípios Fundamentais

| Princípio | Implementação |
|-----------|---------------|
| **Single Source of Truth** | Catálogo único de agentes (Agency Agents upstream) → sincronização controlada para catálogo próprio e provisionamento via Hermes |
| **Runtime Agnostic** | Um agente = múltiplos runtimes (ACP, MCP, CLI, HTTP) via renderers determinísticos |
| **Governança Nativa** | RBAC hierárquico + clearance + authority limits + audit trail imutável |
| **Memória Institucional** | RAG + Knowledge Graph + Vector DB + atribuição + clearance-based access |
| **Reconciliação Contínua** | Ledger + hash-match + 5-state (modelo conceitual de reconciliação) aplicado a skills, plugins, MCP, agents |
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
| **Identity & Access** | AuthN/AuthZ central, JWT + session, multi-tenant, RLS enforcement | Supabase Auth + RLS e autorização no BFF |
| **Authority Engine** | Valida `delegate()` → clearance + authority limits + approval gates | **Novo** — RBAC próprio + limites de autoridade + NEXUS |
| **Policy Engine** | Regras declarativas (OPA/Rego) para budgets, tool access, data access | **Novo** — Políticas próprias de orçamento e acesso |
| **Audit & Compliance** | Immutable log (append-only), tamper-evident, queryável | trilha de auditoria própria, append-only |

### 3.2 Catalog Services (Catálogo próprio + Agency Agents)

| Serviço | Função | Fonte |
|---------|--------|-------|
| **Skill Catalog** | CRUD skills, versionamento, dependências, install/reconcile | serviço de catálogo TokenizAi + Agency Agents corpus |
| **Agent Registry** | Agentes como skills instanciáveis, com contrato de cargo | Agency Agents corpus + provisionamento controlado via Hermes |
| **Division Mapping** | 21 divisões → NettosCorp roles/clearance/department | Agency Agents divisions + **novo mapping** |
| **Reconcile Engine** | Ledger + 5-state (CURRENT/OUTDATED/MODIFIED/REMOVED/FOREIGN) | algoritmo de ledger/hash-match → **implementação própria** |

### 3.3 Orchestration Engine (Hermes + NEXUS)

| Componente | Função | Fonte |
|------------|--------|-------|
| **Task Dispatch** | `dispatch_task(agent, task, context)` → queue → runtime | API e ferramentas do Hermes |
| **Delegation & Handoff** | `delegate(task, context)` → subagent → result + evidence | Hermes `agency_agents_delegate` + NEXUS pipeline |
| **NEXUS Pipeline** | PM → Architect → [Dev ↔ QA Loop] → Integration | Agency Agents `agents-orchestrator` |
| **Workflow Engine** | Rotinas, triggers, pipelines, SLA, escalation | rotinas e workflows próprios integrados ao Hermes |

### 3.4 Runtime Fabric (Hermes + Agency Agents + adaptadores independentes)

| Camada | Componentes | Fonte |
|--------|-------------|-------|
| **ACP Adapters** | 12 adapters prontos (claude, codex, cursor, gemini, copilot, qwen, etc.) | adaptadores independentes, quando implementados e homologados |
| **MCP Layer** | STDIO server + HTTP/SSE Gateway + OAuth + Apps/Skills registry | MCP próprio/externo, desacoplado do runtime |
| **Plugin SDK** | Worker isolation, RPC, UI bridge, sandbox providers (9) | contratos de plugin próprios, se necessários |
| **Hermes Bridge** | Plugin router (lazy-load), 4 tools: search/inspect/load/delegate | Agency Agents Hermes plugin (precisa fix) |
| **Sandbox Providers** | 9 providers (Daytona, E2B, Modal, K8s, Cloudflare, Boxd, etc.) | provedores de sandbox selecionados e integrados independentemente |

---

## 4. Data & Memory Layer

### 4.1 PostgreSQL (Multi-tenant + RLS)

- **Schema único, RLS nativo** — `company_id` em todas tabelas, policies ativáveis
- **Tabelas Core** — companies, memberships, roles, agents, skills, workspaces, issues, cases, budgets
- **RLS Policies** — `company_id = current_setting('app.current_company_id')::uuid`
- **Migrations** — Supabase migrations versionadas e validação de drift

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

### 4.4 Ledger & Reconcile (implementação própria)

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
| **6** | Catalog Sync Pipeline: GitHub webhook → catálogo próprio TokenizAi → Hermes | 2 | Fase 1 |
| **7** | Agent Provisioning: Agency Agents corpus → TokenizAi → Hermes | 2 | Fase 5, 6 |
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
| **Workflow Engine** | Hermes + NEXUS vs Temporal vs custom | Hermes + NEXUS (integração direta) |
| **API Gateway** | Cloudflare Workers (atual) vs Kong vs custom | Cloudflare Workers (já em TokenizAi) |
| **Secrets** | 1Password vs Vault vs AWS Secrets | 1Password (já integrado) |

---

*Esta é uma proposta de arquitetura alvo. Requer aprovação do Founder (Netto Farias) antes de iniciar implementação. Cada fase terá revisão técnica e validação antes de prosseguir.*