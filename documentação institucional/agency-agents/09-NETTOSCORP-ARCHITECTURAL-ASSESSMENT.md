# Agency Agents — Avaliação Arquitetural para NettosCorp (09-NETTOSCORP-ARCHITECTURAL-ASSESSMENT)

> **Data:** 21 de novembro de 2026  
> **Checkout:** `/home/lg/workspace/NettosCorp/NettosCorp/enterprise/agency-agents`  
> **Contexto:** NettosCorp opera Paperclip (orchestration platform) + Hermes (agent runtime) + DefesaI Saúde (B2C app)

---

## 1. Mapeamento de Necessidades NettosCorp vs Capacidades Agency Agents

| Necessidade NettosCorp | Agency Agents Offering | Fit | Gap |
|------------------------|------------------------|-----|-----|
| **Catálogo de especialistas institucionais** | 282 agentes, 21 divisões, frontmatter rico | ✅ Alto | Precisa filtrar/estender para domínio NettosCorp |
| **Identidade/persona por agente** | name, description, color, emoji, vibe, tools | ✅ Alto | `ai/` instructions externas não inclusas |
| **Orquestração multi-agente** | `agents-orchestrator` (pipeline Dev-QA) | ⚠️ Parcial | Sequencial, sem playbooks reutilizáveis, sem NEXUS completo |
| **Integração Hermes** | 4 tools declaradas + plugin router | ❌ Quebrada | `build-hermes-plugin.py` ausente |
| **Provisionamento em ferramentas** | 18 tools, 8 installable no app, convert.sh para todas | ✅ Alto | Aider/Windsurf/OpenClaw/Kimi recognized-only |
| **Reconciliação de estado** | Ledger + 5-state reconcile (CURRENT/OUTDATED/MODIFIED/REMOVED/FOREIGN) | ✅ Alto | Core diferencial — reutilizável |
| **Governança/autoridade** | Não nativo (catálogo agnóstico) | ❌ Ausente | Precisa camada de RBAC + approval gates |
| **Memória/aprendizado** | Apenas "Learning & Memory" no prompt | ❌ Prompt-only | Sem persistência real |
| **Paperclip integration** | Catálogo pode ser fonte de agents Paperclip | ✅ Potencial | Precisa adapter Paperclip ↔ Agency Agents |

---

## 2. Análise por Pilar NettosCorp

### 2.1 Identidade Institucional (A)

**Como adaptar identidades individuais ao modelo institucional?**

| Agency Agents | NettosCorp Precisa | Adaptação |
|---------------|-------------------|-----------|
| `name` + `description` | Cargo + responsabilidade | Mapear divisões → departamentos NettosCorp |
| `color` + `emoji` + `vibe` | Visual identity system | Estender com `department`, `clearance_level`, `reports_to` |
| `tools` (Claude Code list) | Tool access policy | Mapear para Paperclip tool gateway + Hermes tools |
| `Instructions Reference` → `ai/agents/*.md` | Conhecimento institucional persistido | Substituir por `nettoscorp://knowledge/<topic>` URIs |

**Recomendação:** Estender frontmatter com campos NettosCorp:
```yaml
nettoscorp:
  department: "engineering"           # Mapeia division
  role_level: "senior"                # junior|mid|senior|lead|principal
  clearance: "internal"               # public|internal|restricted|classified
  reports_to: "engineering-lead"      # Slug do supervisor
  authority: "execute|approve|escalate"  # Decision limits
  knowledge_domains: ["rust", "tauri", "paperclip"]  # Para routing
```

### 2.2 Governança (B)

**Como garantir respeito à autoridade do fundador + hierarquia?**

| Gap Atual | Solução NettosCorp |
|-----------|-------------------|
| Sem RBAC | Implementar `clearance` + `authority` no frontmatter + runtime enforcement |
| Sem approval gates | Integrar com Paperclip `approval` system (já existe) |
| Sem hierarquia operacional | `reports_to` + org chart validation no spawn |
| Sem protocolos institucionais | `protocol_pack` URI no agente → carrega regras NettosCorp |
| Sem comunicação inter-agente | Hermes `delegate` + Paperclip `issue`/`case` handoff |

**Arquitetura proposta:**
```
NettosCorp Governance Layer
├── Agent Registry (extended frontmatter)
├── Authority Engine (validates spawn/delegate per clearance)
├── Approval Gateway (Paperclip integration)
├── Protocol Loader (loads nettoscorp://protocol/*)
└── Audit Log (all agent actions)
```

### 2.3 Paperclip (C)

**Como o catálogo funciona junto ao Paperclip?**

| Paperclip Need | Agency Agents Capability | Integration Path |
|----------------|-------------------------|------------------|
| Agent discovery | 282 agents, search by division/skills | `corpus_list` + `corpus_get` via Tauri IPC ou REST |
| Agent provisioning | Install/reconcile em 8 tools | Paperclip `agent_hire` → chama Tauri `install_agent` |
| Specialty mapping | 21 divisions → Paperclip roles | Division mapping table |
| Task delegation | `agents-orchestrator` + Hermes `delegate` | Paperclip `run_dispatch` → Hermes `agency_agents_delegate` |
| Context sync | File-based (specs, tasks, architecture) | Paperclip workspace = source of truth |
| Handoffs | Orchestrator filesystem handoffs | Paperclip `case_handoff` + `issue_thread` |
| Execution tracking | Ledger + reconcile (5 states) | Paperclip `agent_runtime_state` + `run_identity_contexts` |

**Integration Pattern:**
```
Paperclip (Orchestrator)          Agency Agents (Catalog + Runtime)
┌─────────────────────┐           ┌─────────────────────────────┐
│ agent_hire(slug)    │──────────►│ corpus_get(slug)            │
│                     │◄──────────│ Returns agent + raw source  │
│ install_agent()     │──────────►│ install_agent(tool, scope)  │
│                     │◄──────────│ Ledger entry + reconcile    │
│ dispatch_run(task)  │──────────►│ agency_agents_delegate()    │
│                     │◄──────────│ Subagent result             │
│ reconcile_state()   │──────────►│ installs_reconcile()        │
└─────────────────────┘           └─────────────────────────────┘
```

### 2.4 Hermes (D)

**Como usar integração existente sem duplicar catálogo?**

| Problema | Solução |
|----------|---------|
| Plugin Hermes quebrado (`build-hermes-plugin.py` ausente) | **Prioridade 1**: Recuperar do upstream ou reimplementar em Rust |
| Catálogo duplicado (Hermes + Paperclip + Agency) | **Single source**: Agency Agents corpus → sync para Hermes via plugin + Paperclip via API |
| Lazy-loading necessário | Plugin Hermes deve expor `search/inspect/load/delegate` — **não** carregar todos os 282 agents no contexto |
| Subagent lifecycle | Hermes `delegate` já suporta spawn isolado — `agency_agents_delegate` usa isso |

**Arquitetura Lazy-Load:**
```
Hermes Context (pequeno)
      │
      ├── agency_agents_search("rust tauri") → [{slug, name, desc, division}]
      │
      ├── agency_agents_inspect("engineering-senior-developer") → full agent
      │
      ├── agency_agents_load("engineering-frontend-developer") → inject system prompt
      │
      └── agency_agents_delegate("engineering-rust-refactoring-specialist", task) → result
```

### 2.5 Memória e Conhecimento (E)

**Distinção crítica: Prompt vs Persistência Real**

| Agency Agents Atual | Realidade | NettosCorp Precisa |
|---------------------|-----------|-------------------|
| `## 🔄 Learning & Memory` section no prompt | **Apenas texto** — nenhuma persistência cross-session | Knowledge graph persistido (Supabase/PostgreSQL) |
| `Instructions Reference` → `ai/agents/dev.md` | Arquivo local esperado — **não versionado no catálogo** | Institutional knowledge base (RAG + vector store) |
| `Memory: You remember...` | LLM context window only | Long-term memory com embeddings + retrieval |
| No cross-agent learning | Cada agente isolado | Shared memory layer com attribution |

**Arquitetura de Memória NettosCorp:**
```
NettosCorp Memory Layer
├── Declarative Knowledge (RAG)
│   ├── Institutional policies (immutable)
│   ├── Project specs (versioned)
│   ├── Technical decisions (ADRs)
│   └── Agent learnings (attributed, reviewable)
├── Episodic Memory (Vector DB)
│   ├── Task executions + outcomes
│   ├── Code patterns + results
│   └── Failure patterns + resolutions
├── Procedural Memory (Skills)
│   ├── Reusable workflows (Paperclip routines)
│   ├── Tool usage patterns
│   └── Best practices (validated)
└── Access Control
    ├── Clearance-based read/write
    ├── Attribution required
    └── Audit trail
```

---

## 3. Matriz de Riscos por Integração

| Integração | Risco Técnico | Risco Organizacional | Mitigação |
|------------|---------------|---------------------|-----------|
| **Paperclip ← Agency Agents** | Schema drift (frontmatter extensões) | Catálogo upstream muda sem aviso | Version pin + adapter layer + sync automation |
| **Hermes ← Agency Agents** | Plugin quebrado, lazy-load não testado | Hermes agents usam versões stale | Fix plugin primeiro; versioned catalog sync |
| **Governança** | Sem enforcement runtime | Agentes excedem autoridade | Authority engine em Paperclip (validar antes de spawn) |
| **Memória** | Prompt-only → loss on compact | Conhecimento institucional perdido | Implementar memory layer separado (Supabase) |
| **Upstream sync** | Fork Tokenizaa diverge do msitarzewski | Perde updates de catálogo/NEXUS | Automated sync + local patches apenas |

---

## 4. Esforço Estimado por Workstream

| Workstream | Esforço | Dependências | Prioridade |
|------------|---------|--------------|------------|
| **Fix Hermes Plugin** | 2-3 semanas | Upstream `build-hermes-plugin.py` ou reimpl Rust | 🔴 Crítico |
| **Extend Frontmatter (NettosCorp fields)** | 1 semana | Schema validation + migration | 🔴 Crítico |
| **Authority Engine (Paperclip)** | 3-4 semanas | Paperclip RBAC + approval system | 🔴 Crítico |
| **Catalog Sync Pipeline** | 2 semanas | GitHub webhook / polling + diff | 🟡 Alto |
| **Paperclip Agent Hire Integration** | 2 semanas | Tauri IPC ou REST bridge | 🟡 Alto |
| **Memory Layer (Supabase)** | 4-6 semanas | Vector DB + RAG pipeline | 🟡 Alto |
| **NEXUS Methodology Adoption** | 3-4 semanas | Upstream strategy/ docs | 🟢 Médio |
| **CI/CD Pipeline** | 1 semana | GitHub Actions | 🟢 Médio |

---

## 5. Decisão: Fork vs Upstream Sync

**Recomendação:** **Manter fork Tokenizaa para app Tauri**, mas **sincronizar catálogo + scripts + NEXUS do upstream msitarzewski** via pipeline automatizado.

```
msitarzewski/agency-agents (upstream canonical)
    │
    ├── strategy/ (NEXUS) ──────────────────► NettosCorp docs/methodology
    ├── scripts/ (lib.sh, install.sh, etc.) ┐
    ├── corpus/ (282+ agents) ──────────────► NettosCorp extended corpus
    └── integrations/hermes/ ──────────────► Hermes plugin source
           │
           ▼
Tokenizaa/agency-agents-app (fork with Tauri app)
    │
    ├── src-tauri/ (Rust app) ──────────────► NettosCorp Paperclip bridge
    └── src/ (Svelte UI) ──────────────────► NettosCorp Admin UI (optional)
```

---

## 6. Evidências

| Item | Fonte |
|------|-------|
| Catálogo 282 agents | `find src-tauri/resources/corpus-baseline -name "*.md" \| wc -l` |
| Divisions 21 | `src-tauri/data/agency-categories.json` |
| Tools 18 (8 installable) | `src-tauri/data/tools.json` + `docs/PLAN.md:75-92` |
| Hermes plugin ref | `tools.json:17`, `convert.sh:791-794` |
| Agents orchestrator | `src-tauri/resources/corpus-baseline/specialized/agents-orchestrator.md` |
| Install/reconcile | `src-tauri/src/install/mod.rs` |
| Paperclip context | Memória Hermes (sessão anterior) |
| NettosCorp context | Memória Hermes (sessão anterior) |

---

## 7. Conclusão

**O Agency Agents é um catálogo rico e bem estruturado** com infraestrutura de instalação/reconciliação de ponta (ledger + 5-state reconcile). O **app Tauri adiciona UX nativa e determinismo Rust**.

**Para NettosCorp, os gaps críticos são:**
1. **Governança/autoridade** — não existe no catálogo, precisa camada própria
2. **Hermes plugin quebrado** — bloqueia integração nativa
3. **Memória apenas no prompt** — precisa persistência real
4. **NEXUS methodology ausente no fork** — precisa sync do upstream

**Oportunidade única:** O **reconcile engine (ledger + hash-match)** é diretamente reutilizável no Paperclip para rastrear estado de agents instalados across tools.

**Próximo passo:** Recuperar `build-hermes-plugin.py` do upstream e validar integração Hermes end-to-end antes de investir em camadas superiores.

---

*Documento baseado em análise cruzada de todos os documentos de engenharia reversa anteriores + contexto NettosCorp/Paperclip/Hermes da memória.*