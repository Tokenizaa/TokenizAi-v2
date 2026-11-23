# Agency Agents — Riscos Técnicos e Inconsistências (11-TECHNICAL-RISKS-AND-INCONSISTENCIES)

> **Data:** 21 de novembro de 2026  
> **Checkout:** `/home/lg/workspace/NettosCorp/NettosCorp/enterprise/agency-agents`  
> **Base:** 10 documentos de engenharia reversa prévios

---

## 1. Resumo de Riscos por Severidade

| Severidade | Contagem | Descrição |
|------------|----------|-----------|
| 🔴 **Crítico** | 4 | Bloqueia funcionalidade core ou integração |
| 🟡 **Alto** | 7 | Degrada significativamente usabilidade/confiabilidade |
| 🟢 **Médio** | 6 | Requer trabalho antes de produção |
| ⚪ **Baixo** | 3 | Melhorias incrementais |

---

## 2. Riscos Críticos (🔴)

### R1. Hermes Plugin Quebrado — `build-hermes-plugin.py` Ausente
**Evidência:** `tools.json:17` declara `format: "hermes-router-plugin"`, `convert.sh:791-794` chama `python3 build-hermes-plugin.py`, mas `find . -name "build-hermes-plugin.py"` → **vazio**.

**Impacto:** Integração Hermes **completamente não funcional** no checkout local. O fork Tokenizaa perdeu o script que gera o plugin router.

**Causa Raiz:** Fork `Tokenizaa/agency-agents-app` não incluiu `scripts/` completo do upstream `msitarzewski/agency-agents`.

**Mitigação:** Recuperar do upstream OU reimplementar em Rust no `render/mod.rs` (case `"hermes-router-plugin"`).

---

### R2. Scripts de Validação Ausentes — CI/CD Inexo
**Evidência:** `scripts/lint-agents.sh`, `scripts/check-divisions.sh`, `scripts/check-tools.sh`, `scripts/install.sh`, `scripts/lib.sh` → **todos ausentes**. `.github/workflows/` **vazio**.

**Impacto:** 
- Frontmatter inválido não pego (cores desconhecidas, tools inexistentes, slugs duplicados)
- Divisions.json vs dirs não validado
- Tools.json vs converters não validado
- Zero gates automáticos em PR/merge

**Causa Raiz:** Fork não copiou pasta `scripts/` completa do upstream.

**Mitigação:** Portar validações para Rust (integrar no `corpus` module) OU restaurar scripts do upstream.

---

### R3. Antigravity Bloqueado — `date_added` Non-Deterministic
**Evidência:** `docs/PLAN.md:88` — *"blocked on upstream: convert_antigravity() still stamps a non-deterministic `date_added: '${TODAY}'`, so byte-parity is impossible until that field is removed or made deterministic."*

**Impacto:** Antigravity (skill tool) **não é installable** no app Tauri — recognized-only. Usuários não podem instalar via app.

**Causa Raiz:** Upstream `convert.sh` usa `TODAY` variable no template Antigravity SKILL.md.

**Mitigação:** Patch local no `convert.sh` (remover `date_added` ou fixar) + PR upstream.

---

### R4. NEXUS Strategy Ausente — Metodologia Incompleta
**Evidência:** Busca por `nexus*`, `EXECUTIVE-BRIEF`, `QUICKSTART`, `strategy/`, `coordination/`, `playbooks/`, `runbooks/`, `runbooks.json` → **vazio**. Apenas `agents-orchestrator.md` existe no corpus.

**Impacto:** 
- Metodologia de orquestração não disponível para adoção
- Playbooks/runbooks reutilizáveis perdidos
- Métricas de eficiência não documentadas
- Agente `agents-orchestrator` referencia agentes que podem não existir (ex: `EvidenceQA` vs `testing-evidence-collector`)

**Causa Raiz:** Fork é do **app Tauri**, não do catálogo completo. Pasta `strategy/` só existe no upstream `msitarzewski/agency-agents`.

**Mitigação:** Sync da pasta `strategy/` do upstream para docs/methodology NettosCorp.

---

## 3. Riscos Altos (🟡)

### R5. EvidenceQA Name Mismatch — Handoff Frágil
**Evidência:** `agents-orchestrator.md:89-90` referencia `EvidenceQA` agent, mas corpus tem `testing/testing-evidence-collector.md` (frontmatter `name: Evidence Collector`).

**Impacto:** Orchestrator tenta spawnar agente que não existe pelo nome `EvidenceQA`. Handoff Dev→QA falha silenciosamente ou com erro confuso.

**Mitigação:** Atualizar `agents-orchestrator.md` para usar `testing-evidence-collector` OU adicionar alias no frontmatter.

---

### R6. 10/18 Tools Recognized-Only — Instalação Limitada
**Evidência:** `docs/PLAN.md:86-92` — Aider, Windsurf, OpenClaw, Kimi, Antigravity, Vibe, ZCode, DSH, Hermes, DeepSeek são **recognized-only** no app Tauri.

**Impacto:** Usuários do app Tauri **não podem instalar** agentes nesses tools via UI. Precisam rodar `convert.sh` manualmente + `install.sh` (ausente).

**Mitigação:** Implementar renderers multi-file no Rust (`render/mod.rs`) para: Aider (roster), Windsurf (roster), OpenClaw (multi-file), Kimi (multi-file).

---

### R7. Parity Test Ignored — Drift Risk
**Evidência:** `render/mod.rs:757-871` — teste `upstream_convert_sh_is_byte_identical_for_transform_tools` marcado `#[ignore]`, requer `AGENCY_AGENTS_PARITY_ROOT` env var.

**Impacto:** Rust render pode divergir do `convert.sh` bash sem detecção automática. Drift silencioso até user reportar.

**Mitigação:** Configurar CI com upstream clone cached + rodar parity test em toda PR.

---

### R8. lib.sh Ausente — convert.sh Quebrado Standalone
**Evidência:** `convert.sh:77` faz `source "$SCRIPT_DIR/lib.sh"` mas `find . -name "lib.sh"` → vazio. Funções críticas (`get_field`, `get_body`, `slugify`, `yaml_quote`, `toml_escape_string`, `fence_open_p`, `resolve_opencode_color`) **não definidas**.

**Impacto:** `convert.sh` **não roda standalone** no checkout local. Apenas o Rust render funciona.

**Mitigação:** Restaurar `lib.sh` do upstream OU portar todas as funções para Rust (já feito no `render/mod.rs` — usar Rust CLI em vez de bash).

---

### R9. install.sh Ausente — Gap Conversão→Instalação
**Evidência:** `convert.sh` gera `integrations/<tool>/` mas `install.sh` (que copiaria para dirs reais do usuário) **ausente**.

**Impacto:** Pipeline completo quebrado: source → convert → **STOP**. Usuário deve copiar manualmente.

**Mitigação:** App Tauri já faz install via Rust — documentar que `convert.sh` é apenas para ferramentas não suportadas pelo app.

---

### R10. Upstream Sync Não Automatizado — Fork Divergente
**Evidência:** Fork `Tokenizaa/agency-agents-app` não tem automation para sync do `msitarzewski/agency-agents` (catálogo + scripts + NEXUS).

**Impacto:** Novos agentes, fixes de bugs, novos tools, NEXUS updates **não chegam** no fork automaticamente.

**Mitigação:** GitHub Action scheduled (diário) que fetch upstream, aplica patches locais, abre PR.

---

### R11. `scripts/` Referenciado em convert.sh Mas Incompleto
**Evidência:** `convert.sh` referencia `scripts/lib.sh`, `scripts/build-hermes-plugin.py` mas pasta `scripts/` no checkout local só tem `release*.sh`.

**Impacto:** Quebra expectativa de desenvolvedores que clonam o fork achando que tem tooling completo.

**Mitigação:** Documentar claramente no README que este é o **app Tauri fork**, não o catálogo completo. Linkar para upstream.

---

## 4. Riscos Médios (🟢)

### R12. Vibe Tool Renderer Ausente no Rust
**Evidência:** `tools.json` tem `vibe` com `format: "vibe-toml"`, mas `render/mod.rs` não tem case para `"vibe-toml"` → cai em `unsupported()`.

**Impacto:** Vibe (Mistral) não installable via app Tauri.

---

### R13. DeepSeek Harness (dsh) Render OK Mas Não Testado
**Evidência:** `render/mod.rs` tem case `"skill-md"` que cobre `deepseekHarness` (test passa), mas não há teste de paridade com convert.sh para DSH.

**Impacto:** Possível drift silencioso.

---

### R14. ZCode Tools Pass-Through — Mapeamento Incompleto
**Evidência:** `render/mod.rs:296-311` — ZCode usa `tools` pass-through (não mapeia como Qwen). Docs ZCode não confirmam nomes.

**Impacto:** Tools podem não funcionar no ZCode subagent.

---

### R15. Kimi Multi-File Render Ausente
**Evidência:** `tools.json` Kimi tem `installKind: "per-agent"` mas `format: "kimi-agent"` (multi-file: agent.yaml + system.md). Rust render não implementa.

**Impacto:** Kimi recognized-only no app.

---

### R16. OpenClaw Multi-File Render Ausente
**Evidência:** `convert_openclaw()` em bash gera 3 arquivos (SOUL.md, AGENTS.md, IDENTITY.md). Rust render não tem case `"openclaw-workspace"`.

**Impacto:** OpenClaw recognized-only.

---

### R17. Aider/Windsurf Roster Render Ausente
**Evidência:** `convert.sh` acumula em temp files (Aider: CONVENTIONS.md, Windsurf: .windsurfrules). Rust render não implementa `installKind: "roster"`.

**Impacto:** Aider/Windsurf recognized-only.

---

## 5. Inconsistências Menores (⚪)

### I1. `scripts/` Directory Incompleto vs Referências
**Evidência:** `convert.sh` referencia `scripts/lib.sh`, `scripts/build-hermes-plugin.py` mas pasta só tem `release*.sh`.

### I2. `agents-orchestrator.md` Lista Agentes que Podem Não Existir
**Evidência:** Linhas 295-359 listam 60+ agentes por categoria. Alguns nomes podem não corresponder a slugs reais no corpus (ex: `EvidenceQA` vs `testing-evidence-collector`).

### I3. `Instructions Reference` Aponta para Arquivos Inexistentes
**Evidência:** ~20% agentes terminam com `**Instructions Reference**: Your detailed technical instructions are in \`ai/agents/dev.md\`` — pasta `ai/` **não existe** no baseline.

---

## 6. Matriz de Riscos por Componente

| Componente | Críticos | Altos | Médios | Baixos | Total |
|------------|----------|-------|--------|--------|-------|
| **Hermes Integration** | 1 (R1) | 0 | 0 | 0 | 1 |
| **CI/CD & Validation** | 1 (R2) | 2 (R7, R8) | 0 | 0 | 3 |
| **Antigravity** | 1 (R3) | 0 | 0 | 0 | 1 |
| **NEXUS/Strategy** | 1 (R4) | 0 | 0 | 1 (I2) | 2 |
| **Tools Coverage** | 0 | 1 (R6) | 5 (R12-R17) | 0 | 6 |
| **Orchestrator** | 0 | 1 (R5) | 0 | 1 (I2) | 2 |
| **Convert/Install Pipeline** | 0 | 2 (R8, R9) | 0 | 1 (I1) | 3 |
| **Upstream Sync** | 0 | 1 (R10) | 0 | 0 | 1 |
| **Agent Instructions** | 0 | 0 | 0 | 1 (I3) | 1 |
| **TOTAL** | **4** | **7** | **5** | **4** | **20** |

---

## 7. Plano de Mitigação Priorizado

| Prioridade | Ação | Risco(s) Addressed | Esforço |
|------------|------|-------------------|---------|
| **P0** | Recuperar `build-hermes-plugin.py` do upstream | R1 | 1 dia |
| **P0** | Restaurar `scripts/lib.sh` + `install.sh` + validações do upstream | R2, R8, R9 | 2-3 dias |
| **P0** | Patch Antigravity `date_added` → determinístico | R3 | 30 min |
| **P1** | Sync pasta `strategy/` (NEXUS) do upstream | R4 | 1 dia |
| **P1** | Fix `EvidenceQA` → `testing-evidence-collector` no orchestrator | R5 | 30 min |
| **P1** | Implementar GitHub Actions: fmt, test, check, parity | R7 | 2-3 dias |
| **P2** | Implementar renderers multi-file: Aider, Windsurf, OpenClaw, Kimi | R6, R14-R17 | 2-3 semanas |
| **P2** | Adicionar case `vibe-toml` no Rust render | R12 | 1 dia |
| **P2** | Automatizar upstream sync (GitHub Action scheduled) | R10 | 2 dias |
| **P3** | Documentar fork vs upstream claramente no README | R11, I1 | 1 dia |
| **P3** | Auditar `agents-orchestrator.md` vs corpus real | I2 | 2 dias |
| **P3** | Criar `ai/agents/dev.md` stubs ou remover referências | I3 | 1 semana |

---

## 8. Evidências Consolidadas

| Risco | Evidência Primária |
|-------|-------------------|
| R1 | `tools.json:17`, `convert.sh:791-794`, `find . -name "build-hermes-plugin.py"` |
| R2 | `find . -name "lint-agents.sh" -o -name "check-divisions.sh" -o -name "check-tools.sh" -o -name "install.sh" -o -name "lib.sh"`, `ls .github/workflows/` |
| R3 | `docs/PLAN.md:88` |
| R4 | `find . -name "nexus*" -o -name "EXECUTIVE*" -o -name "QUICKSTART*" -o -path "*/strategy/*"` |
| R5 | `agents-orchestrator.md:89-90` vs `find . -name "*evidence*"` |
| R6 | `docs/PLAN.md:86-92` |
| R7 | `src-tauri/src/render/mod.rs:757` (`#[ignore]`) |
| R8 | `convert.sh:77`, `find . -name "lib.sh"` |
| R9 | `find . -name "install.sh"` |
| R10 | Fork Tokenizaa vs upstream msitarzewski — sem sync automation |
| R11 | `convert.sh` references vs `ls scripts/` |
| R12 | `tools.json` vibe entry vs `render/mod.rs` match arms |
| R13-R17 | `tools.json` entries vs `render/mod.rs` match arms |

---

## 9. Conclusão

**O checkout local (Tokenizaa fork) é viável para o app Tauri**, mas **não é o catálogo completo**. Os riscos críticos (R1-R4) bloqueiam:
- Integração Hermes (R1)
- CI/CD e validação automática (R2)  
- Instalação Antigravity (R3)
- Adoção da metodologia NEXUS (R4)

**Recomendação imediata:** Recuperar arquivos faltantes do upstream `msitarzewski/agency-agents` (especialmente `scripts/`, `strategy/`, `build-hermes-plugin.py`) antes de investir em integração NettosCorp/Paperclip.

**O app Tauri em si (Rust + Svelte) é sólido** — 23 testes de paridade, reconcile engine robusto, arquitetura limpa. Os gaps são quase todos **ausência de arquivos do upstream no fork**, não bugs no código do app.

---

*Documento consolidado a partir de 10 documentos de engenharia reversa prévios. Cada risco cita evidência verificável no código ou estrutura de arquivos.*