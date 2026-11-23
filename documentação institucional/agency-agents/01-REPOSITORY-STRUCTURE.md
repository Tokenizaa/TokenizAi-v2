# Agency Agents — Engenharia Reversa: Estrutura do Repositório (01-REPOSITORY-STRUCTURE)

> **Data:** 21 de novembro de 2026  
> **Checkout:** `/home/lg/workspace/NettosCorp/NettosCorp/enterprise/agency-agents`  
> **Commit:** `da407fe` (v0.3.2)

---

## 1. Estrutura de Diretórios Completa

```
agency-agents/                                    ← Root do fork Tokenizaa/agency-agents-app
├── AGENTS.md                                     ← Instruções do agente (34KB, v2.2)
├── CLAUDE.md                                     ← Symlink → AGENTS.md
├── CONTRIBUTING.md                               ← Guia de contribuição
├── LICENSE                                       ← MIT
├── README.md                                     ← Visão geral do app
├── SECURITY.md                                   ← Política de segurança
├── package.json                                  ← Node/Svelte deps (v0.3.2)
├── package-lock.json
├── svelte.config.js                              ← SvelteKit config
├── vite.config.js                                ← Vite config (modificado localmente)
├── tsconfig.json                                 ← TypeScript config
├── .gitignore
├── .gitattributes
├── .git-blame-ignore-revs
├── .gitleaks.toml
├── .vscode/
│   ├── extensions.json
│   └── settings.json
├── .svelte-kit/                                  ← Build output SvelteKit (untracked)
├── node_modules/                                 ← Deps (untracked)
├── build/                                        ← Build artifacts
├── docs/
│   ├── BUILD.md                                  ← Build/release instructions
│   ├── PHILOSOPHY.md                             ← Princípios do projeto
│   ├── PLAN.md                                   ← Roadmap + arquitetura
│   ├── USING-AGENTS.md                           ← Guia de uso (playbook)
│   ├── release-notes/                            ← 0.1.0 a 0.3.2 + unreleased
│   ├── icon/                                     ← Assets de ícone
│   └── screenshots/                              ← Screenshots do app
├── landing/                                      ← Landing page static
│   ├── manifest.json
│   └── README.md
├── memory-bank/                                  ← Memory Bank do agente (AGENTS.md)
│   ├── activeContext.md
│   ├── agentLog.md
│   ├── contracts.md
│   ├── decisions.md
│   ├── NEXT-SESSION.md
│   ├── projectbrief.md
│   ├── systemPatterns.md
│   ├── toc.md
│   ├── phases/phase-roadmap.md
│   └── tasks/                                    ← Task docs por mês (2026-06 a 2026-10)
├── scripts/                                      ← Scripts de release (apenas)
│   ├── release.sh
│   ├── release-linux.sh
│   └── release-windows.ps1
├── tools/                                        ← Tooling interno
│   ├── phase-c/phase-c.sh                        ← Build cross-platform
│   └── release/publish-manifest.sh
├── src/                                          ← SvelteKit frontend
│   ├── app.css
│   ├── app.html
│   ├── lib/                                      ← Stores, components, utils
│   │   ├── data/playbook.ts
│   │   ├── stores/runbooks.svelte.ts
│   │   └── ...
│   └── routes/                                   ← Rotas SvelteKit
├── src-tauri/                                    ← Tauri 2 + Rust backend
│   ├── Cargo.toml / Cargo.lock
│   ├── tauri.conf.json / tauri.macos.conf.json
│   ├── build.rs
│   ├── deny.toml
│   ├── Info.plist
│   ├── Assets.car
│   ├── icons/
│   ├── capabilities/default.json
│   ├── gen/schemas/                              ← Generated schemas
│   ├── resources/
│   │   ├── corpus-baseline/                      ← CATÁLOGO BUNDLADO (282 agentes)
│   │   │   ├── academic/ (6)
│   │   │   ├── design/ (10)
│   │   │   ├── engineering/ (65)
│   │   │   ├── finance/ (5)
│   │   │   ├── game-development/ (21)
│   │   │   ├── gis/ (13)
│   │   │   ├── healthcare/ (3)
│   │   │   ├── marketing/ (37)
│   │   │   ├── paid-media/ (7)
│   │   │   ├── product/ (6)
│   │   │   ├── project-management/ (7)
│   │   │   ├── research/ (1)
│   │   │   ├── sales/ (9)
│   │   │   ├── scripts/ (0)
│   │   │   ├── security/ (12)
│   │   │   ├── spatial-computing/ (6)
│   │   │   ├── specialized/ (59)
│   │   │   ├── support/ (6)
│   │   │   ├── testing/ (9)
│   │   │   └── scripts/                          ← Scripts de conversão
│   │   │       └── convert.sh                    ← 954 linhas, 15 formatos
│   │   └── data/
│   │       ├── agency-categories.json            ← 21 divisões (label, icon, color)
│   │       └── tools.json                        ← 18 ferramentas (registry)
│   ├── src/
│   │   ├── lib.rs                                ← Entry point Tauri (286 linhas)
│   │   ├── main.rs
│   │   ├── commands/                             ← IPC commands
│   │   │   ├── mod.rs
│   │   │   ├── github.rs
│   │   │   ├── settings.rs
│   │   │   └── updater.rs
│   │   ├── corpus/                               ← Corpus subsystem
│   │   │   ├── mod.rs (92KB)
│   │   │   └── parse.rs (13KB)
│   │   ├── install/                              ← Install + reconcile
│   │   │   └── mod.rs (72KB)
│   │   ├── render/                               ← Deterministic renderers
│   │   │   └── mod.rs (36KB)                     ← Portado do convert.sh
│   │   ├── registry.rs                           ← Tools registry (from tools.json)
│   │   ├── state.rs                              ← AppState
│   │   ├── types.rs                              ← Tipos compartilhados
│   │   ├── error.rs
│   │   ├── github/                               ← GitHub OAuth + API
│   │   └── util/                                 ← FS, process helpers
│   ├── target/                                   ← Build artifacts (untracked)
│   └── tests/                                    ← Test fixtures
└── .github/                                      ← VAZIO (sem workflows no fork)
```

---

## 2. Arquivos-Chave por Responsabilidade

| Responsabilidade | Arquivo(s) | Linhas | Descrição |
|------------------|------------|--------|-----------|
| **Catálogo baseline** | `src-tauri/resources/corpus-baseline/` | 282 arquivos | Agentes `.md` com frontmatter |
| **Divisões metadata** | `src-tauri/data/agency-categories.json` | 23 | 21 divisões: label, icon (Lucide), color |
| **Ferramentas registry** | `src-tauri/data/tools.json` | 22 | 18 tools: id, kebab, format, installKind, dest, scope, detect |
| **Conversão shell** | `src-tauri/resources/corpus-baseline/scripts/convert.sh` | 954 | 15 formatos, paralelismo, slug collision check |
| **Corpus sync** | `src-tauri/src/corpus/mod.rs` | ~2376 | Refresh via GitHub tarball, indexing, memoization |
| **Install/Reconcile** | `src-tauri/src/install/mod.rs` | ~1958 | Ledger, backup, 5-state reconcile |
| **Renderers Rust** | `src-tauri/src/render/mod.rs` | ~949 | 12 formatos implementados, byte-parity com convert.sh |
| **Registry Rust** | `src-tauri/src/registry.rs` | — | Carrega `tools.json` em tempo de compilação |
| **App entry** | `src-tauri/src/lib.rs` | 286 | Tauri builder, invoke_handler, plugins |
| **Hermes ref** | `tools.json:17`, `convert.sh:791-794` | — | Plugin router (build-hermes-plugin.py ausente) |

---

## 3. Fluxo de Dados Principal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW: CATALOG → APP → TOOLS                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. BUNDLE TIME                                                             │
│     src-tauri/resources/corpus-baseline/  ──►  App bundle                   │
│     src-tauri/data/tools.json           ──►  Registry (compile-time)        │
│     src-tauri/data/agency-categories.json ──►  Division meta               │
│                                                                              │
│  2. FIRST RUN                                                               │
│     App data dir/corpus/  ◄── copy baseline                                 │
│     App data dir/state/corpus-index.json  ◄── build index                  │
│                                                                              │
│  3. REFRESH (user-initiated)                                                │
│     GET https://codeload.github.com/msitarzewski/agency-agents/            │
│         tar.gz/refs/heads/main                                              │
│     │                                                                       │
│     ▼                                                                       │
│     Extract tarball  ──► Overwrite corpus/  ──► Rebuild index              │
│                                                                              │
│  4. INSTALL (per agent + tool)                                              │
│     Agent (from corpus)  ──► render.format(tool)  ──► bytes + hash         │
│     │                                                                       │
│     ├── Write to dest (tool-specific path)                                 │
│     ├── Backup existing if different                                       │
│     └── Record in ledger (installs.json): slug, tool, scope, dest,         │
│         source_hash, body_hash, rendered_hash, corpus_version              │
│                                                                              │
│  5. RECONCILE (on demand)                                                   │
│     For each ledger entry:                                                  │
│       Re-render agent for tool  ──► Compare rendered_hash                  │
│       │                                                                    │
│       ├── MATCH      ──► CURRENT                                           │
│       ├── DIFF       ──► OUTDATED (corpus moved on)                        │
│       ├── FILE CHANGED ──► MODIFIED (user edited)                          │
│       ├── FILE MISSING ──► REMOVED                                          │
│       └── FILE EXTRA   ──► FOREIGN (not in ledger)                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Convenções de Naming

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| **Agent file** | `<slug>.md` em `division/` | `engineering/frontend-developer.md` |
| **Slug** | kebab-case do `name` frontmatter | `frontend-developer` |
| **Frontmatter fields** | `name`, `description`, `color`, `emoji`, `vibe`, `tools` | — |
| **Tool id (registry)** | camelCase | `claudeCode`, `geminiCli`, `deepseekHarness` |
| **Tool kebab** | kebab-case | `claude-code`, `gemini-cli`, `dsh` |
| **Format key** | kebab-case | `identity`, `codex-toml`, `cursor-mdc`, `skill-md` |
| **InstallKind** | `per-agent` \| `roster` \| `plugin` | — |
| **Scope** | `user` \| `project` | — |

---

## 5. Ausências Notáveis (vs Upstream msitarzewski/agency-agents)

| Arquivo/Diretório | Status no Local | Status no Upstream | Impacto |
|-------------------|-----------------|-------------------|---------|
| `scripts/lib.sh` | ❌ Ausente | ✅ Existe | Helpers compartilhados (get_field, get_body, slugify, yaml_quote, toml_escape, fence_open_p, fence_closes_p) |
| `scripts/install.sh` | ❌ Ausente | ✅ Existe | Instalação real nos dirs do usuário (convert.sh só gera em `integrations/`) |
| `scripts/lint-agents.sh` | ❌ Ausente | ✅ Existe | Valida frontmatter, cores, ferramentas, slugs únicos |
| `scripts/check-divisions.sh` | ❌ Ausente | ✅ Existe | Verifica divisões declaradas vs dirs reais |
| `scripts/check-tools.sh` | ❌ Ausente | ✅ Existe | Valida `tools.json` vs `ALL_TOOLS` no install.sh + converters |
| `scripts/build-hermes-plugin.py` | ❌ Ausente | ✅ Existe | **Crítico**: Gera plugin Hermes router |
| `strategy/` (NEXUS) | ❌ Ausente | ✅ Existe | Metodologia completa de orquestração |
| `.github/workflows/` | ❌ Ausente | ✅ Existe | CI/CD: lint, check-tools, check-divisions, parity tests |

---

## 6. Evidências

| Item | Comando/Evidência |
|------|-------------------|
| Estrutura completa | `find . -type f \| grep -v node_modules \| grep -v target \| grep -v .git \| sort` |
| Contagem agentes | `find src-tauri/resources/corpus-baseline -name "*.md" \| wc -l` → 282 |
| Divisões | `cat src-tauri/data/agency-categories.json` |
| Tools registry | `cat src-tauri/data/tools.json` |
| Convert.sh | `cat src-tauri/resources/corpus-baseline/scripts/convert.sh` |
| Corpus sync | `src-tauri/src/corpus/mod.rs:107-114` (CORPUS_TARBALL_URL) |
| Render parity | `src-tauri/src/render/mod.rs:757-871` (test upstream_convert_sh_is_byte_identical) |
| Ausências | `find . -name "lib.sh" -o -name "install.sh" -o -name "build-hermes-plugin.py" -o -name "nexus*"` → vazios |

---

*Documento baseado em inspeção direta de arquivos e execução de comandos no checkout local.*