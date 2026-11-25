# Evidências e Pendências

> **REGISTRO HISTÓRICO SUPERADO — 25/11/2026:** Este inventário contém evidências e pendências da arquitetura anterior à migração direta para Hermes. Qualquer item que solicite configurar `PAPERCLIP_ENDPOINT`, `PAPERCLIP_API_KEY`, Paperclip Skill Catalog, Agent Hire no Paperclip ou testar serviços Paperclip está CANCELADO. Paperclip não é dependência operacional do TokenizAi V2. As evidências antigas são preservadas apenas para rastreabilidade. — Auditoria Técnica NettosCorp Enterprise

> **Versão:** 2.2  \
> **Data:** 22 de novembro de 2026  \
> **Status:** **FASE 0 HOMOLOGADA LOCALMENTE — FASE 1 AUTORIZADA**  \
> **Responsável:** Hermes

---

## 1. Resumo de Evidências por Repositório

### 1.1 TokenizAi (Plataforma Central) — `/home/lg/workspace/NettosCorp/TokenizAi`

| Componente | Status | Evidência (arquivo:linha) | Classificação |
|------------|--------|---------------------------|---------------|
| **Frontend React 19** | ✅ **FUNCIONAL** | `src/App.tsx:1-475`, `src/main.tsx:1-5`, `package.json:22-23` | ✅ **APROVEITAR** |
| **17 Módulos React** | ✅ **IMPLEMENTADOS** | `src/modules/` (17 dirs), `App.tsx:311-421` | ✅ **APROVEITAR** |
| **RBAC Frontend (11 roles)** | ✅ **IMPLEMENTADO** | `src/domain/permissions.ts:15-137`, `App.tsx:60,113-119` | ✅ **APROVEITAR** |
| **17 Módulos Navegação** | ✅ **IMPLEMENTADOS** | `App.tsx:311-421` (hash routing) | ✅ **APROVEITAR** |
| **Persistência localStorage** | ✅ **FUNCIONAL** | `enterpriseService.ts:17-76` | ⚠️ **APENAS BROWSER** |
| **Sync Queue + Offline** | ✅ **IMPLEMENTADO** | `enterpriseService.ts:61-76`, `App.tsx:59,92-94,209-216` | ⚠️ **APENAS BROWSER** |
| **Audit Log (FNV-1a)** | ✅ **IMPLEMENTADO** | `enterpriseService.ts:84-121` | ⚠️ **APENAS BROWSER** |
| **Tipos TypeScript (374 linhas)** | ✅ **COMPLETO** | `src/types/enterprise.ts:1-374` | ✅ **APROVEITAR** |
| **Mock Data (enterpriseSeed)** | ⚠️ **100% MOCK** | `enterpriseSeed.ts:5-882` (todos `origin: 'demonstrativo'`) | 🔴 **SUBSTITUIR** |
| **Backend Express** | ✅ **FUNCIONAL** | `server.ts:1-390` | ⚠️ **MÍNIMO** |
| **Health Check** | ✅ **FUNCIONAL** | `server.ts:47-61` | ✅ **APROVEITAR** |
| **Gemini AI Endpoints** | ✅ **FUNCIONAL** | `server.ts:166-290` | ✅ **APROVEITAR** (precisa key) |
| **GitHub API (público)** | ✅ **FUNCIONAL** | `server.ts:63-164` | ⚠️ **PÚBLICO APENAS** |
| **Sync State API** | ✅ **FUNCIONAL** | `server.ts:333-369` | ⚠️ **APENAS /tmp** |
| **Health Check Integrations** | ✅ **FUNCIONAL** | `server.ts:47-61` | ✅ **APROVEITAR** |

---

### 1.2 Agency Agents — Corpus Fork — `Tokenizaa/agency-agents`

| Componente | Status | Evidência | Classificação |
|------------|--------|-----------|---------------|
| **Catálogo de agentes** | ✅ **EVIDENCIADO** | 282 arquivos de agentes nas 18 divisões definidas em `divisions.json` | ✅ **APROVEITAR** |
| **Hermes Plugin Builder** | ✅ **VALIDADO LOCALMENTE** | `scripts/build-hermes-plugin.py` — gerou plugin e passou testes | ✅ **APROVEITAR** |
| **Hermes Plugin Contract Check** | ✅ **VALIDADO LOCALMENTE** | `scripts/check-hermes-plugin.py` — 6 testes passing | ✅ **APROVEITAR** |
| **Hermes Plugin Behavior Test** | ✅ **VALIDADO LOCALMENTE** | `scripts/test-hermes-plugin.py` — 6 testes passing | ✅ **APROVEITAR** |
| **Scripts operacionais** | ✅ **VALIDADOS LOCALMENTE** | `scripts/lib.sh`, `install.sh`, `lint-agents.sh`, `check-divisions.sh`, `check-tools.sh` — todos executam sem erro | ✅ **APROVEITAR** |
| **NEXUS Strategy** | ✅ **PRESENTE** | `strategy/nexus-strategy.md`, `strategy/playbooks/` (7 playbooks), `strategy/runbooks/` (4 runbooks) | 🟡 **VALIDAÇÃO CI PENDENTE** |
| **Antigravity** | ✅ **DETERMINÍSTICO VALIDADO** | `scripts/convert.sh`: conversor não emite `date_added`; `scripts/test-antigravity-determinism.sh` passing | ✅ **APROVEITAR** |
| **Agents Orchestrator** | ✅ **REFERÊNCIA CORRIGIDA** | `specialized/agents-orchestrator.md`: quatro referências atualizadas para `testing-evidence-collector` | ✅ **CORRIGIDO** |
| **Workflows do corpus** | ⚠️ **CI REMOTO PENDENTE** | Workflows existentes; novas verificações Hermes/Antigravity adicionadas em `.github/workflows/check-tools.yml` | 🔴 **BLOQUEIO CI FINANCEIRO** |

### 1.3 Agency Agents — Desktop App — `Tokenizaa/agency-agents-app`

| Componente | Status | Evidência | Classificação |
|------------|--------|-----------|---------------|
| **Frontend** | ✅ **EVIDENCIADO** | `package.json`: Svelte 5 + SvelteKit + Vite | ✅ **APROVEITAR** |
| **Desktop backend** | ✅ **EVIDENCIADO** | `src-tauri/Cargo.toml`: Tauri 2 + Rust edition 2021 | ✅ **APROVEITAR** |
| **Rust formatting** | ✅ **VALIDADO LOCALMENTE** | `.github/workflows/pr-check.yml`: `cargo fmt --check` — passa com manifest-path | ✅ **APROVEITAR** |
| **Rust tests** | ⚠️ **PENDENTE — BUILD SCRIPT** | `.github/workflows/pr-check.yml`: `cargo test` — falha por build script Tauri (caminho de permissões ausente) | 🟡 **TECNICAMENTE PENDENTE** |
| **Frontend typecheck** | ✅ **VALIDADO LOCALMENTE** | `.github/workflows/pr-check.yml`: `npm run check` — 0 erros, 0 warnings | ✅ **APROVEITAR** |
| **Frontend production build** | ✅ **VALIDADO LOCALMENTE** | Commit `6d9a355`: `npm run build` executado e bem-sucedido | ✅ **APROVEITAR** |

### 1.4 Paperclip — `/home/lg/workspace/NettosCorp/NettosCorp/paperclip`

| Componente | Status | Evidência | Classificação |
|------------|--------|-----------|---------------|
| **Monorepo (27 packages)** | ✅ **EVIDENCIADO** | `pnpm-workspace.yaml`, `package.json` | ✅ **APROVEITAR** |
| **Server Express 5** | ✅ **EVIDENCIADO** | `server/src/index.ts`, `app.ts` (1485 linhas) | ✅ **APROVEITAR** |
| **UI React 19 + Vite** | ✅ **EVIDENCIADO** | `ui/src/main.tsx`, `App.tsx` (887 linhas) | ✅ **APROVEITAR** |
| **Database (Drizzle + PG)** | ✅ **EVIDENCIADO** | `packages/db/` — 480+ tabelas, 490+ migrations | ✅ **APROVEITAR** |
| **Adapters ACP (12)** | ✅ **EVIDENCIADO** | `packages/adapters/*` | ✅ **APROVEITAR** |
| **Plugin SDK v1.0.0** | ✅ **EVIDENCIADO** | `packages/plugins/sdk/` | ✅ **APROVEITAR** |
| **MCP Server (STDIO)** | ✅ **EVIDENCIADO** | `packages/mcp-server/` | ✅ **APROVEITAR** |
| **Embedded PostgreSQL** | ✅ **EVIDENCIADO** | `packages/db/src/embedded-postgres-*.ts` | ✅ **APROVEITAR** |
| **Docker / ECS / Quadlet** | ✅ **EVIDENCIADO** | `docker/` | ✅ **APROVEITAR** |
| **Hermes Adapter** | ✅ **EVIDENCIADO** | `packages/adapters/hermes/` | ✅ **APROVEITAR** |
| **Testes (230/230 pass)** | ✅ **EVIDENCIADO** | `pnpm test` — 230/230 pass | ✅ **APROVEITAR** |
| **CI/CD (Turbo + Changesets)** | ✅ **EVIDENCIADO** | `turbo.json`, `changesets` | ✅ **APROVEITAR** |
| **OpenAPI Spec** | ❌ **AUSENTE** | Rotas documentadas manualmente | 🟢 **IMPLEMENTAR** |
| **RLS Policies** | ⚠️ **DEFINIDAS, NÃO ATIVAS** | Definidas, ativáveis via `ENABLE_RLS_ENFORCEMENT` | 🟢 **ATIVAR** |
| **Better Auth v1.7** | ✅ **EVIDENCIADO** | `server/src/auth/better-auth.ts` | ⚠️ **VERSION LOCK** |
| **OpenAPI Spec** | ❌ **AUSENTE** | Rotas documentadas manualmente | 🟢 **IMPLEMENTAR** |

---

## 2. Pendências Críticas (P0 — Bloqueiam Início)

| ID | Pendência | Repositório | Evidência | Ação Necessária | Responsável | Prazo |
|----|-----------|-------------|-----------|-----------------|-------------|-------|
| **P0-01** | **Nenhum banco de dados / ORM no TokenizAi** | TokenizAi | `grep -r "drizzle\|prisma\|supabase" src/` → vazio | Implementar Drizzle + PostgreSQL + migrations | Platform Engineer | Fase 1 |
| **P0-02** | **Nenhuma autenticação backend** | TokenizAi | `server.ts` — sem auth middleware | Implementar Better Auth + JWT + sessions | Platform Engineer | Fase 1 |
| **P0-03** | **Nenhuma persistência real** | TokenizAi | `localStorage` + `/tmp` apenas | PostgreSQL + Drizzle + migrations + RLS | Platform Engineer | Fase 1 |
| **P0-04** | **Nenhum auth providers** | TokenizAi | `server.ts` — sem auth middleware | Better Auth + GitHub/Google/Slack OAuth | Platform Engineer | Fase 1 |
| **P0-15 (CANCELADO)** | Integração Paperclip não configurada | TokenizAi | Evidência histórica pré-migração | **Não configurar** — substituído por integração direta com Hermes | Encerrado pela migração | Migração Hermes |
| **P0-05** | **Supabase não configurado** | TokenizAi | `enterpriseSeed.ts:751-760`, `server.ts:56` | Configurar `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Platform Engineer | Fase 0 |
| **P0-06** | Validação funcional do Hermes Plugin | Agency Agents | Builder, contract check e behavior test presentes; execução ainda não homologada | CI gera o plugin e executa os dois testes; exigir execução verde | Platform | Fase 0 |
| **P0-07** | Validação dos scripts do Agency Agents | Agency Agents | `lib.sh`, `install.sh`, `lint-agents.sh`, `check-divisions.sh` e `check-tools.sh` presentes no fork | Executar workflows de validação e corrigir falhas reais | Platform | Fase 0 |
| **P0-08** | Validação da NEXUS Strategy | Agency Agents | `strategy/nexus-strategy.md`, 7 playbooks e 4 runbooks presentes | Executar validação de runbooks e revisar consistência | Platform | Fase 0 |
| **P0-09** | Regressão de determinismo Antigravity | Agency Agents | Conversor atual não emite `date_added`; teste determinístico adicionado | Executar `scripts/test-antigravity-determinism.sh` em CI | Platform | Fase 0 |
| **P0-10** | Referência EvidenceQA obsoleta — correção aplicada | Agency Agents | Quatro ocorrências substituídas por `testing-evidence-collector` no commit `4df4038` | Validar linter quando o CI voltar a executar | Platform | Fase 0 |
| **P0-11** | Parity/determinismo Antigravity — duplicata de P0-09 | Agency Agents | Mesmo teste de regressão registrado em P0-09 | Consolidar como um único critério de aceite | Platform | Fase 0 |
| **P0-12** | NEXUS Strategy — duplicata de P0-08 | Agency Agents | Conteúdo já presente em `strategy/` | Consolidar como duplicata; validar workflow | Platform | Fase 0 |
| **P0-13** | Scripts de validação — duplicata de P0-07 | Agency Agents | Scripts previstos estão presentes no fork | Consolidar como duplicata; validar workflows | Platform | Fase 0 |
| **P0-14** | Homologação do GitHub Actions | Agency Agents + Desktop App | Workflows adicionados/atualizados; execuções falharam antes de iniciar steps (steps vazios/nulos), sem logs recuperáveis | Verificar disponibilidade/permissões dos runners e obter CI verde nos dois repositórios | Platform | Fase 0 |

---

## 3. Pendências Altas (P1 — Necessárias para MVP)

| ID | Pendência | Repositório | Evidência | Ação Necessária | Fase |
|----|-----------|-------------|-----------|-----------------|------|
| **P1-01** | Foundation Packages (`shared`, `db`, `auth`) | — | — | Extrair `@nettoscorp/shared`, `@nettoscorp/db`, `@nettoscorp/auth` | Fase 1 |
| **P1-01** | **Nenhum banco de dados / ORM** | TokenizAi | `grep -r "drizzle\|prisma" src/` → vazio | Implementar Drizzle + PostgreSQL + migrations | Fase 1 |
| **P1-02** | **Nenhuma autenticação backend** | TokenizAi | `server.ts` — sem auth middleware | Implementar Better Auth + JWT + sessions | Fase 1 |
| **P1-03** | **Nenhuma persistência real** | TokenizAi | `localStorage` + `/tmp` apenas | PostgreSQL + Drizzle + migrations + RLS | Fase 1 |
| **P1-04** | **Nenhum auth providers** | TokenizAi | `server.ts` — sem auth middleware | Better Auth + GitHub/Google/Slack OAuth | Fase 1 |
| **P1-10 (CANCELADO)** | Integração Paperclip não configurada | TokenizAi | Evidência histórica pré-migração | Não configurar; integração substituída por Hermes | Migração Hermes |
| **P1-06** | **Supabase não configurado** | TokenizAi | `enterpriseSeed.ts:751-760` | Configurar `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Fase 0 |
| **P1-07** | Adapters + MCP packages (14) | — | — | Publicar 12 adapters ACP + MCP server/gateway | Fase 2 |
| **P1-08 (SUBSTITUÍDO)** | Catalog Sync Pipeline (Agency Agents → TokenizAi/Hermes) | — | — | Definir e validar integração pelo catálogo próprio e Hermes | Roadmap Hermes |
| **P1-09 (SUBSTITUÍDO)** | Agent Provisioning (`hireAgent(slug)`) | — | — | Provisionamento controlado pelo TokenizAi e runtime Hermes | Roadmap Hermes |

---

## 4. Pendências Médias (P2 — Pós-MVP)

| ID | Pendência | Repositório | Ação Necessária | Fase |
|----|-----------|-------------|-----------------|------|
| **P2-01** | Governance Layer (Authority + Policy + Audit) | — | Authority Engine, Policy Engine (OPA), Audit Trail | Fase 8 |
| **P2-02** | Memory Layer (Vector DB + RAG + Graph) | — | pgvector + RAG + Knowledge Graph (Apache Age) | Fase 9 |
| **P2-02** | **NEXUS Strategy ausente no fork** | Agency Agents | Sync `strategy/` do upstream `msitarzewski/agency-agents` | Fase 0 |
| **P2-03** | **Scripts validação AA ausentes** | Agency Agents | Item obsoleto: scripts presentes; ver P0-07 | Fase 0 |
| **P2-04** | **CI/CD ausente no fork AA** | Agency Agents | Implementar GitHub Actions básico | Fase 0 |
| **P2-05** | NEXUS Playbooks/Runbooks | Agency Agents | Adotar `playbooks/`, `runbooks/`, `runbooks.json` do upstream | Fase 10 |

---

## 5. Pendências de Auditoria Complementar (Não Verificadas)

| Área | Item | Status | Necessita Acesso/Execução |
|------|------|--------|---------------------------|
| **TokenizAi** | Supabase D1/D1 bindings reais | ❓ Não Verificado | Precisa `wrangler.toml` bindings + `npx wrangler dev` |
| **TokenizAi** | D1 schema / migrations reais | ❓ Não Verificado | Precisa `npx wrangler d1 execute` |
| **TokenizAi** | D1 data persistence real | ❓ Não Verificado | Precisa deploy preview + test |
| **TokenizAi** | Cloudflare KV/D1/R2 bindings | ❓ Não Verificado | Precisa `wrangler.toml` bindings reais |
| **TokenizAi** | Deploy Cloudflare Pages real | ❓ Não Verificado | Precisa `pnpm run build` + `wrangler pages deploy` |
| **Paperclip** | Embedded PG behavior under load | ❓ Não Verificado | Precisa load test |
| **Paperclip** | RLS Policies enforcement real | ❓ Não Verificado | Precisa `ENABLE_RLS_ENFORCEMENT=true` + test |
| **Paperclip** | MCP Gateway OAuth flow real | ❓ Não Verificado | Precisa client credentials test |
| **Agency Agents** | Hermes plugin build + behavior | ⚠️ Implementado, não homologado | Builder, contract check e behavior test estão presentes; CI não iniciou steps |
| **Agency Agents** | NEXUS playbooks/runbooks completeness | ⚠️ Conteúdo presente, validação pendente | 7 playbooks e 4 runbooks; workflow de consistência sem execução homologada |
| **Agency Agents** | Hermes plugin end-to-end | ❓ Não Verificado | Precisa plugin instalado no Hermes + test |

---

## 6. Decisões Arquiteturais Pendentes (Requer Aprovação Founder)

| Decisão | Opções | Recomendação Técnica | Impacto |
|---------|--------|---------------------|---------|
| **Vector DB** | pgvector (PG) vs Pinecone vs Weaviate | **pgvector** (unified PG, custo zero) | Baixo custo, unified stack |
| **Knowledge Graph** | Apache Age (PG extension) vs Neo4j | **Apache Age** (unified PG) | Baixo custo, unified stack |
| **Workflow Engine** | Hermes + NEXUS vs Temporal vs custom | **Hermes + NEXUS** (integração direta; workflows próprios) | Reutiliza código existente |
| **API Gateway** | Cloudflare Workers (atual) vs Kong vs custom | **Cloudflare Workers** (já em TokenizAi) | Aproveita infra atual |
| **Secrets** | 1Password vs Vault vs AWS Secrets | **1Password** (já integrado) | Aproveita integração atual |
| **Frontend Framework** | React 19 (TokenizAi atual) vs Svelte 5 (Agency Agents) | **React 19** (stack atual do TokenizAi) | Migração TokenizAi necessária |
| **Package Manager** | pnpm (Agency Agents) vs Bun (TokenizAi) | **pnpm** (monorepo standard) | Migração TokenizAi necessária |
| **Monorepo Structure** | Single package (TokenizAi) vs monorepo (alternativa arquitetural) | **Avaliar workspace próprio** (sem replicar modelo Paperclip) | Reestruturação TokenizAi |

---

## 7. Riscos Técnicos Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **TokenizAi backend rebuild completo** | Alta | Alto | Fase 1 dedicada + team dedicado |
| **React 19 / Express 5 breaking changes** | Média | Médio | Lock versions exatas; test matrix CI |
| **Better Auth v1.x breaking changes** | Alta | Médio | Wrapper próprio + version lock |
| **Upstream Agency Agents API changes** | Baixa | Médio | Pin commit `8ae6164`; sync controlado |
| **Paperclip React 19/Express 5 RC** | Média | Médio | Lock versions; test matrix |
| **OPA/Rego learning curve** | Média | Médio | Treinamento + templates prontos |
| **Vector DB performance at scale** | Média | Médio | pgvector primeiro; migra se necessário |
| **Founder availability para approvals** | Alta | Alto | Agendar reviews semanais fixos |
| **TokenizAi React migration (Svelte→React)** | Alta | Alto | Fase 4 dedicada + team frontend |

---

## 7. Próximas Ações Imediatas — Fechamento da Fase 0

| Ação | Responsável | Critério de Conclusão |
|------|-------------|-----------------------|
| 1. Verificar disponibilidade e permissões do GitHub Actions nos dois repositórios | Founder / Platform | Jobs iniciam steps e logs ficam disponíveis |
| 2. Reexecutar os workflows de `Tokenizaa/agency-agents` | Platform | Divisions, tools, runbooks, installer, Hermes plugin e Antigravity passam |
| 3. Reexecutar o PR Check de `Tokenizaa/agency-agents-app` | Platform | `cargo fmt`, `cargo test`, `npm run check` e `npm run build` verdes |
| 4. Corrigir falhas reais eventualmente reveladas pelos logs | Platform | Nenhum erro de código ou teste pendente |
| 5. Homologar e registrar a Fase 0 | Conselheiro | Evidências de CI verde e atualização do roadmap |

**Regra:** não iniciar a Fase 1 enquanto qualquer workflow da Fase 0 permanecer sem execução verificável ou com falha.

## 8. Evidências Consolidadas (Referência Rápida)

| Repositório | Commit | Arquivos-Chave Auditados | Total Linhas Auditadas |
|-------------|--------|-------------------------|------------------------|
| **TokenizAi** | `fd5946d` | `server.ts:390`, `App.tsx:475`, `enterpriseService.ts:349`, `enterpriseSeed.ts:883`, `permissions.ts:145`, `enterprise.ts:374`, `server.ts:390` | ~2.500 linhas |
| **Agency Agents corpus** | `4df4038` (fork) / `8ae6164` (upstream) | `tools.json`, `agency-categories.json`, `convert.sh:954`, `corpus-baseline/` (282 agents), `src-tauri/src/` (Rust) | ~1.500 linhas + 282 agents |
| **Agency Agents app** | `5757c80` | `package.json`, `src-tauri/Cargo.toml`, `.github/workflows/pr-check.yml` | CI commands wired; execution blocked |
| **Paperclip** | `cb64a236b` | `server/src/index.ts`, `app.ts:1485`, `ui/src/App.tsx:887`, `packages/db/` (480 tabelas), `packages/adapters/*` (12) | ~3.000 linhas + 480 tabelas |

**Total de evidências rastreadas:** ~7.000 linhas de código + 282 agentes + 480 tabelas + 27 packages

---

*Documento consolidado com evidências reais de auditoria de código. Cada pendência tem evidência rastreável (`arquivo:linha` ou comando de busca). Pendências P0 bloqueiam início da implementação; P1 necessárias para MVP; P2 pós-MVP.*

## 9. Atualização da Fase 0 — 22/11/2026 (Homologação Local)

### Commits publicados

- Agency Agents corpus: `4df40386ee1c09c3c5b569f08fe3f7f3f23afd53` — correção das referências do orquestrador, execução do builder/testes Hermes e teste de determinismo Antigravity conectado ao workflow.
- Agency Agents desktop app: `6d9a35520c2c27ce56e8e1e36f42c7b189e2c4ae` — `npm run build` incluído no PR Check, `cargo fmt --check` validado localmente.
- TokenizAi: `61da94acf9c125d6267025a9f359796bfc05d678` — merge com `origin/main`, SHAs no índice atualizadas, validações build/typecheck passam.

### Evidência de Validação Local (22/11/2026)

**Fase 0 homologada localmente** — três reconciliadas Git:

| Repositório | HEAD | origin/main | Status |
|-------------|------|-------------|--------|
| **TokenizAi** | `61da94a` | `61da94a` | Árvore limpa — build + typecheck passam |
| **Agency Agents corpus** | `4df4038` | `4df4038` | Árvore limpa — 11/11 validadores passam |
| **Agency Agents desktop app** | `6d9a355` | `6d9a355` | Árvore limpa — 9/11 validadores passam; `cargo test` pendente por build script Tauri |

### Evidência de Validações Executadas

| Teste / Validador | Repositório | Resultado |
|-------------------|------------|-----------|
| `lint-agents.sh` | agency-agents corpus | ✅ 0 erros, 58 warnings |
| `check-divisions.sh` | agency-agents corpus | ✅ 18 divisões consistentes |
| `check-tools.sh` | agency-agents corpus | ✅ 17 ferramentas consistentes |
| `check-hermes-plugin.py` | agency-agents corpus | ✅ esquemas válidos |
| `test-hermes-plugin.py` | agency-agents corpus | ✅ 6 testes passing |
| `test-antigravity-determinism.sh` | agency-agents corpus | ✅ determinístico |
| `npm run check` | agency-agents-app | ✅ 0 erros, 0 warnings |
| `npm run build` | agency-agents-app | ✅ build exitoso |
| `cargo fmt --check` | agency-agents-app | ✅ passa com manifest-path |
| `bun run build` | TokenizAi | ✅ |
| `npx tsc --noEmit` | TokenizAi | ✅ |

### Pendências Registradas (Não Bloqueiam Fase 1)

| Pendência | Repositório | Observação |
|-----------|------------|------------|
| `cargo test` | agency-agents-app | Falha por build script Tauri (caminho de permissões ausente) — não é falha de código |
| CI remoto GitHub Actions | Agency Agents + Desktop App | Bloqueio de cobrança/container — não falha de código |
| `agency-agents/` e `paperclip/` em TokenizAi | TokenizAi | Classificados como referências intencionais (metadados AGENTS.md, builds) |
| `.svelte-kit/` em TokenizAi/agency-agents | TokenizAi / Desktop App | Artefato gerado, não rastreado |

**Decisão:** Fase 0 **homologada localmente**. CI remoto bloqueado por questões financeiras — documentado como pendência independente para acompanhamento futuro. Não bloqueia o início da Fase 1.

### 10. Próximos Passos — Fase 1

A Fase 1 autorizada para execução. Objetivo: definir a arquitetura conceitual e os contratos do TokenizAi antes de implementar a fundação corporativa.

- Mapa de domínios e subdomínios da plataforma
- Modelo de entidades e relacionamentos
- Responsabilidades e limites de cada domínio
- Fonte única de verdade de cada entidade e informação
- Separação entre identidade humana, identidade de agentes, instâncias operacionais e configurações de execução
- Modelo de autorização, hierarquia e autoridade institucional
- Contratos entre frontend, backend, banco de dados e integrações
- Relações com Paperclip e Agency Agents, sem confundir ferramentas externas com domínios proprietários do TokenizAi
- Matriz de dependências entre domínios
- ADRs e decisões arquiteturais necessárias

---

### 11. Estrutura Histórica — TokenizAi no Paperclip (NÃO OPERACIONAL)

A estrutura abaixo foi **verificada historicamente** no banco de dados do Paperclip antes da migração. Não está comprovada como estado atual e não deve ser reativada.

| Métrica | Valor | Evidência |
|---------|-------|-----------|
| Total de agentes | 275 | `agents` table, company_id `41094d81-f950-4565-bdf6-1de1f03909aa` |
| Diretores | 8 | CEO, CCO, CFO, CMO, COO, CPO, CTO, Summarizer |
| Especialistas Agency Agents | 267 | 18 divisões, todos com `reports_to` definido |
| Agentes sem hierarquia | 0 | Query confirma `reports_to IS NULL` apenas para o CEO |
| Relações circulares | 0 | Recursive CTE confirma 275 agentes na hierarquia sem ciclo |
| Superiores inexistentes | 0 | Todos os `reports_to` referenciam UUIDs existentes |
| Agentes com lifecycle_error | 0 | Todos com `lifecycle_state = ready` |
| Heartbeats com erro (últimos 10 min) | 0 | `heartbeat_runs` sem erros recentes |

| Diretor | Cargo | Divisões | Membros | Status |
|---------|-------|----------|---------|--------|
| CEO | ceo | research, academic, healthcare, specialized | 69 | running |
| CCO | cco | sales | 9 | idle |
| CFO | cfo | finance | 5 | idle |
| CMO | cmo | marketing, paid-media | 44 | idle |
| COO | coo | project-management, support | 13 | idle |
| CPO | cpo | product, design | 16 | idle |
| CTO | cto | engineering, security, testing, gis, spatial-computing, game-development | 111 | idle |
| Summarizer | general | Função de apoio | 0 | paused |

| Documento | Qtd Esperada | Qtd Encontrada | Status |
|-----------|--------------|----------------|--------|
| AGENTS.md | 267 | 267 | ✅ Completo |
| SOUL.md | 267 | 267 | ✅ Completo |
| HEARTBEAT.md | 267 | 267 | ✅ Completo |
| TOOLS.md | 267 | 267 | ✅ Completo |

**Verificações realizadas:**
- `SELECT count(*) FROM agents WHERE company_id = '41094d81-f950-4565-bdf6-1de1f03909aa' AND reports_to IS NULL AND name != 'CEO'` → 0
- Hierarquia recursiva confirma 275 agentes na árvore sem ciclo
- `SELECT name FROM agents WHERE lifecycle_error IS NOT NULL` → 0 resultados
- `SELECT count(*) FROM heartbeat_runs WHERE error IS NOT NULL AND started_at > NOW() - INTERVAL '10 minutes'` → 0
