# Agency Agents — Engenharia Reversa: Integração Hermes (06-HERMES-INTEGRATION)

> **Data:** 21 de novembro de 2026  
> **Checkout:** `/home/lg/workspace/NettosCorp/NettosCorp/enterprise/agency-agents`  
> **Status:** **QUEBRADA** — `build-hermes-plugin.py` ausente no checkout local

---

## 1. Visão Geral da Integração

A integração Hermes permite que o **Hermes Agent** descubra, inspecione, carregue e delegue tarefas aos agentes do catálogo Agency Agents via **4 ferramentas MCP-style**:

| Ferramenta | Propósito |
|------------|-----------|
| `agency_agents_search` | Busca agentes por query, divisão, especialidade |
| `agency_agents_inspect` | Retorna metadados + corpo completo de um agente |
| `agency_agents_load` | Injeta agente no contexto do Hermes (system prompt) |
| `agency_agents_delegate` | Spawna subagente especializado para tarefa específica |

---

## 2. Evidências no Código Local

### 2.1 tools.json (Registry Entry)

```json
// src-tauri/data/tools.json:17
"hermes": {
  "id": "hermes",
  "label": "Hermes",
  "short": "Hermes",
  "kebab": "hermes",
  "accent": "#7C3AED",
  "icon": null,
  "order": 14,
  "scope": {"user": true, "project": false},
  "detect": {"dirs": [".hermes"], "agentsDir": ".hermes/plugins"},
  "version": {"bin": "hermes", "args": ["--version"]},
  "format": "hermes-router-plugin",
  "installKind": "plugin",
  "slugFrom": null,
  "dest": {"user": [".hermes/plugins/agency-agents-router"], "project": []}
}
```

**Key points:**
- `installKind: "plugin"` — não é per-agent, é um plugin único
- `format: "hermes-router-plugin"` — format custom, não implementado no Rust render
- `dest.user: [".hermes/plugins/agency-agents-router"]` — diretório do plugin
- `slugFrom: null` — não deriva slug de agente

### 2.2 convert.sh (Build Trigger)

```bash
# convert.sh:791-794
if [[ "$tool" == "hermes" ]]; then
  clean_tool_output "$tool" || return 1
  python3 "$SCRIPT_DIR/build-hermes-plugin.py" --repo-root "$REPO_ROOT" --out "$OUT_DIR/hermes"
  return
fi
```

**Fluxo:**
1. `convert.sh --tool hermes` (ou `--tool all`)
2. Limpa `integrations/hermes/`
3. Chama `python3 scripts/build-hermes-plugin.py`
3. Output esperado em `integrations/hermes/`

### 2.3 Render Rust (Ausente)

```rust
// src-tauri/src/render/mod.rs:246-338
let format = registry::get(tool).and_then(|m| m.format.as_deref());
let out = match format {
    Some("identity") => ...
    Some("cursor-mdc") => ...
    // ...
    _ => return Err(unsupported(tool)),  // ← hermes-router-plugin cai aqui
}
```

**Resultado:** `render()` retorna `Err(AppError::Io { message: "tool 'hermes' is not supported for install yet (multi-file format)" })` para Hermes.

---

## 3. O Arquivo Ausente: `build-hermes-plugin.py`

**Não existe em:** `/home/lg/workspace/NettosCorp/NettosCorp/enterprise/agency-agents/src-tauri/resources/corpus-baseline/scripts/`

**Existe no upstream:** `msitarzewski/agency-agents/scripts/build-hermes-plugin.py` (confirmado via documentação e referências)

### 3.1 Função Esperada (Baseado em Referências)

O script deve:
1. **Ler** todo o corpus-baseline (282 agentes)
2. **Serializar** catálogo para formato Hermes (JSON/index)
3. **Gerar** plugin router Hermes (TypeScript/JS)
4. **Escrever** em `integrations/hermes/agency-agents-router/`

### 3.2 Estrutura Esperada do Plugin

```
integrations/hermes/
└── agency-agents-router/
    ├── plugin.json           # Manifest Hermes
    ├── index.js              # Entry point
    ├── catalog.json          # Índice completo (slug → metadata)
    ├── agents/               # Ou lazy-load via search
    │   └── <slug>.json       # Agente individual (opcional)
    └── tools/
        ├── agency_agents_search.js
        ├── agency_agents_inspect.js
        ├── agency_agents_load.js
        └── agency_agents_delegate.js
```

---

## 4. Como os Agentes São Descobertos (Design Inferido)

### 4.1 Search (`agency_agents_search`)

```typescript
// Input: { query?: string, division?: string, skills?: string[], limit?: number }
// Output: { agents: [{ slug, name, description, division, color, emoji, vibe }] }
// Implementação: Filtro em catalog.json (carregado na memória)
```

### 4.2 Inspect (`agency_agents_inspect`)

```typescript
// Input: { slug: string }
// Output: { slug, name, description, division, frontmatter, body, tools }
// Implementação: Load agente individual (lazy) ou do catalog.json
```

### 4.3 Load (`agency_agents_load`)

```typescript
// Input: { slug: string, context?: object }
// Output: { systemPrompt: string, metadata }
// Implementação: Concatena frontmatter + body → system prompt Hermes
// Injeta no contexto da conversa atual
```

### 4.4 Delegate (`agency_agents_delegate`)

```typescript
// Input: { slug: string, task: string, context?: object }
// Output: { result: string, artifacts?: any[] }
// Implementação: Spawna subagente Hermes com system prompt do agente
// Retorna resultado da execução
```

---

## 5. Ciclo de Vida dos Subagentes (Inferido)

```
Hermes Main Agent
      │
      ├── agency_agents_search("frontend react performance")
      │       ↓
      │   Returns: [frontend-developer, senior-developer, ...]
      │
      ├── agency_agents_inspect("engineering-senior-developer")
      │       ↓
      │   Returns: full agent metadata + body
      │
      ├── agency_agents_load("engineering-senior-developer")
      │       ↓
      │   Injects system prompt into current context
      │
      └── agency_agents_delegate("engineering-frontend-developer", 
           "Optimize this React component for Core Web Vitals")
              ↓
          Spawns subagent with agent's system prompt
              ↓
          Returns: optimized code + explanation
```

---

## 6. Tratamento de Limites e Falhas (Inferido/Projetado)

| Cenário | Mitigação Projetada |
|---------|---------------------|
| **Context window overflow** | `agency_agents_load` injeta apenas system prompt; `delegate` roda em sub-contexto isolado |
| **Timeout** | `delegate` com timeout configurável (default 5min); retorna partial + error |
| **Cancelamento** | Hermes `cancel_task` propaga para subagente |
| **Agente não encontrado** | `inspect/load/delegate` retornam erro estruturado `AGENT_NOT_FOUND` |
| **Catálogo desatualizado** | Plugin pode expor `catalog_version` + `last_synced`; Hermes compara com local |
| **Fallback** | Se plugin indisponível, Hermes usa agentes built-in ou avisa usuário |

---

## 7. Instalação e Habilitação

### 7.1 Via App Tauri (Projetado)

```bash
# No app: Tools → Hermes → Install
# Ou CLI:
agency-agents install --tool hermes --scope user
```

### 7.2 Via convert.sh (Atual, Quebrado)

```bash
# Requer build-hermes-plugin.py
./scripts/convert.sh --tool hermes
# Output: integrations/hermes/agency-agents-router/
```

### 7.3 Manual (Workaround Atual)

```bash
# 1. Obter build-hermes-plugin.py do upstream
# 2. Executar:
python3 build-hermes-plugin.py --repo-root . --out ./integrations/hermes
# 3. Copiar para ~/.hermes/plugins/agency-agents-router/
# 4. Reiniciar Hermes
```

---

## 8. Gaps Críticos Identificados

| Gap | Severidade | Detalhes |
|-----|------------|----------|
| **build-hermes-plugin.py ausente** | 🔴 **Crítico** | Integração completamente não funcional no checkout local |
| **Format não implementado no Rust** | 🟡 Alto | `hermes-router-plugin` cai em `unsupported()` no render |
| **Plugin manifest não definido** | 🟡 Alto | Não há `plugin.json` schema documentado |
| **Catalog serialization** | 🟡 Alto | Como 282 agentes são empacotados? (inline vs lazy) |
| **Versionamento do plugin** | 🟢 Médio | Como Hermes detecta updates do catálogo? |
| **Auth/permissões** | 🟢 Médio | Plugin roda com permissões do Hermes? |

---

## 8. Recuperação do Arquivo Ausente

**Ação necessária:** Obter `build-hermes-plugin.py` do repositório upstream `msitarzewski/agency-agents` (branch main).

**Local provável no upstream:**
- `scripts/build-hermes-plugin.py`
- Ou `integrations/hermes/build-hermes-plugin.py`

**Dependências prováveis:**
- Python 3.8+
- `pyyaml` para parsing frontmatter
- Acesso ao corpus-baseline local

---

## 9. Evidências

| Item | Localização |
|------|-------------|
| tools.json hermes entry | `src-tauri/data/tools.json:17` (linhas 1-22 do JSON) |
| convert.sh hermes case | `src-tauri/resources/corpus-baseline/scripts/convert.sh:791-794` |
| Render unsupported | `src-tauri/src/render/mod.rs:336` |
| Busca arquivo ausente | `find . -name "build-hermes-plugin.py"` → vazio |
| Plugin dest | `tools.json: "dest": {"user": [".hermes/plugins/agency-agents-router"]}` |

---

## 10. Conclusão

**A integração Hermes está arquitetada mas não funcional neste checkout.** O fork Tokenizaa perdeu o script crítico `build-hermes-plugin.py` que gera o plugin router.

**Para restaurar:**
1. Baixar `build-hermes-plugin.py` do upstream `msitarzewski/agency-agents`
2. Colocar em `src-tauri/resources/corpus-baseline/scripts/`
3. Executar `./scripts/convert.sh --tool hermes`
4. Verificar output em `integrations/hermes/`
5. Testar instalação no Hermes Agent

**Alternativa:** Reimplementar a lógica em Rust no `render/mod.rs` adicionando case `"hermes-router-plugin"` — mas requer entendimento do formato de plugin Hermes.

---

*Documento baseado em evidências de código (tools.json, convert.sh, render/mod.rs) e ausência confirmada do script Python crítico.*