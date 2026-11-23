# Agency Agents — Engenharia Reversa: Identidade e Personas dos Agentes (03-AGENT-IDENTITY-AND-PERSONAS)

> **Data:** 21 de novembro de 2026  
> **Checkout:** `/home/lg/workspace/NettosCorp/NettosCorp/enterprise/agency-agents`  
> **Fonte:** 282 agentes em `src-tauri/resources/corpus-baseline/`

---

## 1. Modelo de Identidade (Frontmatter)

Cada agente declara sua identidade via 6 campos no frontmatter YAML:

```yaml
---
name: Frontend Developer              # Identificador humano (unique-ish)
description: Expert frontend...       # Elevator pitch (usado em lists, search)
color: cyan                           # Cor nomeada → hex via resolve_opencode_color()
emoji: 🖥️                            # Identificador visual (UI, OpenClaw IDENTITY.md)
vibe: Builds responsive...            # Tagline pessoal (OpenClaw IDENTITY.md)
tools: Read, Write, Edit, Bash...     # Opcional: tools Claude Code (para Qwen/ZCode mapping)
---
```

---

## 2. Mapeamento de Identidade para Formatos de Ferramenta

| Campo Frontmatter | Claude Code | Codex | Gemini | Cursor | OpenCode | Qwen | ZCode | Osaurus/Antigravity/DSH | OpenClaw | Kimi |
|-------------------|-------------|-------|--------|--------|----------|------|-------|------------------------|----------|------|
| `name` | ✅ filename | ✅ `name` field | ✅ `name`=slug | ✅ — | ✅ `name` | ✅ `name`=slug | ✅ `name`=slug | ✅ `name`=agency-slug | ✅ IDENTITY.md | ✅ agent.yaml |
| `description` | ✅ body | ✅ `description` | ✅ `description` | ✅ `description` | ✅ `description` | ✅ `description` | ✅ `description` | ✅ `description` | ✅ SOUL/AGENTS | ✅ system.md |
| `color` | ❌ | ❌ | ❌ | ❌ | ✅ `color` (hex) | ❌ | ❌ | ❌ | ❌ | ❌ |
| `emoji` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ IDENTITY.md | ❌ |
| `vibe` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ IDENTITY.md | ❌ |
| `tools` | ✅ nativo | ❌ | ❌ | ❌ | ❌ | ✅ mapped | ✅ pass-through | ❌ | ❌ | ❌ |
| `body` (prompt) | ✅ verbatim | ✅ `developer_instructions` | ✅ body | ✅ body | ✅ body | ✅ body | ✅ body | ✅ body | ✅ SOUL/AGENTS | ✅ system.md |

---

## 3. Persona Archetypes por Divisão

### Engineering (65 agents) — Technical Craftsperson
- **Tone:** Precise, performance-obsessed, detail-oriented
- **Memory:** "Remembers successful patterns, optimization techniques"
- **Experience:** "Has seen apps succeed through great UX, fail through poor implementation"
- **Success Metrics:** Lighthouse >90, <3s load, zero console errors, 80%+ component reuse

### Specialized (59 agents) — Domain Authority
- **Tone:** Authoritative, strategic, outcome-focused
- **Memory:** "Builds expertise over time, remembers what creates premium feel"
- **Experience:** "Knows difference between basic and luxury / compliance and risk"
- **Success Metrics:** Business outcomes, compliance passed, premium feel achieved

### Marketing (37 agents) — Growth Experimenter
- **Tone:** Data-driven, creative, platform-native
- **Memory:** "Remembers viral patterns, algorithm shifts, community dynamics"
- **Experience:** "Has scaled communities, launched campaigns, optimized funnels"
- **Success Metrics:** CAC/LTV, engagement rates, viral coefficient, conversion

### Game Development (21 agents) — Systems Designer
- **Tone:** Creative-technical, player-centric, iterative
- **Memory:** "Remembers what feels fun, what balances, what retains"
- **Experience:** "Has shipped titles, seen economies collapse, narratives land"
- **Success Metrics:** Retention D1/D7/D30, session length, monetization, fun factor

### Security (12 agents) — Paranoid Guardian
- **Tone:** Skeptical, thorough, evidence-based
- **Memory:** "Remembers attack patterns, bypass techniques, compliance gaps"
- **Experience:** "Has found 0-days, seen breaches, audited critical systems"
- **Success Metrics:** Zero critical vulns, compliance passed, MTTR < 1hr

### Design (10 agents) — Aesthetic Architect
- **Tone:** Empathetic, systematic, pixel-perfect
- **Memory:** "Remembers what delights, what converts, what scales"
- **Experience:** "Has built design systems, rebranded products, tested with users"
- **Success Metrics:** Design system adoption, accessibility score, brand consistency

---

## 4. Estrutura de Personalidade (Template Padrão)

Todos os 282 agentes seguem esta estrutura de seções no corpo:

### 4.1 Identity & Memory (`## 🧠 Your Identity & Memory`)
```
- Role: [Título funcional]
- Personality: [3-5 adjetivos]
- Memory: [O que lembra / expertise acumulada]
- Experience: [Contexto vivencial que fundamenta autoridade]
```

### 4.2 Core Mission (`## 🎯 Your Core Mission`)
- 3-5 áreas de responsabilidade com bullets acionáveis
- Cada área tem 3-6 sub-bullets específicos

### 4.3 Critical Rules (`## 🚨 Critical Rules You Must Follow`)
- Regras não-negociáveis (performance, segurança, qualidade)
- Geralmente 2-4 categorias de regras com 3-5 itens cada

### 4.4 Technical Deliverables (`## 📋 Your Technical Deliverables`)
- Exemplos de código, templates, padrões de implementação
- Muitas vezes inclui blocos de código completos (React, PHP, CSS, etc.)

### 4.5 Workflow Process (`## 🔄 Your Workflow Process`)
- 4-6 passos numerados do setup à delivery
- Passos acionáveis, não abstratos

### 4.5 Deliverable Template (`## 📋 Your Deliverable Template`)
- Template Markdown estruturado para output do agente
- Inclui seções: Implementation, Performance, Accessibility, etc.

### 4.6 Communication Style (`## 💭 Your Communication Style`)
- 4-5 diretrizes de tom: "Be precise", "Focus on UX", "Think performance"
- Exemplos de frases boas vs ruins

### 4.7 Learning & Memory (`## 🔄 Learning & Memory`)
- O que lembrar e construir expertise
- Pattern recognition específico do domínio
- Referência a arquivos externos (`ai/agents/dev.md`, etc.)

### 4.8 Success Metrics (`## 🎯 Your Success Metrics`)
- 5-7 métricas quantificáveis e observáveis
- Mix de técnico (Lighthouse, load time) e negócio (retention, conversion)

### 4.9 Advanced Capabilities (`## 🚀 Advanced Capabilities`)
- Capacidades de nível sênior/arquiteto
- Tecnologias de ponta (Three.js, WebAssembly, WebGL, etc.)

---

## 5. Variações Notáveis

### 5.1 Agents com Referência Externa
~20% dos agentes terminam com:
```markdown
**Instructions Reference**: Your detailed technical instructions are in `ai/agents/dev.md` - refer to this for complete implementation methodology...
```
**Arquivos `ai/agents/*.md` NÃO existem no baseline.** São esperados no workspace do usuário ou no repo upstream completo.

### 5.2 Agents Orchestrator (Meta-Agent)
`specialized/agents-orchestrator.md` é único:
- **Não** segue o template padrão de personalidade
- **É** um agente de orquestração que *spawna* outros agentes
- Define pipeline: PM → ArchitectUX → [Dev ↔ QA Loop] → Integration
- Inclui templates de status report e launch command
- Lista 60+ agentes disponíveis para orquestração por categoria

### 5.3 Senior Developer (Premium Tier)
`engineering/engineering-senior-developer.md`:
- Stack específico: Laravel/Livewire/FluxUI/Three.js
- Referencia `ai/system/premium-style-guide.md`, `ai/system/advanced-tech-patterns.md`
- "Premium craftsmanship" como filosofia central
- Métricas: <1.5s load, 60fps animations, WCAG 2.1 AA

---

## 6. Mapeamento de Identidade para OpenClaw

OpenClaw recebe 3 arquivos por agente (via `convert_openclaw()`):

| Arquivo OpenClaw | Conteúdo | Fonte no Agente |
|------------------|----------|-----------------|
| `SOUL.md` | Persona, identidade, learning & memory, communication, style, critical rules | Seções com headers contendo: identity, learning & memory, communication, style, critical rules, rules you must follow |
| `AGENTS.md` | Mission, deliverables, workflow, technical details | Todas as outras seções |
| `IDENTITY.md` | `# {emoji} {name}\n{vibe}` ou fallback `# {name}\n{description}` | Frontmatter `emoji`, `vibe`, `name`, `description` |

**Algoritmo de split (convert.sh:386-443):**
1. Lê corpo linha a linha
2. Detecta headers `## ` (ignora dentro de code fences)
3. Classifica header por keywords (case-insensitive):
   - **SOUL**: identity, learning & memory, communication, style, critical rules, rules you must follow
   - **AGENTS**: tudo o mais (mission, deliverables, workflow, etc.)
4. Escreve SOUL.md + AGENTS.md + IDENTITY.md

---

## 7. Consistência e Gaps

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| Frontmatter obrigatório (`name`, `description`) | ✅ 100% | Validado pelo indexing do corpus |
| `color` para OpenCode | ⚠️ ~95% | Ausentes caem para gray `#6B7280` |
| `emoji` + `vibe` para OpenClaw | ⚠️ ~90% | Fallback: name + description |
| `tools` para Qwen/ZCode | ⚠️ ~15% | Só agentes que precisam de tool mapping específico |
| Estrutura de seções padrão | ✅ ~95% | Variações menores em agentes antigos |
| Instructions Reference externo | ⚠️ ~20% | Arquivos `ai/` não existem no baseline |
| Duplicidade de slug | ✅ 0% | Verificado por `check_agent_slug_collisions()` |

---

## 8. Evidências

| Item | Localização |
|------|-------------|
| Frontmatter schema | `src-tauri/src/corpus/parse.rs` (função `parse_agent`) |
| Frontmatter extraction | `src-tauri/src/render/mod.rs:70-109` (`source_field`, `unquote_scalar`) |
| Body extraction | `src-tauri/src/render/mod.rs:126-148` (`source_body`) |
| OpenClaw split | `src-tauri/resources/corpus-baseline/scripts/convert.sh:386-471` |
| Color resolution | `src-tauri/src/render/mod.rs:399-433` (`resolve_opencode_color`) |
| Slugify | `src-tauri/src/render/mod.rs:192-208` |
| Output slug | `src-tauri/src/render/mod.rs:210-223` (`output_slug`) |
| Agent examples | `engineering/engineering-frontend-developer.md`, `engineering/engineering-senior-developer.md`, `specialized/agents-orchestrator.md` |

---

*Documento baseado em inspeção direta dos 282 agentes e código de parsing/rendering.*