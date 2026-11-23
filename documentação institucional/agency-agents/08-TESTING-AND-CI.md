# Agency Agents — Engenharia Reversa: Testes e CI/CD (08-TESTING-AND-CI)

> **Data:** 21 de novembro de 2026  
> **Checkout:** `/home/lg/workspace/NettosCorp/NettosCorp/enterprise/agency-agents`  
> **Status CI/CD:** **ZERO WORKFLOWS** no fork (`.github/workflows/` vazio)

---

## 1. Testes Unitários (Rust — `cargo test`)

### 1.1 Render Module (`src-tauri/src/render/mod.rs`)

**23 testes unitários** cobrindo paridade, determinismo, edge cases:

| Teste | Cobertura |
|-------|-----------|
| `claude_code_is_identity` | Identity tools passam source verbatim |
| `cursor_mdc_shape` | Frontmatter YAML correto |
| `codex_toml_escapes` | Control chars escaped em TOML |
| `opencode_color_maps_to_hex` | Named colors → hex; unknown → gray |
| `osaurus_skill_md_shape_and_dest` | skill-md format + dest path |
| `antigravity_skill_md_shape_and_dests` | skill-md + user/project dests |
| `opencode_unknown_color_falls_back` | Missing color → gray |
| `gemini_uses_slug_as_name` | name field = slug |
| `render_is_deterministic` | 6 tools: cursor, codex, opencode, geminiCli, qwen, zcode |
| `source_helpers_match_shell_semantics` | source_field, source_body, slugify vs shell |
| `source_field_unquotes_and_folds_like_get_field` | Quote handling, vibe folding, color resolve |
| `yaml_quote_keeps_colon_descriptions_valid` | Colon em description não quebra YAML |
| `qwen_tools_maps_claude_names_and_dedupes` | Mapping + dedup Edit+MultiEdit |
| `zcode_user_dest_is_where_zcode_reads_subagents` | Dest path correto |
| `dsh_renders_agency_skill_and_vibe_is_not_installable` | DSH skill-md OK; Vibe erro |
| `opencode_knows_slate_and_navy` | Novas cores adicionadas |
| `qwen_preserves_optional_tools` | Tools field opcional |
| `zcode_uses_slug_name_and_optional_tools` | ZCode name=slug, tools opcional |
| `output_slug_matches_converter_identity_rules` | Identity vs transform slug rules |
| `unsupported_tools_error` | windsurf, aider, openclaw, kimi → Err |
| `dests_per_tool` | 8 tools: paths corretos por scope |
| `scope_capabilities` | user/project caps per tool |
| `dests_are_scope_aware` | Root-swap vs different-dirs per scope |

### 1.2 Corpus Module (`src-tauri/src/corpus/mod.rs`)

Testes inline (não listados exaustivamente — módulo tem 2376 linhas):
- Parsing frontmatter/body parity com shell
- Index building determinístico (BTreeMap)
- Category discovery via `divisions.json`
- Skip logic para non-agent files
- Refresh tarball handling

### 1.3 Install Module (`src-tauri/src/install/mod.rs`)

Testes de integração (requerem setup):
- Install → reconcile CURRENT
- Modify file → reconcile MODIFIED
- Delete file → reconcile REMOVED
- Foreign file detection
- Backup/restore flow
- Ledger persistence

### 1.4 Parity Test (Ignored — Requer Upstream Clone)

```rust
// render/mod.rs:757-871
#[test]
#[ignore = "requires AGENCY_AGENTS_PARITY_ROOT and executes upstream convert.sh"]
fn upstream_convert_sh_is_byte_identical_for_transform_tools() {
    // 1. Roda bash convert.sh --tool X --out tempdir
    // 2. Para cada agente no corpus upstream:
    //    - Compara Rust render(agent, tool) vs arquivo gerado por convert.sh
    // 3. Tools testados: cursor, codex, geminiCli, opencode, qwen, zcode
    // 4. Skill tools: antigravity, osaurus, deepseekHarness
    // 5. Assert byte-identical
}
```

**Requer:** `AGENCY_AGENTS_PARITY_ROOT=/path/to/msitarzewski/agency-agents`

---

## 2. Testes Frontend (Svelte — `npm run check` / `npm run test`)

### 2.1 Type Checking
```bash
npm run check  # svelte-check --tsconfig ./tsconfig.json
```
- TypeScript strict mode
- Svelte 5 component types
- Tauri IPC types

### 2.2 Testes Unitários (Vitest)
```bash
npm run test  # vitest run
```
- Stores (runbooks, corpus, tools)
- Components (AgentCard, ToolBadge, DivisionChip)
- Utils (slugify, color parsing)

### 2.3 E2E (Playwright — Não Configurado)
- Não há `playwright.config.ts` no checkout
- `docs/PLAN.md` não menciona E2E

---

## 3. CI/CD Pipeline (Ausente no Fork)

### 3.1 `.github/workflows/` — **VAZIO**

O fork `Tokenizaa/agency-agents-app` **não tem workflows GitHub Actions**.

### 3.2 Pipeline Declarado no PLAN.md (Não Implementado)

```bash
# docs/PLAN.md:174-183
# Before release:
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run check
npm run build
npm run build:phase-c
```

### 3.3 Upstream CI (msitarzewski/agency-agents — Não Neste Fork)

| Workflow | Propósito | Status no Fork |
|----------|-----------|----------------|
| `lint-agents.yml` | `scripts/lint-agents.sh` | ❌ Ausente |
| `check-divisions.yml` | `scripts/check-divisions.sh` | ❌ Ausente |
| `check-tools.yml` | `scripts/check-tools.sh` | ❌ Ausente |
| `parity-test.yml` | Parity test vs convert.sh | ❌ Ausente |
| `release.yml` | Build + sign + publish | ❌ Ausente |

---

## 4. Scripts de Validação (Ausentes no Fork)

| Script | Função | Status |
|--------|--------|--------|
| `scripts/lint-agents.sh` | Valida frontmatter, cores, tools, slug uniqueness por agente | ❌ Ausente |
| `scripts/check-divisions.sh` | Valida dirs = divisions.json; NON_DIVISION_DIRS excluded | ❌ Ausente |
| `scripts/check-tools.sh` | Valida tools.json vs install.sh + convert.sh converters | ❌ Ausente |
| `scripts/build-hermes-plugin.py` | Gera plugin Hermes | ❌ Ausente |

---

## 5. Quality Gates Declarados vs Implementados

| Gate | Declarado Em | Implementado | Onde |
|------|--------------|--------------|------|
| `cargo fmt --check` | PLAN.md | ✅ Local only | `cargo fmt --check` |
| `cargo test --lib` | PLAN.md | ✅ Local only | `cargo test --lib` |
| `npm run check` | PLAN.md | ✅ Local only | `npm run check` |
| `npm run build` | PLAN.md | ✅ Local only | `npm run build` |
| `npm run build:phase-c` | PLAN.md | ✅ Local only | `tools/phase-c/phase-c.sh` |
| Render parity | PLAN.md + render/mod.rs | ⚠️ Ignored test | Requer upstream clone |
| Slug uniqueness | convert.sh | ✅ Runtime | `check_agent_slug_collisions()` |
| Frontmatter validity | lint-agents.sh | ❌ Script ausente | — |
| Division consistency | check-divisions.sh | ❌ Script ausente | — |
| Tools registry consistency | check-tools.sh | ❌ Script ausente | — |

---

## 6. Release Automation

### 6.1 Scripts Existentes
- `scripts/release.sh` — Build + sign macOS
- `scripts/release-linux.sh` — Build Linux
- `scripts/release-windows.ps1` — Build Windows
- `tools/release/publish-manifest.sh` — Publica manifest updater

### 6.2 Updater (Phase 15)
- Minisign public key em `src-tauri/src/lib.rs:49`
- `tauri.conf.json` configura endpoint
- `publish-manifest.sh` rsync para `agencyagents.app` (Caddy)
- **Endpoint ativo apenas no release v0.2.0+** (PLAN.md:137-139)

---

## 7. Cross-Platform Build (Phase C)

```bash
npm run build:phase-c          # Linux/macOS
npm run build:phase-c:full     # + VMs (PHASE_C_INCLUDE_VMS=1)
```

`tools/phase-c/phase-c.sh` orquestra:
- macOS: universal binary + .dmg + notarization
- Linux: AppImage + .deb + .rpm
- Windows: .msi (requer Windows runner)

---

## 8. Gaps Críticos

| Gap | Impacto | Mitigação |
|-----|---------|-----------|
| **Zero CI workflows** | Nenhum gate automático em PR/merge | Implementar workflows básicos |
| **Parity test ignored** | Rust render pode divergir do convert.sh | Rodar localmente pré-release |
| **Scripts validação ausentes** | Frontmatter/divisions/tools não validados em CI | Portar scripts ou reimplementar em Rust |
| **Sem E2E tests** | UI regressions não pegas | Adicionar Playwright |
| **Sem dependabot/renovate** | Dependencies outdated silently | Adicionar |

---

## 9. Evidências

| Item | Localização |
|------|-------------|
| Render tests | `src-tauri/src/render/mod.rs:456-949` |
| Parity test | `src-tauri/src/render/mod.rs:757-871` |
| Cargo.toml | `src-tauri/Cargo.toml` |
| package.json scripts | `package.json:8-17` |
| PLAN.md quality gates | `docs/PLAN.md:174-183` |
| Phase C script | `tools/phase-c/phase-c.sh` |
| Release scripts | `scripts/release*.sh`, `tools/release/publish-manifest.sh` |
| GitHub workflows | `ls -la .github/workflows/` → vazio |

---

## 10. Recomendação para NettosCorp

1. **Adicionar workflows mínimos**: `cargo fmt`, `cargo test`, `npm run check`, `npm run build`
2. **Portar `lint-agents.sh` para Rust** (integrar no `corpus` module) — valida frontmatter no refresh
3. **Habilitar parity test em CI** com upstream clone cached
4. **Adicionar Playwright** para smoke tests de UI crítica (install flow, reconcile)
5. **Dependabot** para Cargo.toml + package.json

---

*Documento baseado em inspeção de testes Rust (23 no render), package.json scripts, PLAN.md, e ausência confirmada de `.github/workflows/` e scripts de validação upstream.*