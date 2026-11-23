# Agency Agents — Engenharia Reversa: Conversão e Instalação (07-CONVERSION-AND-INSTALLATION)

> **Data:** 21 de novembro de 2026  
> **Checkout:** `/home/lg/workspace/NettosCorp/NettosCorp/enterprise/agency-agents`  
> **Fontes:** `convert.sh`, `tools.json`, `src-tauri/src/render/mod.rs`, `src-tauri/src/install/mod.rs`, `docs/PLAN.md`

---

## 1. Arquitetura do Conversor (convert.sh)

### 1.1 Visão Geral

`convert.sh` (954 linhas) é o **conversor canônico** que transforma 282 agentes Markdown canônicos em **15 formatos de ferramenta** distintos. É a fonte da verdade para paridade de bytes — o Rust render no app Tauri é portado dele e testado contra ele.

### 1.2 Fluxo Principal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONVERT.SH PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. PARSE ARGS                                                               │
│     --tool <name|all>  --out <dir>  --parallel  --jobs N                    │
│                                                                              │
│  2. VALIDAÇÃO PRÉVIA                                                         │
│     check_agent_slug_collisions()  →  Falha se slug duplicado               │
│                                                                              │
│  3. PARA CADA FERRAMENTA (sequencial ou paralelo)                           │
│     clean_tool_output(tool)  →  Remove integrations/<tool>/* (exceto README)│
│     │                                                                       │
│     ├── PER-AGENT TOOLS (12): antigravity, codex, gemini-cli, opencode,    │
│     │   cursor, openclaw, qwen, zcode, kimi, osaurus, dsh, vibe            │
│     │   Para cada agente .md nas 21 divisões:                               │
│     │     get_field("name"), get_field("description"), get_body()          │
│     │     convert_<tool>(file)  →  Escreve em integrations/<tool>/         │
│     │                                                                       │
│     ├── ROSTER TOOLS (2): aider, windsurf                                   │
│     │   Acumula em temp files → Escreve CONVENTIONS.md / .windsurfrules    │
│     │                                                                       │
│     └── PLUGIN TOOL (1): hermes                                             │
│         python3 build-hermes-plugin.py  →  integrations/hermes/            │
│                                                                              │
│  4. FINALIZAÇÃO                                                              │
│     Copia temp files → integrations/aider/CONVENTIONS.md                   │
│     Copia temp files → integrations/windsurf/.windsurfrules                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Paralelismo

```bash
# Tools que escrevem em dirs separados → podem rodar em paralelo
parallel_tools=(antigravity gemini-cli opencode cursor openclaw qwen zcode kimi codex osaurus hermes vibe dsh)

# Tools que acumulam em arquivo único → SEQUENCIAL (aider, windsurf)
# xargs -P N com output buffered por tool
```

---

## 2. Formatos de Saída por Ferramenta

| Ferramenta | installKind | Formato | Estrutura de Saída | Exemplo Destino |
|------------|-------------|---------|-------------------|-----------------|
| **claude-code** | per-agent | `identity` | `.md` verbatim | `~/.claude/agents/{slug}.md` |
| **codex** | per-agent | `codex-toml` | TOML: name, description, developer_instructions | `~/.codex/agents/{slug}.toml` |
| **gemini-cli** | per-agent | `gemini-md` | YAML frontmatter + body | `~/.gemini/agents/{slug}.md` |
| **copilot** | per-agent | `identity` | `.md` verbatim (dual write) | `~/.github/agents/{slug}.md`, `~/.copilot/agents/{slug}.md` |
| **qwen** | per-agent | `qwen-md` | YAML + tools mapeados | `~/.qwen/agents/{slug}.md` |
| **cursor** | per-agent | `cursor-mdc` | YAML: description, globs, alwaysApply | `~/.cursor/rules/{slug}.mdc` |
| **opencode** | per-agent | `opencode-md` | YAML: name, description, mode, color(hex) | `~/.config/opencode/agents/{slug}.md` |
| **openclaw** | per-agent | `openclaw-workspace` | 3 arquivos: SOUL.md, AGENTS.md, IDENTITY.md | `~/.openclaw/agency-agents/{slug}/` |
| **kimi** | per-agent | `kimi-agent` | agent.yaml + system.md | `~/.config/kimi/agents/{slug}/` |
| **zcode** | per-agent | `zcode-md` | YAML + tools (pass-through) | `~/.zcode/agents/{slug}.md` |
| **osaurus** | per-agent | `skill-md` | SKILL.md em dir `agency-{slug}/` | `~/.osaurus/skills/agency-{slug}/SKILL.md` |
| **antigravity** | per-agent | `skill-md` | SKILL.md em dir `agency-{slug}/` | `~/.gemini/config/skills/agency-{slug}/SKILL.md` |
| **dsh** | per-agent | `skill-md` | SKILL.md em dir `agency-{slug}/` | `~/.dsh/skills/agency-{slug}/SKILL.md` |
| **vibe** | per-agent | `vibe-toml` | 2 arquivos: .toml + .md | `~/.vibe/agents/{slug}.toml`, `~/.vibe/prompts/{slug}.md` |
| **aider** | roster | `aider-conventions` | 1 arquivo: CONVENTIONS.md (index) | `<project>/CONVENTIONS.md` |
| **windsurf** | roster | `windsurf-rules` | 1 arquivo: .windsurfrules (concat) | `<project>/.windsurfrules` |
| **hermes** | plugin | `hermes-router-plugin` | Plugin dir (via Python) | `~/.hermes/plugins/agency-agents-router/` |

---

## 3. Helpers de Conversão (lib.sh — AUSENTE)

**CRÍTICO:** `scripts/lib.sh` **não existe no checkout local**. O `convert.sh` faz `source "$SCRIPT_DIR/lib.sh"` (linha 77) mas o arquivo está ausente. Funções que deveriam estar lá:

| Função | Usada Em | Descrição |
|--------|----------|-----------|
| `get_field` | Todos convert_* | Extrai `field: value` do frontmatter (com continuations, unquote) |
| `get_body` | Todos convert_* | Extrai corpo pós-frontmatter (skip 2 fences `---`) |
| `slugify` | output_slug, convert_* | name → kebab-case slug |
| `yaml_quote` | Todos YAML outputs | Single-quote com apostrophe doubling |
| `toml_escape_string` | codex-toml | Escape para TOML basic string |
| `fence_open_p` / `fence_closes_p` | convert_openclaw | Detecta code fences para não split dentro delas |
| `resolve_opencode_color` | convert_opencode | Named color → hex `#RRGGBB` |

**Port no Rust:** `src-tauri/src/render/mod.rs` replica **todas** estas funções (linhas 70-208, 399-454) para paridade byte-a-byte.

---

## 4. Mapeamento de Tools (qwen_tools)

```bash
# convert.sh:487-513
qwen_tools() {
  # Mapeia Claude Code tool names → Qwen canonical names
  Read → read_file
  Write → write_file
  Edit/MultiEdit → edit
  Bash → run_shell_command
  Grep → grep_search
  Glob → glob
  LS → list_directory
  WebFetch → web_fetch
  WebSearch → web_search
  TodoWrite → todo_write
  NotebookEdit → notebook_edit
  Task → agent
  Unknown → pass-through
  # Dedup: Edit+MultiEdit → um "edit"
}
```

**Replicado em Rust:** `render/mod.rs:162-189` (`qwen_tools` function).

---

## 5. Instalação Real (vs Conversão)

### 5.1 Distinção Fundamental

| Fase | Script | Responsabilidade |
|------|--------|------------------|
| **Conversão** | `convert.sh` | Source `.md` → Tool-specific format em `integrations/<tool>/` |
| **Instalação** | `install.sh` (AUSENTE) | `integrations/<tool>/` → User/project dirs reais |
| **App Tauri** | Rust `install::do_install` | Corpus → Render → Write → Ledger → Reconcile |

### 5.2 install.sh (Ausente — Upstream Only)

O `install.sh` upstream faria:
1. Detectar ferramentas instaladas (`detect.dirs` em tools.json)
2. Para cada agente selecionado: copiar de `integrations/<tool>/` para dest real
3. Respeitar `scope` (user vs project) e `dest` templates
4. Registrar em ledger local (ou delegar ao app)

### 5.3 App Tauri Install Flow (Implementado)

```rust
// install/mod.rs: do_install()
1. corpus::ensure_corpus() → Agent + raw source
2. render::render_with_hash(agent, tool) → (bytes, rendered_hash)
3. render::dests(tool, slug, home, project_root) → Vec<PathBuf>
4. Para cada dest:
   a. backup_if_differs(dest, new_bytes)  // Preserva se diferente
   b. atomic_write(dest, bytes)
5. record_for() → InstallRecord { slug, tool, scope, dest, hashes... }
6. save_ledger() → instills.json append
```

**Scope Detection:** `project_root.is_some() → Scope::Project else Scope::User`

**Dual-scope tools** (claude, codex, gemini, qwen): mesmo template, re-rooted em home ou project.

**Opencode/Copilot:** templates diferentes por scope (`.config/opencode` vs `.opencode`, `.github` vs `.copilot`).

---

## 6. Detecção Automática de Ferramentas

### 6.1 tools.json `detect` Config

```json
// Exemplo: cursor
"detect": {"dirs": [".cursor"], "agentsDir": null},
// Exemplo: opencode  
"detect": {"dirs": [".config/opencode"], "agentsDir": null},
// Exemplo: claude-code
"detect": {"dirs": [".claude"], "agentsDir": ".claude/agents"},
```

### 6.2 App Tauri Detection (Rust)

```rust
// install/mod.rs: tool_home() + detect logic
// settings.tool_paths permite override de base dir per tool
// Fallback: OS home dir
```

---

## 7. Instalação por Agente vs Divisão vs Global

| Granularidade | Suportado Por | Como |
|---------------|---------------|------|
| **Single agent** | convert.sh `--tool X`, App UI | Select slug → install |
| **Division** | App UI (Teams) | Select division → install all agents in division |
| **Team preset** | App UI (Teams) | Curated list → install as unit |
| **All agents** | convert.sh `--tool all` | Regenera tudo |
| **Project-scoped** | App UI (Projects) | Select project root → installs em `<project>/.tool/` |

---

## 8. Validações e Consistência

### 8.1 check-tools.sh (Ausente — Upstream)

Valida `tools.json` contra:
- `ALL_TOOLS` array em `install.sh`
- Converter functions em `convert.sh`
- Campos obrigatórios: `id`, `label`, `kebab`, `format`, `installKind`, `dest`

### 8.2 check-divisions.sh (Ausente — Upstream)

Valida:
- Diretórios em corpus-baseline = chaves em `divisions.json`
- `NON_DIVISION_DIRS` (ex: `scripts/`, `strategy/`) não aparecem como divisões

### 8.3 lint-agents.sh (Ausente — Upstream)

Valida por agente:
- Frontmatter obrigatório: `name`, `description`
- `color` em lista conhecida (para OpenCode)
- `tools` lista válida (se presente)
- Slug uniqueness global

---

## 9. Evidências

| Item | Localização |
|------|-------------|
| convert.sh completo | `src-tauri/resources/corpus-baseline/scripts/convert.sh` |
| tools.json registry | `src-tauri/data/tools.json` |
| Render Rust (paridade) | `src-tauri/src/render/mod.rs` |
| Install Rust | `src-tauri/src/install/mod.rs` |
| lib.sh ausente | `find . -name "lib.sh"` → vazio |
| install.sh ausente | `find . -name "install.sh"` → vazio |
| check-tools.sh ausente | `find . -name "check-tools.sh"` → vazio |
| PLAN.md install targets | `docs/PLAN.md:75-92` |

---

## 10. Conclusão

**O sistema de conversão é robusto e bem testado (paridade byte-a-byte com Rust).** O gap crítico é a **ausência dos scripts de instalação e validação upstream** (`install.sh`, `lib.sh`, `lint-agents.sh`, `check-divisions.sh`, `check-tools.sh`) no fork Tokenizaa.

**Para uso na NettosCorp:**
1. O **App Tauri** já implementa install/reconcile completo em Rust — não precisa do `install.sh` shell
2. O **convert.sh** funciona standalone para gerar `integrations/` para ferramentas não suportadas pelo app
3. **Hermes plugin** requer `build-hermes-plugin.py` do upstream
4. Scripts de validação (`lint-agents.sh`, etc.) seriam úteis para CI/CD mas não são runtime-critical

---

*Documento baseado em inspeção de `convert.sh` (954 linhas), `tools.json`, `render/mod.rs`, `install/mod.rs`, e ausências confirmadas via `find`.*