# Agency Agents — Engenharia Reversa: Handoffs e Quality Gates (05-HANDOFF-AND-QUALITY-GATES)

> **Data:** 21 de novembro de 2026  
> **Checkout:** `/home/lg/workspace/NettosCorp/NettosCorp/enterprise/agency-agents`  
> **Fontes:** `agents-orchestrator.md`, `convert.sh`, `src-tauri/src/install/mod.rs`, `src-tauri/src/render/mod.rs`, `docs/PLAN.md`

---

## 1. Handoffs no Pipeline do Agents Orchestrator

### 1.1 Matriz de Handoffs Explícita

| # | De | Para | Trigger | Artefato Trocado | Validação |
|---|-----|------|---------|------------------|-----------|
| 1 | **Orchestrator** | **PM** | Pipeline start | Spec file path (`project-specs/[project]-setup.md`) | PM cria task list |
| 2 | **PM** | **Orchestrator** | Task list done | `project-tasks/[project]-tasklist.md` | `ls -la` verifica arquivo |
| 3 | **Orchestrator** | **ArchitectUX** | PM done | Task list + spec | ArchitectUX cria architecture docs |
| 4 | **ArchitectUX** | **Orchestrator** | Arch done | `css/`, `project-docs/*-architecture.md` | `ls -la` verifica |
| 5 | **Orchestrator** | **Dev (específico)** | Por task | Task N description + architecture | Dev implementa |
| 6 | **Dev** | **Orchestrator** | Dev done | Implementation files | Orchestrator dispara QA |
| 7 | **Orchestrator** | **EvidenceQA** | Dev done | Task N + implementation | QA testa com screenshots |
| 8 | **EvidenceQA** | **Orchestrator** | QA done | PASS/FAIL + feedback específico | Orchestrator decide |
| 9 | **Orchestrator** | **Dev** (retry) | QA = FAIL | QA feedback | Dev corrige |
| 10 | **Orchestrator** | **Reality Checker** | All tasks PASS | All implementations | Final certification |

### 1.2 Padrão de Contexto Compartilhado

**Mecanismo único:** **Filesystem como message bus**
- Spec: `project-specs/[project]-setup.md`
- Tasks: `project-tasks/[project]-tasklist.md`
- Architecture: `project-docs/[project]-architecture.md`, `css/`
- Implementation: arquivos do projeto alvo
- QA Evidence: screenshots (não persistidos no repo)

**Não há:** Shared memory, context passing via API, structured handoff objects.

### 1.3 Handoff para OpenClaw (Formato Específico)

`convert_openclaw()` divide o agente em 3 arquivos:
- `SOUL.md` — Persona, identity, memory, communication, style, critical rules
- `AGENTS.md` — Mission, deliverables, workflow, technical details
- `IDENTITY.md` — `# {emoji} {name}\n{vibe}`

**Handoff semântico:** Separação "quem sou" (SOUL) vs "o que faço" (AGENTS) vs "identidade visual" (IDENTITY).

---

## 2. Handoffs no Sistema de Instalação (App Tauri)

### 2.1 Install Flow (Rust)

```
corpus::corpus_get(slug) 
    → render::render_with_hash(agent, tool)  // bytes + hash
    → install::dests(tool, slug, home, project_root)  // paths
    → backup_if_differs(dest, new_bytes)  // preserve existing
    → write_agent_files()  // atomic write
    → record_for() → save_ledger()  // installs.json
```

### 2.2 Reconcile Flow (5-State Machine)

| Estado | Definição | Detecção |
|--------|-----------|----------|
| **CURRENT** | Installed bytes == re-rendered bytes | `rendered_hash == ledger.rendered_hash` |
| **OUTDATED** | Corpus moved on (source hash changed) | `source_hash != ledger.source_hash` && `rendered_hash == ledger.rendered_hash` |
| **MODIFIED** | User edited installed file | `rendered_hash != ledger.rendered_hash` && file exists |
| **REMOVED** | Installed file missing | `!file_exists(dest)` && in ledger |
| **FOREIGN** | File exists but not in ledger | `file_exists(dest)` && `!in_ledger(dest)` |

**Reconcile é o quality gate contínuo** — roda sob demanda via `installs_reconcile` command.

### 2.3 Backup/Rollback Gate

```rust
// Antes de qualquer write destrutivo:
backup_if_differs(dest, new_bytes, backup_dir, stamp)
// Se backup falha → write aborta
// Se bytes idênticos → no-op (sem backup lixo)
```

**Gate:** Nunca sobrescreve sem preservar estado anterior.

---

## 3. Quality Gates no Convert.sh

### 3.1 Pre-Conversion Gates

```bash
# 1. Slug collision check (linha 761-785)
check_agent_slug_collisions() {
  # Varre todos os 282 agentes
  # Gera slug via agent_slug() (name → slugify)
  # Falha se duplicidade: "duplicate agent slug 'X': file1 and file2"
}

# 2. Frontmatter validation (implícito)
# get_field() retorna vazio se campo ausente
# name vazio → agente skipado (linha 807-811)
```

### 3.2 Per-Tool Render Gates

| Ferramenta | Gate de Validação |
|------------|-------------------|
| **OpenCode** | `resolve_opencode_color()` → hex válido `#RRGGBB` ou fallback gray |
| **Cursor** | `alwaysApply: false`, `globs: ""` hardcoded |
| **Codex** | `toml_escape_string()` — control chars escaped para TOML válido |
| **Qwen** | `qwen_tools()` — mapeia Claude tools → Qwen tools; desconhecidos passam |
| **Kimi** | `extend: default` + system.md separado |
| **Osaurus/Antigravity/DSH** | `skill-md` format: `name: agency-{slug}`, `description`, body |

### 3.3 Post-Conversion Gates

```bash
# 1. Clean tool output antes de regenerar (linha 746-756)
clean_tool_output() {
  # Remove tudo exceto README.md em integrations/<tool>/
  # Recusa symlinks, nomes não-slug
}

# 2. Parity test (test ignored, requer AGENCY_AGENTS_PARITY_ROOT)
# upstream_convert_sh_is_byte_identical_for_transform_tools
# Compara byte-a-byte: Rust render vs bash convert.sh
```

---

## 4. Quality Gates no App Tauri (Runtime)

### 4.1 Corpus Integrity

```rust
// corpus/mod.rs: build_from_dir()
- Max agent file: 1 MiB (MAX_AGENT_BYTES)
- Max tarball: 32 MiB (MAX_TARBALL_BYTES)
- Timeout fetch: 60s (REFRESH_TIMEOUT)
- SHA-256 de 3 regiões: source, body, rendered
- BTreeMap para index ordenação determinística
```

### 4.2 Install Safety

```rust
// install/mod.rs
- atomic_write para todos os writes
- backup_if_differs antes de overwrite
- MAX_INSTALLED_BYTES: 4 MiB ao ler de volta
- ledger persistido em installs.json (pretty JSON)
- scope derivado de project_root (não config fixa)
```

### 4.3 Render Determinism (Test Gates)

```rust
// render/mod.rs tests
#[test] fn render_is_deterministic() {
  for tool in [cursor, codex, opencode, geminiCli, qwen, zcode] {
    assert_eq!(render(a, raw, tool), render(a, raw, tool));
  }
}

#[test] fn upstream_convert_sh_is_byte_identical_for_transform_tools() {
  // Requer AGENCY_AGENTS_PARITY_ROOT
  // Compara Rust render vs bash convert.sh byte-a-byte
  // 282 agentes × 8 tools = 2256 comparações
}
```

### 4.4 CI Quality Gates (Ausentes no Fork)

| Gate | Status | Localização Esperada |
|------|--------|---------------------|
| `cargo fmt --check` | ❌ Sem CI | `PLAN.md:178` |
| `cargo test --lib` | ❌ Sem CI | `PLAN.md:179` |
| `npm run check` (svelte-check) | ❌ Sem CI | `PLAN.md:180` |
| `npm run build` | ❌ Sem CI | `PLAN.md:181` |
| `npm run build:phase-c` | ❌ Sem CI | `PLAN.md:182` |
| `scripts/check-tools.sh` | ❌ Ausente | Upstream only |
| `scripts/check-divisions.sh` | ❌ Ausente | Upstream only |
| `scripts/lint-agents.sh` | ❌ Ausente | Upstream only |

---

## 5. Métricas de Qualidade (Evidenciadas vs Declaradas)

| Métrica | Onde Medida | Evidência |
|---------|-------------|-----------|
| **Render parity** | `render/mod.rs:757-871` | Test ignored, byte-identical vs convert.sh |
| **Slug uniqueness** | `convert.sh:761-785` | Falha build se duplicado |
| **Deterministic render** | `render/mod.rs:606-613` | Unit test passa |
| **Frontmatter parsing parity** | `render/mod.rs:615-637` | Unit test vs shell semantics |
| **Color mapping** | `render/mod.rs:700-704` | Unit test slate/navy |
| **Tool dest resolution** | `render/mod.rs:887-948` | Unit test per tool |
| **Reconcile accuracy** | `install/mod.rs` | Integration via ledger hash-match |

**Não medido/evidenciado:**
- Tempo de install/reconcile
- Taxa de sucesso de install em ferramentas reais
- Cobertura de agentes instaláveis vs catálogo (8/18 tools)
- User-facing error rates

---

## 6. Controle de Tentativas (Retry Logic)

### 6.1 No Agents Orchestrator

```markdown
# Task-by-Task Quality Loop
Máximo 3 tentativas por task:
- Tentativa 1: Dev → QA → PASS/FAIL
- Tentativa 2: Dev (com feedback QA) → QA → PASS/FAIL  
- Tentativa 3: Dev (com feedback QA) → QA → PASS/FAIL
- Tentativa 4+: ESCALATE com relatório detalhado
```

### 6.2 No App Tauri (Install/Update)

```rust
// install/mod.rs: do_install / do_update
// Sem retry automático — falha retorna AppError para UI
// UI decide: retry, skip, ou report
```

### 6.3 No Corpus Refresh

```rust
// corpus/mod.rs: corpus_refresh
// Backoff em falha: 1h → 6h → 24h (updater auto-check)
// corpus_refresh manual: falha imediata com erro
```

---

## 7. Falhas Conhecidas e Gaps

| Área | Gap | Impacto |
|------|-----|---------|
| **CI/CD** | Zero workflows no fork | Nenhum gate automático em PR/merge |
| **Antigravity** | `date_added: '${TODAY}'` non-deterministic | `PLAN.md:88` — bloqueia installability |
| **Aider/Windsurf/OpenClaw/Kimi** | Multi-file renderers não implementados | `PLAN.md:89-92` — recognized-only |
| **Parity test** | Ignored, requer env var manual | Não roda em CI |
| **Hermes plugin** | `build-hermes-plugin.py` ausente | Integração quebrada |
| **EvidenceQA name mismatch** | Agente chama `EvidenceQA`, corpus tem `testing-evidence-collector` | Handoff frágil |
| **No integration tests** | Apenas unit tests | Falhas de integração não pegas |

---

## 8. Evidências

| Item | Localização |
|------|-------------|
| Orchestrator handoffs | `agents-orchestrator.md:55-168` |
| Orchestrator retry logic | `agents-orchestrator.md:112-168` |
| Orchestrator quality gates | `agents-orchestrator.md:40-46` |
| Convert.sh slug check | `convert.sh:761-785` |
| Convert.sh clean output | `convert.sh:746-756` |
| Convert.sh parity test | `convert.sh:757-871` (em Rust) |
| Install backup gate | `install/mod.rs:156-185` |
| Reconcile 5 states | `install/mod.rs` (reconcile logic) |
| Render determinism tests | `render/mod.rs:606-613` |
| Render parity test | `render/mod.rs:757-871` |
| PLAN.md quality gates | `docs/PLAN.md:174-183` |
| Antigravity blocker | `docs/PLAN.md:88` |

---

*Documento baseado em inspeção de código Rust, scripts bash, e agente orchestrator. Quality gates do CI/CD são declarados no PLAN.md mas **não implementados** no fork (sem `.github/workflows/`).*