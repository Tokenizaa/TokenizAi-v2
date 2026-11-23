# Agency Agents — Engenharia Reversa: Orquestração NEXUS (04-NEXUS-ORCHESTRATION)

> **Data:** 21 de novembro de 2026  
> **Checkout:** `/home/lg/workspace/NettosCorp/NettosCorp/enterprise/agency-agents`  
> **Status:** **Documentação NEXUS NÃO PRESENTE no checkout local** — apenas o agente `agents-orchestrator.md` existe no corpus.

---

## 1. Estado da Investigação

| Arquivo NEXUS Esperado | Status no Local | Status no Upstream (msitarzewski/agency-agents) |
|------------------------|-----------------|------------------------------------------------|
| `strategy/nexus-strategy.md` | ❌ Ausente | ✅ Existe (canônico) |
| `strategy/EXECUTIVE-BRIEF.md` | ❌ Ausente | ✅ Existe |
| `strategy/QUICKSTART.md` | ❌ Ausente | ✅ Existe |
| `strategy/coordination/` | ❌ Ausente | ✅ Existe |
| `strategy/playbooks/` | ❌ Ausente | ✅ Existe |
| `strategy/runbooks/` | ❌ Ausente | ✅ Existe |
| `strategy/runbooks.json` | ❌ Ausente | ✅ Existe |
| `specialized/agents-orchestrator.md` | ✅ Presente no corpus | ✅ Existe (mesmo agente) |

**Conclusão:** O fork `Tokenizaa/agency-agents-app` **não inclui a pasta `strategy/`** do upstream. A metodologia NEXUS completa vive apenas no repositório canônico `msitarzewski/agency-agents`.

---

## 2. O que Existe Localmente: `agents-orchestrator.md`

O único artefato NEXUS-related no checkout é o agente **Agents Orchestrator** (`src-tauri/resources/corpus-baseline/specialized/agents-orchestrator.md`, 367 linhas).

### 2.1 Modelo de Coordenação (Extraído do Agente)

```
Pipeline: PM → ArchitectUX → [Dev ↔ QA Loop] → Integration
```

**Fases Explícitas:**
1. **Phase 1: Project Analysis & Planning** — Spawn `project-manager-senior` para criar task list
2. **Phase 2: Technical Architecture** — Spawn `ArchitectUX` para fundação técnica
3. **Phase 3: Development-QA Continuous Loop** — Para cada task: Dev → EvidenceQA → PASS/FAIL → retry ou advance
4. **Phase 4: Final Integration & Validation** — Spawn `testing-reality-checker` para validação final

### 2.2 Hierarquia Operacional

| Nível | Agente | Responsabilidade |
|-------|--------|------------------|
| **Orchestrator** | `agents-orchestrator` | Pipeline autônomo end-to-end |
| **Planning** | `project-manager-senior` | Spec → task list (realista, sem luxo) |
| **Architecture** | `ArchitectUX` | Tech foundation + UX |
| **Development** | `Frontend Developer`, `Backend Architect`, `engineering-senior-developer`, `Mobile App Builder`, `DevOps Automator` | Implementação por task |
| **QA** | `EvidenceQA` | Screenshot-obsessed, PASS/FAIL com feedback |
| **Integration** | `testing-reality-checker` | Final certification, default "NEEDS WORK" |

### 2.3 Ativação e Delegação

**Launch Command (Single Command):**
```bash
Please spawn an agents-orchestrator to execute complete development pipeline for project-specs/[project]-setup.md. Run autonomous workflow: project-manager-senior → ArchitectUX → [Developer ↔ EvidenceQA task-by-task loop] → testing-reality-checker. Each task must pass QA before advancing.
```

**Delegação Explícita (do agente):**
- Spawna agentes via prompts em linguagem natural
- Cada spawn inclui: contexto, arquivo spec, deliverable esperado
- Exemplo: `"Please spawn a project-manager-senior agent to read the specification file at project-specs/[project]-setup.md and create a comprehensive task list. Save it to project-tasks/[project]-tasklist.md."`

### 2.4 Paralelismo

**Não há paralelismo explícito no agente.** O pipeline é **sequencial por task**:
- Task 1: Dev → QA → PASS → Task 2: Dev → QA → PASS → ...
- Paralelismo implícito: múltiplos agentes *podem* ser spawnados simultaneamente pelo usuário, mas o orchestrator não coordena isso nativamente.

### 2.5 Compartilhamento de Contexto

**Mecanismo:** Arquivos no filesystem (`project-specs/`, `project-tasks/`, `css/`, `project-docs/`)
- Spec lida por PM e ArchitectUX
- Task list escrita por PM, lida por ArchitectUX e Devs
- Architecture docs escritas por ArchitectUX, lidas por Devs
- QA valida implementação contra spec + architecture

**Não há:** Memory compartilhada em runtime, context window sharing, ou state machine distribuída.

### 2.6 Handoffs

| Handoff | De | Para | Artefato |
|---------|-----|------|----------|
| Spec → Tasks | PM | Orchestrator | `project-tasks/[project]-tasklist.md` |
| Tasks → Architecture | PM | ArchitectUX | Task list + spec |
| Architecture → Dev | ArchitectUX | Dev | `css/`, `project-docs/*-architecture.md` |
| Dev → QA | Dev | EvidenceQA | Implementation + task description |
| QA → Decision | EvidenceQA | Orchestrator | PASS/FAIL + feedback específico |
| All Tasks → Integration | Orchestrator | Reality Checker | All tasks PASS |

### 2.7 Controle de Tarefas

**Task List Format (criado por PM):**
```markdown
### [ ] Task 1: [Description]
### [ ] Task 2: [Description]
...
```
- Checkbox `[ ]` → `[x]` quando completa
- Orchestrator conta: `grep -c "^### \[ \]"`

### 2.8 Ciclos Dev-QA

```markdown
# Loop por Task:
1. Spawn Dev agent para implementar Task N
2. Spawn EvidenceQA para testar Task N
3. SE PASS: Marcar task `[x]`, avançar para Task N+1
4. SE FAIL: Loop back para Dev com feedback específico
5. Máximo 3 tentativas por task → então escalate
```

### 2.9 Escalonamento

| Trigger | Ação |
|---------|------|
| Agent spawn failure | Retry 2x → documentar → fallback manual |
| Task implementation failure (3 retries) | Marcar task blocked, continuar pipeline |
| QA agent failure | Retry QA spawn |
| Screenshot capture failure | Request manual evidence |
| Evidence inconclusive | Default to FAIL (safety) |

### 2.10 Gates de Qualidade

| Gate | Critério | Enforcement |
|------|----------|-------------|
| **Task QA** | EvidenceQA = PASS (screenshot evidence) | Bloqueia avanço para próxima task |
| **Architecture** | `ls -la css/ project-docs/*-architecture.md` | Verificação de arquivos esperados |
| **Final Integration** | testing-reality-checker = PASS | Default "NEEDS WORK" a menos que evidência overwhelming |
| **Retry Limit** | Máx 3 attempts/task | Hard-coded no agente |

### 2.11 Métricas e Relatórios

**Status Report Template (per orchestrator):**
- Pipeline Progress: Phase, Project, Started
- Task Completion: Total, Completed, Current, QA Status
- Dev-QA Loop: Attempts, Last Feedback, Next Action
- Quality Metrics: First-pass rate, avg retries, screenshots, major issues
- Next Steps: Immediate, ETA, Blockers

**Completion Report:**
- Duration, Final Status
- Task Results: Total, Completed, Retries, Blocked
- QA Cycles, Screenshots, Critical Issues Resolved
- Agent Performance por papel
- Production Readiness: READY/NEEDS_WORK/NOT_READY

---

## 3. Gaps: Agente vs Metodologia NEXUS Completa

| Aspecto NEXUS (Upstream) | No Agente Local | Status |
|--------------------------|-----------------|--------|
| **Coordination protocols** | Implícito via filesystem | Parcial |
| **Playbooks reutilizáveis** | Apenas pipeline hardcoded | ❌ Ausente |
| **Runbooks para incidentes** | Error handling básico | ❌ Ausente |
| **runbooks.json** (index) | ❌ | ❌ Ausente |
| **Métricas de eficiência** | Apenas contadores básicos | ❌ Sem metodologia |
| **Multi-project orchestration** | Single project | ❌ Ausente |
| **Team presets** | Lista de 60+ agentes disponíveis | Parcial |
| **Context passing patterns** | Filesystem apenas | Básico |

---

## 4. Verificação de Coerência

| Referência no Agente | Existe no Corpus? |
|----------------------|-------------------|
| `project-manager-senior` | ✅ `project-management/project-manager-senior.md` |
| `ArchitectUX` | ✅ `design/design-ux-architect.md` |
| `Frontend Developer` | ✅ `engineering/engineering-frontend-developer.md` |
| `Backend Architect` | ✅ `engineering/engineering-backend-architect.md` |
| `engineering-senior-developer` | ✅ `engineering/engineering-senior-developer.md` |
| `Mobile App Builder` | ✅ `engineering/engineering-mobile-app-builder.md` |
| `DevOps Automator` | ✅ `engineering/engineering-devops-automator.md` |
| `EvidenceQA` | ✅ `testing/testing-evidence-collector.md` (nome diferente!) |
| `testing-reality-checker` | ✅ `testing/testing-reality-checker.md` |

**Inconsistência detectada:** O agente referencia `EvidenceQA` mas o agente real no corpus é `testing-evidence-collector`. O nome `EvidenceQA` aparece em `testing/testing-evidence-collector.md` como aliases mas não como `name` no frontmatter.

---

## 5. Indicadores de Eficiência — Evidência?

**No agente local:** Apenas contadores básicos (tasks passed, retries, screenshots).
**No upstream (conforme PLAN.md):** "Renderer parity should be checked against the active AA clone" — mas isso é do app, não da metodologia NEXUS.

**Não há evidência de:** Metodologia de medição de eficiência NEXUS, benchmarks publicados, ou dados empíricos de ganho de produtividade.

---

## 6. Evidências

| Item | Localização |
|------|-------------|
| Agente completo | `src-tauri/resources/corpus-baseline/specialized/agents-orchestrator.md` |
| Pipeline phases | Linhas 55-108 |
| Decision logic | Linhas 110-168 |
| Status reporting | Linhas 170-207 |
| Launch command | Linhas 362-367 |
| Agentes referenciados | Linhas 295-359 |
| Busca NEXUS no local | `find . -name "nexus*" -o -name "NEXUS*" -o -name "EXECUTIVE*" -o -name "QUICKSTART*" -o -path "*/strategy/*"` → vazio |

---

## 7. Conclusão

**A metodologia NEXUS completa NÃO está disponível neste checkout.** O fork Tokenizaa contém apenas:
1. O agente `agents-orchestrator.md` (uma implementação prática de pipeline)
2. Referências a 60+ agentes especialistas disponíveis para orquestração

**Para obter a metodologia NEXUS completa,** seria necessário acessar o repositório upstream `msitarzewski/agency-agents` na pasta `strategy/`.

**O agente `agents-orchestrator` implementa um subconjunto prático:** pipeline sequencial Dev-QA com retry logic, mas carece de:
- Playbooks reutilizáveis
- Runbooks de incidentes
- Coordenação multi-projeto
- Métricas de eficiência validadas
- Context sharing avançado

---

*Documento baseado no único artefato NEXUS-related presente no checkout local (`agents-orchestrator.md`) e busca exaustiva por arquivos de estratégia ausentes.*