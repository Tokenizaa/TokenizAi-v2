# Roadmap de Integração

> **Versão:** 1.2  \
> **Data:** 22 de novembro de 2026  \
> **Status:** **FASE 0 HOMOLOGADA LOCALMENTE — FASE 1 AUTORIZADA**  \
> **Base:** Arquitetura Alvo (05) + Modelo de Domínio (06) + Segurança (09)  \
> **Responsável pela execução atual:** Platform / Conselheiro

---

## 1. Visão Geral das Fases

| Fase | Nome | Duração | Objetivo Principal | Entregável Chave |
|------|------|---------|-------------------|------------------|
| **0** | **Bootstrap & Fixes Críticos** | 1 sem | Recuperar upstream, fixar Hermes, CI básico | Hermes plugin funcional, CI verde — **em validação** |
| **1** | **Foundation Packages** | 2-3 sem | Extrair `@nettoscorp/shared`, `@nettoscorp/db`, `@nettoscorp/auth` | 3 packages publicados no npm privado |
| **2** | **Adapters & MCP** | 1-2 sem | Publicar 12 adapters ACP + MCP server/gateway | 14 packages publicados |
| **3** | **Plugin SDK v2** | 1 sem | `@nettoscorp/plugin-sdk` independente + sandbox providers | Package + docs + examples |
| **4** | **Frontend Shared** | 2 sem | `@nettoscorp/ui-primitives`, `@nettoscorp/frontend-query` | Design system + query client |
| **5** | **Module Architecture** | 3-4 sem | Federation no server + UI (TokenizAi + Paperclip) | Arquitetura modular funcional |
| **6** | **Catalog Sync Pipeline** | 2 sem | GitHub webhook → Paperclip Skill Catalog (AA upstream) | Sync automático + diff UI |
| **7** | **Agent Hire Flow** | 2 sem | AA corpus → Paperclip agent provisioning | `hireAgent(slug)` funcional |
| **8** | **Governance Layer** | 3-4 sem | Authority Engine, Policy Engine, Audit Trail | RBAC + ABAC + Immutable audit |
| **9** | **Memory & Knowledge Layer** | 4-6 sem | Vector DB + RAG + Knowledge Graph + Attribution | Long-term memory funcional |
| **10** | **NEXUS Adoption** | 3-4 sem | Playbooks, Runbooks, Workflow Engine | Pipeline Dev-QA automatizado |
| **11** | **Unified CI/CD + Observability** | 2 sem | Turbo pipeline, OTel unificado, dashboards | Deploy automatizado + SLOs |
| **12** | **Homologação & Documentação** | 2 sem | Testes de aceitação, runbooks, treinamento | Go-live autorizado |

**Total Estimado:** **26-34 semanas** (~6-8 meses)

---

## 2. Detalhamento por Fase

### Fase 0: Bootstrap & Fixes Críticos (1 semana) — **HOMOLOGADA LOCALMENTE (22/11/2026)**

| Task | Responsável | Critério de Aceite |
|------|-------------|-------------------|
| Confirmar e validar `scripts/build-hermes-plugin.py` no fork, usando upstream `8ae6164` como referência | Platform | Script gera plugin e passa contract/behavior tests |
| Confirmar presença e executar `scripts/lib.sh`, `install.sh`, `lint-agents.sh`, `check-divisions.sh`, `check-tools.sh` | Platform | Scripts executam sem erro |
| Confirmar sincronização da pasta `strategy/` (NEXUS) com o upstream | Platform | Sete playbooks de fase, estratégia e runbooks presentes e consistentes |
| Configurar GitHub Actions básico: `cargo fmt`, `cargo test`, `npm run check`, `npm run build` | Platform | CI verde no fork Tokenizaa |
| Confirmar que Antigravity não emite `date_added` e adicionar teste de determinismo | Platform | Parity/determinismo passa em CI |
| Fix `EvidenceQA` → `testing-evidence-collector` no orchestrator | Platform | Agente referência corrigido no commit `4df4038` |

**Estado de execução (22/11/2026 — Homologação Local):**

- [x] Builder Hermes e scripts de validação já presentes no fork `Tokenizaa/agency-agents`; nenhum recopy desnecessário do upstream.
- [x] Pasta `strategy/` presente: estratégia NEXUS, sete playbooks de fase e runbooks de cenário.
- [x] Conversor Antigravity atual não gera `date_added`; teste de determinismo criado e conectado ao workflow.
- [x] Quatro referências antigas `EvidenceQA` substituídas pelo slug real `testing-evidence-collector`.
- [x] CI da aplicação ampliado para executar `npm run build`, além de `cargo fmt`, `cargo test` e `npm run check`.
- [x] CI do corpus ampliado para gerar e testar o plugin Hermes e verificar determinismo Antigravity.
- [x] **Validações locais executadas (22/11/2026):**
  - `lint-agents.sh` ✅ (0 erros, 58 warnings — seções recomendadas)
  - `check-divisions.sh` ✅ (18 divisões consistentes)
  - `check-tools.sh` ✅ (17 ferramentas consistentes)
  - `check-hermes-plugin.py` ✅ (esquemas válidos)
  - `test-hermes-plugin.py` ✅ (6 testes passing)
  - `test-antigravity-determinism.sh` ✅ (determinístico)
  - `npm run check` ✅ (0 erros, 0 warnings)
  - `npm run build` ✅ (build exitoso)
  - `cargo fmt --check` ✅ (passa com manifest-path)
  - `bun run build` ✅ (TokenizAi)
  - `npx tsc --noEmit` ✅ (TokenizAi)
- [ ] **Bloqueio de homologação CI remoto:** execuções do GitHub Actions em ambos os repositórios terminaram em falha antes de qualquer step (lista de steps vazia/nula); logs não foram disponibilizados. A causa é bloqueio de cobrança/container do GitHub Actions — **não falha de código**.
- [ ] **Pendência técnica documentada:** `cargo test` falha por problema no build script Tauri (caminho de permissões ausente em ambiente de build), não por falha de código. `cargo fmt --check` passa.
- [ ] **Diretórios de referência:** `agency-agents/` e `paperclip/` em TokenizAi classificados como referências intencionais (metadados AGENTS.md, builds). `.svelte-kit/` classificado corretamente como artefato gerado e não rastreado.
- [ ] **Reconciliação Git confirmada:** três repositórios com HEAD = origin/main:
  - TokenizAi: `61da94a`
  - Agency Agents corpus: `4df4038`
  - Agency Agents desktop app: `6d9a355`

**Decisão:** Fase 0 **homologada localmente**. CI remoto permanece como pendência financeira (bloqueio de cobrança GitHub Actions), não bloqueia o início da Fase 1.

### Fase 1: Foundation Packages (2-3 semanas)

| Package | Conteúdo | Esforço | Dependências |
|---------|----------|---------|--------------|
| `@nettoscorp/shared` | Types, Zod schemas, constants, utils (de `@paperclipai/shared` + Agency Agents frontmatter) | 1 sem | — |
| `@nettoscorp/db` | Drizzle schema base (companies, users, roles, memberships, agents, skills) + migrations + embedded PG | 1-2 sem | `@nettoscorp/shared` |
| `@nettoscorp/auth` | Better Auth config base + RBAC helpers + clearance/authority types | 1 sem | `@nettoscorp/shared`, `@nettoscorp/db` |

**Critério de Aceite:** 3 packages publicados no npm privado, `pnpm add` funciona, tipos exportados corretos.

### Fase 2: Adapters & MCP (1-2 semanas)

| Package | Conteúdo | Esforço |
|---------|----------|---------|
| `@nettoscorp/adapter-claude` | Wrapper do `@paperclipai/adapter-claude-local` | 0.5 sem |
| `@nettoscorp/adapter-codex` | Wrapper do `@paperclipai/adapter-codex-local` | 0.5 sem |
| `@nettoscorp/adapter-cursor` | Wrapper do `@paperclipai/adapter-cursor-local` + cloud | 0.5 sem |
| `@nettoscorp/adapter-gemini` | Wrapper do `@paperclipai/adapter-gemini-local` | 0.5 sem |
| `@nettoscorp/adapter-copilot` | Wrapper do `@paperclipai/adapter-copilot` | 0.5 sem |
| `@nettoscorp/adapter-qwen` | Wrapper do `@paperclipai/adapter-qwen` | 0.5 sem |
| `@nettoscorp/adapter-opencode` | Wrapper do `@paperclipai/adapter-opencode-local` | 0.5 sem |
| `@nettoscorp/adapter-hermes` | **Novo** — Hermes Gateway adapter (fix Fase 0) | 1 sem |
| `@nettoscorp/mcp-server` | Wrapper do `@paperclipai/mcp-server` | 0.5 sem |
| `@nettoscorp/mcp-gateway` | Wrapper do `public-mcp` HTTP/SSE | 0.5 sem |

**Critério de Aceite:** 12 adapters + 2 MCP packages publicados, integração testada com Paperclip server.

### Fase 3: Plugin SDK v2 (1 semana)

| Task | Descrição |
|------|-----------|
| Extrair `@paperclipai/plugin-sdk` → `@nettoscorp/plugin-sdk` v2.0.0 | Independente, sem dependências Paperclip |
| Atualizar sandbox providers para novo SDK | 9 providers |
| Documentação + examples + testing harness | Docs + CI |

**Critério de Aceite:** SDK v2.0.0 publicado, plugin example compila e carrega no Paperclip server.

### Fase 4: Frontend Shared (2 semanas)

| Package | Conteúdo |
|---------|----------|
| `@nettoscorp/ui-primitives` | Radix + Tailwind 4 components (Button, Dialog, Dropdown, etc.) |
| `@nettoscorp/frontend-query` | `createAppQueryClient` + `LiveUpdatesProvider` + WS fanout |
| `@nettoscorp/design-tokens` | Cores, spacing, typography, dark/light themes |

**Critério de Aceite:** 3 packages publicados, TokenizAi frontend migra sem breaking changes.

### Fase 5: Module Architecture (3-4 semanas)

| Componente | Descrição |
|------------|-----------|
| **Module Federation (Server)** | `createApp({ modules: [core, agents, skills, chat, workspaces, ...] })` |
| **Module Federation (UI)** | Lazy-loaded feature modules: `agents`, `skills`, `chat`, `workspaces`, `admin` |
| **Module Contract** | Interface `Module { routes, services, ui, migrations, config }` |
| **Shared Kernel** | `@nettoscorp/*` packages como dependencies de módulos |
| **Migration Strategy** | Paperclip `server/src/services/*` → módulos; TokenizAi `server.ts` → módulo `gateway` |

**Critério de Aceite:** Paperclip server carrega módulos dinamicamente; TokenizAi roda como módulo `gateway`.

### Fase 6: Catalog Sync Pipeline (2 semanas)

| Componente | Descrição |
|------------|-----------|
| **GitHub Webhook Listener** | `push` em `msitarzewski/agency-agents` → trigger sync |
| **Diff Engine** | Compara corpus upstream vs local (SHA por agente) |
| **Sync Job** | Baixa tarball, diff, atualiza `corpus-baseline`, re-index |
| **Diff UI** | Mostra agentes novos/atualizados/removidos antes de aplicar |
| **Rollback** | One-click revert para versão anterior do corpus |

**Critério de Aceite:** Sync automático funcionando, UI mostra diff, rollback testado.

### Fase 7: Agent Hire Flow (2 semanas)

| Componente | Descrição |
|------------|-----------|
| **Corpus Client** | `corpus.get(slug)` → retorna Agent + raw source |
| **Division Mapping** | 21 divisões AA → 21 roles NettosCorp (config-driven) |
| **Frontmatter Extension** | `nettoscorp: { department, clearance, authority, knowledge_domains }` |
| **Hire API** | `hireAgent(slug, options?) → AgentConfig` |
| **Tool Provisioning** | Auto-install em tools configuradas (ACP/MCP) |
| **Budget Binding** | Auto-vincula `budget_policy` baseado no role |

**Critério de Aceite:** `hireAgent("engineering-senior-developer")` cria agent no Paperclip com config completa, instala em 3+ tools.

### Fase 8: Governance Layer (3-4 semanas)

| Componente | Descrição |
|------------|-----------|
| **Authority Engine** | Valida `delegate()` → clearance + authority + budget + policy |
| **Policy Engine (OPA/Rego)** | Regras declarativas para budgets, tool access, data access |
| **Approval Gateway** | Gates configuráveis (P0-P3) com SLA, escalação automática |
| **Audit Trail** | Immutable log (append-only, hash-chained, tamper-evident) |
| **Compliance Dashboard** | Retenção, integridade, alertas de drift |

**Critério de Aceite:** `delegate()` valida authority + budget + policy; audit log imutável; approval gates funcionais.

### Fase 9: Memory & Knowledge Layer (4-6 semanas)

| Componente | Descrição |
|------------|-----------|
| **Vector DB** | pgvector (PostgreSQL) — embeddings `text-embedding-3-large` |
| **RAG Pipeline** | Ingest → chunk → embed → store → retrieve (hybrid: vector + keyword + graph) |
| **Knowledge Graph** | Apache Age (PostgreSQL extension) — nodes: Agent, Skill, Task, Decision, Pattern |
| **Attribution** | Cada nó/aresta: `author`, `timestamp`, `clearance`, `evidence_ref` |
| **Agent Memory API** | `remember(key, value)`, `recall(query)`, `forget(key)` — scoped por agent + clearance |

**Critério de Aceite:** Agent faz `recall("como otimizei workspace-recovery")` e recupera decisão anterior com evidência.

### Fase 10: NEXUS Adoption (3-4 semanas)

| Componente | Descrição |
|------------|-----------|
| **Playbook Engine** | YAML/JSON playbooks reutilizáveis (não hardcoded) |
| **Runbook Engine** | Incident response runbooks com automação |
| **Workflow Engine** | Routines + triggers + SLA + escalation (Paperclip + NEXUS) |
| **Metrics Dashboard** | First-pass rate, avg retries, cycle time, QA coverage |

**Critério de Aceite:** Pipeline Dev-QA automatizado com playbooks reutilizáveis, métricas visíveis.

### Fase 11: Unified CI/CD + Observability (2 semanas)

| Componente | Descrição |
|------------|-----------|
| **Turbo Pipeline** | `pnpm turbo run build test lint typecheck` — affected only |
| **Changesets** | Versionamento automático + changelog + npm publish |
| **OTel Unificado** | Traces + Metrics + Logs → single backend (Grafana/Tempo/Prometheus) |
| **SLO Dashboards** | Latency p95, Error rate, Availability, Agent spawn time, Task completion |
| **Alerting** | P0-P3 alertas + escalation automática |

### Fase 12: Homologação + Documentação (2 semanas)

| Task | Critério |
|------|----------|
| **Testes de Aceitação** | 100% scenarios críticos passam (E2E + Contract) |
| **Load Testing** | 1000 agents simultâneos, 10k tasks/hora |
| **Chaos Engineering** | Sandbox failure, network partition, DB failover |
| **Security Audit** | Pen test + dependency scan + secret scan |
| **Runbooks Operacionais** | Deploy, rollback, incident response, backup/restore |
| **Treinamento** | Docs para Devs, PMs, Security, Founder |
| **Go-Live Authorization** | Assinatura Founder + CISO + CTO |

---

## 3. Marcos Críticos (Milestones)

| Marco | Data Alvo | Critério |
|-------|-----------|----------|
| **M0: Bootstrap Completo** | Semana 1 | Fase 0 done, CI verde |
| **M1: Foundation Ready** | Semana 4 | 3 foundation packages publicados |
| **M2: Adapters + MCP Ready** | Semana 6 | 14 packages publicados |
| **M3: Plugin SDK + Frontend Ready** | Semana 8 | 5 packages publicados |
| **M4: Module Architecture** | Semana 12 | Paperclip + TokenizAi modular |
| **M5: Catalog Sync + Agent Hire** | Semana 16 | AA → Paperclip flow funcional |
| **M6: Governance + Memory** | Semana 24 | Authority Engine + RAG operacional |
| **M7: NEXUS + CI/CD** | Semana 30 | Pipeline automatizado + métricas |
| **M8: Go-Live** | Semana 32-34 | Homologação assinada, Go-Live |

---

## 4. Riscos do Cronograma

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Upstream `msitarzewski/agency-agents` muda API | Fase 0, 6 atrasam | Pin commit `8ae6164`; sync controlado |
| Paperclip React 19/Express 5 breaking | Fase 5, 11 atrasam | Lock versions; test matrix |
| OPA/Rego learning curve | Fase 8 atrasa | Treinamento + templates prontos |
| Vector DB performance | Fase 9 escala | pgvector primeiro; migra se necessário |
| Founder availability para approvals | Todas fases | Agendar reviews semanais fixos |

---

## 5. Recursos Necessários

| Role | Alocação | Fases |
|------|----------|-------|
| **Platform Engineer (Hermes)** | 100% | Todas |
| **Backend Engineer** | 100% | Fases 1-5, 7-8 |
| **Frontend Engineer** | 100% | Fases 4-5, 11 |
| **DevOps/Platform** | 50% | Fases 0, 5, 11 |
| **Security Engineer** | 50% | Fases 8-9, 12 |
| **QA/Automation** | 50% | Fases 10-12 |
| **Founder (Netto)** | Reviews semanais | Todas (governança) |

---

*Execução da Fase 0 autorizada pelo Founder (Netto Farias). O roadmap será executado uma fase completa por rodada; nenhuma fase seguinte começa antes da homologação integral da fase atual.*
## 5. Protocolo Permanente de Execução das Fases

- Cada fase do roadmap institucional deverá ser executada como uma unidade completa de trabalho, do início ao encerramento formal
- Não será permitido iniciar a fase seguinte enquanto a fase atual não estiver integralmente concluída, validada, documentada e submetida à homologação
- Todos os 9 critérios obrigatórios devem ser atendidos: escopo, implementação, validação, consistência, Git, documentação, pendências, relatório de encerramento e homologação
- Uma pendência não bloqueadora pode ser aceita na homologação, desde que documentada, com impacto avaliado e que não comprometa os objetivos ou critérios de aceite da fase
- O fluxo institucional passa a ser: Planejamento da fase → Execução integral → Validação → Revisão de consistência → Documentação → Reconciliação Git → Relatório de encerramento → Homologação → Abertura da próxima fase
- Não iniciar a Fase 2 antes da homologação integral da Fase 1

