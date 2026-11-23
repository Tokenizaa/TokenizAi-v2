# Agency Agents — Engenharia Reversa: Visão Geral (00-OVERVIEW)

> **Data:** 21 de novembro de 2026  
> **Versão analisada:** 0.3.2 (commit `da407fe`)  
> **Checkout local:** `/home/lg/workspace/NettosCorp/NettosCorp/enterprise/agency-agents`  
> **Remote:** `https://github.com/Tokenizaa/agency-agents-app.git` (fork de `msitarzewski/agency-agents`)  
> **Branch:** main (sincronizado com origin/main)  
> **Responsável:** Hermes (Chefe de Gabinete Executivo)

---

## 1. Resumo Executivo

O **Agency Agents** é um **ecossistema de catálogo e instalação de agentes de IA especializados** que consiste em:

1. **Catálogo upstream** (`msitarzewski/agency-agents`): 282 agentes Markdown em 21 divisões
2. **App nativo Tauri** (`Tokenizaa/agency-agents-app`): Interface desktop para browse, install, track e reconcile agentes across 18 ferramentas de IA
3. **Tooling de conversão**: Scripts bash/Rust que transformam agentes Markdown canônicos em formatos nativos de cada ferramenta (Claude Code, Codex, Cursor, Gemini, Copilot, etc.)
4. **Integração Hermes**: Plugin router que expõe o catálogo ao Hermes Agent via lazy-loading

**Este checkout local** é um **fork** (`Tokenizaa/agency-agents-app`) que evoluiu o app Tauri/Svelte, mas **perdeu** vários arquivos do repositório original:
- `scripts/lib.sh` (helpers compartilhados do convert.sh)
- `scripts/install.sh`, `scripts/lint-agents.sh`, `scripts/check-divisions.sh`, `scripts/check-tools.sh`
- `scripts/build-hermes-plugin.py` (referenciado no convert.sh mas ausente)
- Documentação NEXUS completa (`strategy/nexus-strategy.md`, `EXECUTIVE-BRIEF.md`, `QUICKSTART.md`, `coordination/`, `playbooks/`, `runbooks/`, `runbooks.json`)
- GitHub workflows CI/CD

---

## 2. Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AGENCY AGENTS ECOSYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │  UPSTREAM CATALOG │     │   TAURI APP      │     │  TARGET TOOLS   │       │
│  │  (msitarzewski/   │────►│  (Tokenizaa/     │────►│  (18 ferramentas)│       │
│  │   agency-agents)  │     │   agency-agents  │     │                 │       │
│  │                   │     │   -app)          │     │                 │       │
│  │  • 282 agents .md │     │                  │     │  • Claude Code  │       │
│  │  • 21 divisions   │     │  • Corpus sync   │     │  • Codex        │       │
│  │  • divisions.json │     │  • Registry      │     │  • Cursor       │       │
│  │  • tools.json     │     │  • Render (Rust) │     │  • Gemini CLI   │       │
│  │  • scripts/       │     │  • Install/      │     │  • Copilot      │       │
│  │  • strategy/NEXUS │     │    Reconcile     │     │  • Qwen         │       │
│  └─────────────────┘     │  • GitHub OAuth   │     │  • +12 mais     │       │
│                          └────────┬──────────┘     └─────────────────┘       │
│                                   │                                        │
│                                   ▼                                        │
│                          ┌─────────────────┐                              │
│                          │   HERMES AGENT   │                              │
│                          │   (via plugin)   │                              │
│                          │                  │                              │
│                          │  agency_agents_  │                              │
│                          │  _search         │                              │
│                          │  _inspect        │                              │
│                          │  _load           │                              │
│                          │  _delegate       │                              │
│                          └─────────────────┘                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Componentes Principais

| Componente | Localização | Descrição |
|------------|-------------|-----------|
| **Catálogo Canônico** | `src-tauri/resources/corpus-baseline/` | 282 agentes `.md` com frontmatter YAML |
| **Divisões** | `src-tauri/data/agency-categories.json` | 21 divisões com label, icon (Lucide), color |
| **Ferramentas** | `src-tauri/data/tools.json` | 18 ferramentas: installKind, format, dest, scope, detect |
| **Conversão (Shell)** | `src-tauri/resources/corpus-baseline/scripts/convert.sh` | 954 linhas, 15 formatos, paralelismo |
| **App Tauri (Rust)** | `src-tauri/src/` | corpus, registry, render, install, github, settings, updater |
| **UI Svelte** | `src/` | 4 pilares: Agents, Tools, Teams, Projects |
| **Hermes Plugin** | Referenciado em `tools.json` + `convert.sh` | `hermes-router-plugin` (ausente no checkout) |

---

## 4. Catálogo de Agentes — Inventário

| Divisão | Agentes | % do Total | Exemplos Notáveis |
|---------|---------|------------|-------------------|
| **engineering** | 65 | 23% | frontend-developer, backend-architect, senior-developer, ai-engineer, mobile-app-builder, devops-automator |
| **specialized** | 59 | 21% | agents-orchestrator, chief-financial-officer, business-strategist, automation-governance-architect |
| **marketing** | 37 | 13% | growth-hacker, content-creator, twitter-engager, tiktok-strategist, seo-specialist |
| **game-development** | 21 | 7% | unity-architect, unreal-systems-engineer, godot-multiplayer-engineer, narrative-designer |
| **gis** | 13 | 4.6% | gis-analyst, gis-cartography-designer, gis-geoai-ml-engineer |
| **security** | 12 | 4.2% | security-architect, penetration-tester, threat-intelligence-analyst, compliance-auditor |
| **design** | 10 | 3.5% | ux-architect, ui-designer, brand-guardian, visual-storyteller |
| **sales** | 9 | 3.2% | account-strategist, deal-strategist, sales-engineer, pipeline-analyst |
| **testing** | 9 | 3.2% | evidence-qa, reality-checker, api-tester, performance-benchmarker |
| **project-management** | 7 | 2.5% | project-manager-senior, experiment-tracker, project-shepherd |
| **paid-media** | 7 | 2.5% | ppc-strategist, paid-social-strategist, programmatic-buyer |
| **finance** | 5 | 1.8% | financial-analyst, fpa-analyst, investment-researcher, tax-strategist |
| **academic** | 6 | 2.1% | academic-psychologist, academic-statistician, academic-historian |
| **product** | 6 | 2.1% | product-manager, sprint-prioritizer, dx-engineer, feedback-synthesizer |
| **spatial-computing** | 6 | 2.1% | visionos-spatial-engineer, xr-interface-architect, macos-spatial-metal-engineer |
| **support** | 6 | 2.1% | support-responder, analytics-reporter, finance-tracker |
| **healthcare** | 3 | 1.1% | clinical-evidence-agent, innovation-strategist |
| **research** | 1 | 0.3% | research-synthesist |
| **scripts** | 0 | 0% | (pasta vazia, não é divisão real) |
| **TOTAL** | **282** | **100%** | |

---

## 5. Ferramentas Suportadas (tools.json)

| Ferramenta | installKind | format | scope | Status no App |
|------------|-------------|--------|-------|---------------|
| **claude-code** | per-agent | identity | user+project | ✅ Installable |
| **codex** | per-agent | codex-toml | user+project | ✅ Installable |
| **gemini-cli** | per-agent | gemini-md | user+project | ✅ Installable |
| **copilot** | per-agent | identity | user+project | ✅ Installable |
| **qwen** | per-agent | qwen-md | user+project | ✅ Installable |
| **cursor** | per-agent | cursor-mdc | project-only | ✅ Installable |
| **opencode** | per-agent | opencode-md | user+project | ✅ Installable |
| **osaurus** | per-agent | skill-md | user-only | ✅ Installable |
| **aider** | roster | aider-conventions | project-only | ⚠️ Recognized-only |
| **antigravity** | per-agent | skill-md | user+project | ⚠️ Recognized-only (date_added non-deterministic) |
| **kimi** | per-agent | kimi-agent | user-only | ⚠️ Recognized-only |
| **openclaw** | per-agent | openclaw-workspace | user-only | ⚠️ Recognized-only |
| **windsurf** | roster | windsurf-rules | project-only | ⚠️ Recognized-only |
| **vibe** | per-agent | vibe-toml | user+project | ⚠️ Recognized-only |
| **zcode** | per-agent | zcode-md | user+project | ⚠️ Recognized-only |
| **dsh** | per-agent | skill-md | user+project | ⚠️ Recognized-only |
| **hermes** | plugin | hermes-router-plugin | user-only | ⚠️ Plugin (build-hermes-plugin.py ausente) |
| **deepseekHarness** | per-agent | skill-md | user+project | ⚠️ Recognized-only |

**Installable (8)**: claude-code, codex, gemini-cli, copilot, qwen, cursor, opencode, osaurus  
**Recognized-only (10)**: aider, antigravity, kimi, openclaw, windsurf, vibe, zcode, dsh, hermes, deepseekHarness

---

## 6. Integração Hermes — Estado Atual

**No `tools.json`:**
```json
"hermes": {
  "installKind": "plugin",
  "format": "hermes-router-plugin",
  "scope": {"user": true, "project": false},
  "dest": {"user": [".hermes/plugins/agency-agents-router"]}
}
```

**No `convert.sh` (linha 791-794):**
```bash
if [[ "$tool" == "hermes" ]]; then
  python3 "$SCRIPT_DIR/build-hermes-plugin.py" --repo-root "$REPO_ROOT" --out "$OUT_DIR/hermes"
  return
fi
```

**Problema crítico:** `scripts/build-hermes-plugin.py` **não existe** no checkout local. O arquivo existia no repo upstream (`msitarzewski/agency-agents`) mas foi perdido no fork `Tokenizaa/agency-agents-app`.

**Ferramentas Hermes declaradas (4):**
1. `agency_agents_search` — busca agentes no catálogo
2. `agency_agents_inspect` — inspeciona agente específico
3. `agency_agents_load` — carrega agente no contexto
4. `agency_agents_delegate` — delega tarefa a subagente especializado

---

## 7. Diferenças: Checkout Local vs Upstream Público

| Aspecto | Checkout Local (`Tokenizaa/agency-agents-app`) | Upstream (`msitarzewski/agency-agents`) |
|---------|-----------------------------------------------|-----------------------------------------|
| **Tipo** | Fork do app Tauri | Repositório canônico do catálogo + scripts |
| **Catálogo** | 282 agentes (baseline bundlado) | Fonte viva, sync via GitHub tarball |
| **Scripts** | Apenas `convert.sh` (sem `lib.sh`) | `convert.sh`, `install.sh`, `lint-agents.sh`, `check-divisions.sh`, `check-tools.sh`, `lib.sh`, `build-hermes-plugin.py` |
| **NEXUS Strategy** | ❌ Ausente | ✅ `strategy/nexus-strategy.md`, `EXECUTIVE-BRIEF.md`, `QUICKSTART.md`, `coordination/`, `playbooks/`, `runbooks/`, `runbooks.json` |
| **Hermes Plugin** | Referenciado mas `build-hermes-plugin.py` ausente | ✅ Implementado |
| **CI/CD** | ❌ Sem `.github/workflows/` | ✅ Workflows de validação |
| **App Tauri** | ✅ Completo (v0.3.2) | ❌ Não existe (só catálogo + scripts) |
| **Sync Catalog** | Via `corpus_refresh` (GitHub tarball) | N/A (é a fonte) |

---

## 8. Evidências de Investigação

| Item | Fonte | Tipo |
|------|-------|------|
| Git remote/branch/status | `git remote -v`, `git status`, `git log` | Execução |
| Estrutura catálogo | `find src-tauri/resources/corpus-baseline -name "*.md" \| wc -l` | Execução |
| Divisões | `src-tauri/data/agency-categories.json` | Código |
| Ferramentas | `src-tauri/data/tools.json` | Código |
| Conversão | `src-tauri/resources/corpus-baseline/scripts/convert.sh` | Código |
| App Tauri | `src-tauri/src/lib.rs`, `corpus/mod.rs`, `install/mod.rs`, `render/mod.rs` | Código |
| Hermes reference | `tools.json:17`, `convert.sh:791-794` | Código |
| Agentes exemplo | `engineering/engineering-frontend-developer.md`, `engineering/engineering-senior-developer.md` | Código |
| Docs app | `docs/PHILOSOPHY.md`, `docs/PLAN.md`, `docs/USING-AGENTS.md` | Código |
| Ausências | Busca por arquivos NEXUS, lib.sh, build-hermes-plugin.py, install.sh | Execução (não encontrado) |

---

## 9. Conclusões Preliminares

1. **O checkout local é o APP TAURI**, não o catálogo canônico. O catálogo vive em `msitarzewski/agency-agents` e é sincronizado via tarball GitHub.

2. **A integração Hermes está quebrada no checkout local** — `build-hermes-plugin.py` ausente. Precisa ser recuperado do upstream ou reimplementado.

3. **NEXUS Strategy não está presente** — apenas o agente `agents-orchestrator.md` no corpus. A metodologia completa está no upstream.

4. **8 ferramentas são installable no app**, 10 são recognized-only (precisam renderers multi-file ou fixes upstream).

5. **Arquitetura de reconciliação (ledger + hash-match)** é o diferencial técnico — permite tracking preciso de estado instalado vs catálogo.

6. **O fork Tokenizaa adicionou o app Tauri completo** mas perdeu scripts auxiliares e documentação NEXUS do upstream.

---

*Documento gerado pela engenharia reversa do Agency Agents. Todas as conclusões baseiam-se em evidências de código e execução — não em suposições.*