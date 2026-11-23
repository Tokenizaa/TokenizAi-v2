# Engenharia Reversa — Agency Agents

> **Versão:** 1.0  
> **Data:** 21 de novembro de 2026  
> **Checkout Local:** `/home/lg/workspace/NettosCorp/NettosCorp/enterprise/agency-agents`  
> **Remote:** `Tokenizaa/agency-agents-app` (fork de `msitarzewski/agency-agents`)  
> **Commit:** `da407fe` (v0.3.2)  
> **Upstream Canônico:** `msitarzewski/agency-agents` (commit `8ae6164`)  
> **Responsável:** Hermes

---

## 1. Classificação da Evidência

| Componente | Status | Fonte |
|------------|--------|-------|
| Catálogo (282 agentes) | **EVIDENCIADO** | `src-tauri/resources/corpus-baseline/` — 282 arquivos `.md` |
| Divisões (21) | **EVIDENCIADO** | `src-tauri/data/agency-categories.json` |
| Ferramentas (18) | **EVIDENCIADO** | `src-tauri/data/tools.json` |
| Conversor (`convert.sh`) | **EVIDENCIADO** | 954 linhas, 15 formatos |
| App Tauri (Rust) | **EVIDENCIADO** | `src-tauri/src/` — corpus, render, install, registry |
| UI Svelte 5 | **EVIDENCIADO** | `src/` — 4 pilares: Agents, Tools, Teams, Projects |
| NEXUS Strategy | **AUSENTE NO CHECKOUT** | Existe apenas no upstream (`msitarzewski/agency-agents/strategy/`) |
| Hermes Plugin | **QUEBRADO** | `build-hermes-plugin.py` ausente, referenciado em `tools.json` + `convert.sh` |
| Scripts validação | **AUSENTES** | `lib.sh`, `install.sh`, `lint-agents.sh`, `check-divisions.sh`, `check-tools.sh` ausentes |
| CI/CD | **AUSENTE** | `.github/workflows/` vazio no fork |

---

## 2. Ecossistema Agency Agents

### 2.1 Dupla Natureza

| Repositório | Tipo | Conteúdo |
|-------------|------|----------|
| `msitarzewski/agency-agents` (upstream) | **Catálogo Canônico** | 282 agentes `.md`, 21 divisões, `tools.json`, `scripts/` completos, `strategy/` (NEXUS) |
| `Tokenizaa/agency-agents-app` (fork local) | **App Tauri** | App desktop nativo (Rust + Svelte) para browse/install/reconcile, **sem** `strategy/` nem scripts completos |

> **Importante:** O checkout local é o **fork do app**, não o catálogo completo. O catálogo vive no upstream e é sincronizado via GitHub tarball.

---

## 3. Catálogo de Especialistas

### 3.1 Inventário (282 agentes, 21 divisões)

| Divisão | Qtd | % | Exemplos-Chave |
|---------|-----|----|----------------|
| **engineering** | 65 | 23% | frontend-developer, backend-architect, senior-developer, ai-engineer, devops-automator |
| **specialized** | 59 | 21% | agents-orchestrator, chief-financial-officer, business-strategist, automation-governance-architect |
| **marketing** | 37 | 13% | growth-hacker, content-creator, seo-specialist, tiktok-strategist |
| **game-development** | 21 | 7% | unity-architect, unreal-systems-engineer, godot-multiplayer-engineer |
| **gis** | 13 | 4.6% | gis-analyst, cartography-designer, geoai-ml-engineer |
| **security** | 12 | 4.2% | security-architect, penetration-tester, threat-intelligence-analyst |
| **design** | 10 | 3.5% | ux-architect, ui-designer, brand-guardian |
| **sales** | 9 | 3.2% | account-strategist, deal-strategist, sales-engineer |
| **testing** | 9 | 3.2% | evidence-collector, reality-checker, api-tester |
| **project-management** | 7 | 2.5% | project-manager-senior, experiment-tracker |
| **paid-media** | 7 | 2.5% | ppc-strategist, programmatic-buyer |
| **finance** | 5 | 1.8% | financial-analyst, fpa-analyst, tax-strategist |
| **product** | 6 | 2.1% | product-manager, sprint-prioritizer, dx-engineer |
| **academic** | 6 | 2.1% | psychologist, statistician, historian |
| **spatial-computing** | 6 | 2.1% | visionos-spatial-engineer, xr-interface-architect |
| **support** | 6 | 2.1% | support-responder, analytics-reporter |
| **healthcare** | 3 | 1.1% | clinical-evidence-agent, innovation-strategist |
| **research** | 1 | 0.3% | research-synthesist |
| **TOTAL** | **282** | **100%** | |

### 3.2 Formato do Agente (Canônico)

```markdown
---
name: Frontend Developer              # Obrigatório
description: Expert frontend...       # Obrigatório
color: cyan                           # Para OpenCode (named color → hex)
emoji: 🖥️                            # Para OpenClaw IDENTITY.md
vibe: Builds responsive...            # Tagline pessoal
tools: Read, Write, Edit, Bash...     # Opcional: lista Claude Code tools
---
# Corpo com seções padronizadas:
## 🧠 Your Identity & Memory
## 🎯 Your Core Mission
## 🚨 Critical Rules You Must Follow
## 📋 Your Technical Deliverables
## 🔄 Your Workflow Process
## 📋 Your Deliverable Template
## 💭 Your Communication Style
## 🔄 Learning & Memory
## 🎯 Your Success Metrics
## 🚀 Advanced Capabilities
---
**Instructions Reference**: `ai/agents/dev.md` (arquivo externo — NÃO existe no baseline)
```

### 3.3 Qualidade e Consistência

| Métrica | Status | Evidência |
|---------|--------|-----------|
| Frontmatter obrigatório (`name`, `description`) | ✅ 100% | Parse do corpus |
| `color` (para OpenCode) | ⚠️ ~95% | Fallback gray `#6B7280` |
| `emoji` + `vibe` (para OpenClaw) | ⚠️ ~90% | Fallback name + description |
| `tools` (para Qwen/ZCode) | ⚠️ ~15% | Apenas agentes que precisam mapeamento |
| Estrutura de seções padrão | ✅ ~95% | Template consistente |
| Slug uniqueness | ✅ 0 duplicatas | `check_agent_slug_collisions()` no convert.sh |
| Instructions Reference externo | ⚠️ ~20% | Arquivos `ai/agents/*.md` **não existem no baseline** |

---

## 4. Identidades e Personas

### 4.1 Mapeamento Frontmatter → Formatos de Ferramenta

| Campo | Claude | Codex | Gemini | Cursor | OpenCode | Qwen | ZCode | OpenClaw | Kimi |
|-------|--------|-------|--------|--------|----------|------|-------|----------|------|
| `name` | filename | `name` | `name`=slug | — | `name` | `name`=slug | `name`=slug | IDENTITY.md | agent.yaml |
| `description` | body | `description` | `description` | `description` | `description` | `description` | `description` | SOUL/AGENTS | system.md |
| `color` | — | — | — | — | hex | — | — | — | — |
| `emoji` | — | — | — | — | — | — | — | IDENTITY.md | — |
| `vibe` | — | — | — | — | — | — | — | IDENTITY.md | — |
| `tools` | nativo | — | — | — | — | mapeado | pass-through | — | — |
| `body` | verbatim | `developer_instructions` | body | body | body | body | body | SOUL/AGENTS | system.md |

### 4.2 Archetypes por Divisão

| Divisão | Archetype | Tom | Memória Declarada |
|---------|-----------|-----|-------------------|
| Engineering | Technical Craftsperson | Preciso, performance-obsessed | "Remembers successful patterns, optimization techniques" |
| Specialized | Domain Authority | Autoritativo, estratégico | "Builds expertise over time, knows difference between basic and luxury" |
| Marketing | Growth Experimenter | Data-driven, criativo | "Remembers viral patterns, algorithm shifts" |
| Game Dev | Systems Designer | Criativo-técnico, player-centric | "Remembers what feels fun, what balances" |
| Security | Paranoid Guardian | Cético, evidence-based | "Remembers attack patterns, bypass techniques" |
| Design | Aesthetic Architect | Empático, sistemático | "Remembers what delights, what converts" |

---

## 5. Metodologia NEXUS

### 5.1 Estado no Checkout Local

| Artefato | Status | Localização |
|----------|--------|-------------|
| `nexus-strategy.md` | ❌ **AUSENTE** | Apenas no upstream |
| `EXECUTIVE-BRIEF.md` | ❌ **AUSENTE** | Apenas no upstream |
| `QUICKSTART.md` | ❌ **AUSENTE** | Apenas no upstream |
| `coordination/` | ❌ **AUSENTE** | Apenas no upstream |
| `playbooks/` | ❌ **AUSENTE** | Apenas no upstream |
| `runbooks/` | ❌ **AUSENTE** | Apenas no upstream |
| `runbooks.json` | ❌ **AUSENTE** | Apenas no upstream |
| `agents-orchestrator.md` | ✅ **PRESENTE** | `specialized/agents-orchestrator.md` no corpus |

### 5.2 Pipeline do Agents Orchestrator (Extraído do Agente)

```
Pipeline: PM → ArchitectUX → [Dev ↔ QA Loop] → Integration

1. Phase 1: Project Analysis & Planning
   → Spawn project-manager-senior → task list

2. Phase 2: Technical Architecture  
   → Spawn ArchitectUX → tech foundation + UX

3. Phase 3: Development-QA Continuous Loop
   → Para cada task: Dev → EvidenceQA → PASS/FAIL → retry ou advance

4. Phase 4: Final Integration & Validation
   → Spawn testing-reality-checker → final certification
```

### 5.3 Handoffs e Quality Gates (do Agente)

| Handoff | De | Para | Artefato | Validação |
|---------|-----|------|----------|-----------|
| Spec → Tasks | PM | Orchestrator | `project-tasks/[project]-tasklist.md` | `ls -la` |
| Tasks → Arch | PM | ArchitectUX | Task list + spec | Architect cria docs |
| Arch → Dev | ArchitectUX | Dev | `css/`, `project-docs/*-architecture.md` | `ls -la` |
| Dev → QA | Dev | EvidenceQA | Implementation + task | QA testa com screenshots |
| QA → Decision | EvidenceQA | Orchestrator | PASS/FAIL + feedback | Orchestrator decide |
| All → Integration | Orchestrator | Reality Checker | All implementations | Default "NEEDS WORK" |

### 5.4 Retry Logic

- Máximo **3 tentativas por task** (Dev → QA → FAIL → retry)
- Tentativa 4+: **ESCALATE** com relatório detalhado
- QA agent failure → retry QA spawn
- Screenshot capture failure → request manual evidence
- Evidence inconclusive → default to FAIL (safety)

### 5.5 Gaps vs. NEXUS Completo (Upstream)

| Aspecto NEXUS | No Agente Local | Gap |
|---------------|-----------------|-----|
| Playbooks reutilizáveis | Pipeline hardcoded | ❌ Ausente |
| Runbooks para incidentes | Error handling básico | ❌ Ausente |
| `runbooks.json` index | ❌ | ❌ Ausente |
| Métricas de eficiência | Contadores básicos | ❌ Sem metodologia |
| Multi-project orchestration | Single project | ❌ Ausente |
| Context passing patterns | Filesystem apenas | Básico |

> **Conclusão:** A metodologia NEXUS completa **não está disponível** neste checkout. O agente `agents-orchestrator` implementa um subconjunto prático (pipeline Dev-QA sequencial), mas carece de playbooks, runbooks, coordenação multi-projeto e métricas validadas.

---

## 6. Integração Hermes

### 6.1 Estado: **QUEBRADA**

| Componente | Status | Evidência |
|------------|--------|-----------|
| `tools.json` entry | ✅ Declarado | `format: "hermes-router-plugin"`, `dest: ".hermes/plugins/agency-agents-router"` |
| `convert.sh` trigger | ✅ Referenciado | Linha 791-794: `python3 build-hermes-plugin.py` |
| `build-hermes-plugin.py` | ❌ **AUSENTE** | `find . -name "build-hermes-plugin.py"` → vazio |
| Rust render support | ❌ Não implementado | Cai em `unsupported()` no `render/mod.rs` |

### 6.2 Ferramentas Declaradas (4)

| Ferramenta | Propósito |
|------------|-----------|
| `agency_agents_search` | Busca agentes por query, divisão, skills |
| `agency_agents_inspect` | Retorna metadados + corpo completo |
| `agency_agents_load` | Injeta agente no contexto Hermes (system prompt) |
| `agency_agents_delegate` | Spawna subagente especializado para tarefa |

### 6.3 Ciclo de Vida do Subagente (Projetado)

```
Hermes Main Agent
      │
      ├── agency_agents_search("frontend react performance")
      │       ↓ Returns: [{slug, name, desc, division}]
      │
      ├── agency_agents_inspect("engineering-senior-developer")
      │       ↓ Returns: full agent metadata + body
      │
      ├── agency_agents_load("engineering-frontend-developer")
      │       ↓ Injects system prompt into current context
      │
      └── agency_agents_delegate("engineering-rust-refactoring-specialist", task)
              ↓ Spawns subagent with agent's system prompt
              ↓ Returns: result + evidence
```

### 6.4 Recuperação Necessária

1. Obter `build-hermes-plugin.py` do upstream `msitarzewski/agency-agents/scripts/`
2. Colocar em `src-tauri/resources/corpus-baseline/scripts/`
3. Executar `./scripts/convert.sh --tool hermes`
4. Verificar output em `integrations/hermes/agency-agents-router/`
5. Testar instalação no Hermes Agent

---

## 7. Ferramentas Suportadas (18)

| Status | Ferramentas | installKind | Observação |
|--------|-------------|-------------|------------|
| ✅ **Installable (8)** | claude-code, codex, gemini-cli, copilot, qwen, cursor, opencode, osaurus | per-agent | App Tauri suporta nativamente |
| ⚠️ **Recognized-only (10)** | aider, antigravity, kimi, openclaw, windsurf, vibe, zcode, dsh, hermes, deepseekHarness | per-agent / roster / plugin | Precisam renderers multi-file ou fixes |

### Bloqueadores Conhecidos

| Ferramenta | Bloqueador | Status |
|------------|------------|-------|
| **Antigravity** | `date_added: '${TODAY}'` non-deterministic | 🔴 Crítico — parity test impossível |
| **Aider/Windsurf** | Roster format (multi-file) não implementado | 🟡 Alto |
| **OpenClaw/Kimi** | Multi-file (3 arquivos / 2 arquivos) não implementado | 🟡 Alto |
| **Hermes** | `build-hermes-plugin.py` ausente | 🔴 Crítico |

---

## 8. App Tauri (Rust + Svelte) — Diferenciais Técnicos

| Componente | Funcionalidade | Evidência |
|------------|----------------|-----------|
| **Corpus Sync** | GitHub tarball fetch + diff + re-index | `corpus/mod.rs` |
| **Render Engine** | 12 formatos, byte-parity com convert.sh | `render/mod.rs` + parity test |
| **Install + Reconcile** | Ledger + 5-state (CURRENT/OUTDATED/MODIFIED/REMOVED/FOREIGN) | `install/mod.rs` |
| **Atomic Writes + Backup** | Nunca sobrescreve sem preservar estado anterior | `install/mod.rs:156-185` |
| **Deterministic Render** | 23 unit tests, parity test (ignored) | `render/mod.rs:606-871` |
| **Tool Registry** | `tools.json` carregado em compile-time | `registry.rs` |

---

## 9. Referência aos Documentos Detalhados

Para análise completa, consultar os 12 documentos de engenharia reversa em:
- `/home/lg/workspace/NettosCorp/TokenizAi/docs/agency-agents/` (cópia)
- `/home/lg/workspace/NettosCorp/NettosCorp/enterprise/agency-agents/docs/reverse-engineering/` (origem)

| Documento | Foco |
|-----------|------|
| `00-OVERVIEW.md` | Visão geral, ecossistema, gaps |
| `01-REPOSITORY-STRUCTURE.md` | Estrutura completa, fluxo de dados |
| `02-AGENT-CATALOG.md` | Inventário 282 agentes, qualidade |
| `03-AGENT-IDENTITY-AND-PERSONAS.md` | Frontmatter, personas, mapeamento tools |
| `04-NEXUS-ORCHESTRATION.md` | Pipeline, handoffs, gaps vs upstream |
| `05-HANDOFF-AND-QUALITY-GATES.md` | Matriz handoffs, 5-state reconcile, gates |
| `06-HERMES-INTEGRATION.md` | Plugin quebrado, 4 tools, recovery plan |
| `07-CONVERSION-AND-INSTALLATION.md` | convert.sh, 15 formatos, install flow |
| `08-TESTING-AND-CI.md` | 23 Rust tests, zero CI, scripts ausentes |
| `09-NETTOSCORP-ARCHITECTURAL-ASSESSMENT.md` | Avaliação para NettosCorp |
| `10-INTEGRATION-OPPORTUNITIES-WITH-PAPERCLIP.md` | 10 oportunidades, roadmap |
| `11-TECHNICAL-RISKS-AND-INCONSISTENCIES.md` | 20 riscos (4 críticos), mitigação |

---

*Este documento consolida a engenharia reversa do Agency Agents. Lacunas (NEXUS completo, Hermes plugin, scripts validação) são registradas explicitamente. Documentos detalhados disponíveis nos arquivos de referência.*