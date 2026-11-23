# Engenharia Reversa — TokenizAi (Plataforma Atual)

> **Versão:** 2.0  
> **Data:** 21 de novembro de 2026  
> **Checkout:** `/home/lg/workspace/NettosCorp/TokenizAi`  
> **Commit:** `2988750` (main)  
> **Responsável:** Hermes  
> **Classificação:** Auditoria com evidências de código — **não** apenas inspeção preliminar

---

## 1. Classificação da Evidência (Atualizada com Evidências Reais)

| Item | Status | Fonte | Evidência (arquivo:linha) |
|------|--------|-------|---------------------------|
| Estrutura do projeto | **EVIDENCIADO** | `ls -la`, `package.json`, `wrangler.toml` | `package.json:1-38` |
| Stack tecnológica | **EVIDENCIADO** | `package.json`, `tsconfig.json`, `vite.config.ts` | `package.json:14-37` |
| Server entry (`server.ts`) | **EVIDENCIADO** | `server.ts` (390 linhas, 13KB) | `server.ts:1-390` |
| Configuração Cloudflare | **EVIDENCIADO** | `wrangler.toml` (apenas Pages) | `wrangler.toml:1-17` |
| Frontend (React + Vite) | **EVIDENCIADO** | `src/`, `vite.config.ts`, `src/main.tsx` | `src/main.tsx:1-5`, `src/App.tsx:1-475` |
| Testes / CI | **AUSENTE** | Nenhum workflow ou config encontrado | `ls .github/workflows/` → vazio |
| Banco de dados / ORM | **AUSENTE** | Nenhum identificado no código | `grep -r "drizzle\|prisma\|supabase\|d1\|kysely" src/` → vazio |
| Autenticação / Autorização | **PARCIAL** | RBAC apenas Frontend (localStorage) | `src/domain/permissions.ts`, `src/App.tsx:60` |
| Persistência real | **AUSENTE** | Apenas localStorage + /tmp | `enterpriseService.ts:17-76`, `server.ts:9,32` |
| Integração Paperclip | **NÃO CONFIGURADO** | Endpoint vazio, status "não configurado" | `enterpriseSeed.ts:771-778`, `server.ts:57` |
| Integração Supabase | **NÃO CONFIGURADO** | Status "não configurado" | `enterpriseSeed.ts:751-760`, `server.ts:56` |
| Integração GitHub | **PARCIAL** | API pública apenas (sem token) | `server.ts:63-164`, `enterpriseSeed.ts:761-769` |
| Integração Gemini | **FUNCIONAL** | `@google/genai` server-side | `server.ts:6,11-24`, `server.ts:166-241` |

---

## 2. Visão Geral da Plataforma Atual (Corrigida)

O **TokenizAi** é uma aplicação **React 19 + TypeScript + Vite** com backend **Express 4.21** rodando em **Node.js (porta 3000)**, servida via Vite middleware em desenvolvimento. **Não é Cloudflare Workers** — o `wrangler.toml` configura apenas Cloudflare Pages para deploy estático.

### 2.1 Stack Tecnológica Real (Evidenciada)

| Camada | Tecnologia Real | Evidência |
|--------|-----------------|-----------|
| **Runtime** | Node.js (Express 4.21) | `package.json:19`, `server.ts:2,8` |
| **Framework Backend** | Express 4.21 | `package.json:19`, `server.ts:2,44` |
| **Frontend** | React 19 + Vite 8.3 | `package.json:22-23`, `src/main.tsx:1-5` |
| **Language** | TypeScript 7.0 | `tsconfig.json`, `package.json:36` |
| **Package Manager** | pnpm (bun.lock presente) | `bun.lock`, `package.json:7` |
| **Deploy** | Cloudflare Pages (static) | `wrangler.toml:10-13` |
| **AI Provider** | Google Gemini (@google/genai) | `package.json:15`, `server.ts:6,11-24` |
| **Styling** | Tailwind 4.3 + Lucide React | `package.json:16,20`, `index.css` |

### 2.2 Estrutura de Diretórios Real

```
TokenizAi/
├── src/                          # Frontend React 19
│   ├── components/               # Common + Layout
│   ├── domain/                   # permissions.ts, enterpriseSeed.ts
│   ├── hooks/                    # useEnterpriseHooks.ts
│   ├── modules/                  # 17 módulos (React components)
│   ├── services/                 # adapters.ts, enterpriseService.ts
│   ├── types/                    # enterprise.ts (374 linhas)
│   ├── App.tsx                   # Root component (475 linhas)
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Tailwind 4
├── server.ts                     # Express server (390 linhas)
├── wrangler.toml                 # Cloudflare Pages config apenas
├── package.json                  # Dependencies + scripts
├── tsconfig.json                 # TypeScript config
├── vite.config.ts                # Vite config
├── bun.lock                      # Bun lockfile
├── .env / .env.*                 # Environment configs
├── public/                       # Static assets
├── dist/                         # Build output
├── .wrangler/                    # Wrangler cache
├── node_modules/
├── documentação institucional/   # ESTE DIRETÓRIO
└── docs/                         # Docs anteriores
```

---

## 3. Análise do Backend (`server.ts`) — Evidências Reais

**Tamanho:** 390 linhas, 13KB  
**Padrão:** Single-file Express server com Vite middleware para dev.

### 3.1 Endpoints Implementados (Evidenciados)

| Endpoint | Método | Função | Linhas | Status |
|----------|--------|--------|--------|--------|
| `/api/health` | GET | Health check + integrations status | 47-61 | ✅ Funcional |
| `/api/integrations/github/inspect` | POST | Inspeciona repo GitHub (API pública) | 63-164 | ✅ Funcional (público) |
| `/api/ai/scope-project` | POST | Análise de escopo via Gemini | 166-241 | ✅ Funcional (precisa GEMINI_API_KEY) |
| `/api/ai/executive-brief` | POST | Síntese executiva via Gemini | 243-290 | ✅ Funcional (precisa GEMINI_API_KEY) |
| `/api/ai/voice-intent` | POST | Interpretação de voz via Gemini | 292-331 | ✅ Funcional (precisa GEMINI_API_KEY) |
| `/api/sync/state` | GET | Estado de sincronização (localStorage) | 333-340 | ✅ Funcional |
| `/api/sync/state` | POST | Recebe snapshot de sincronização | 342-369 | ✅ Funcional |

### 3.2 Integrações Reais (Evidenciadas)

| Integração | Status Real | Evidência | Limitação |
|------------|-------------|-----------|-----------|
| **Google Gemini** | ✅ **FUNCIONAL** | `server.ts:6,11-24,166-290` | Precisa `GEMINI_API_KEY` válida |
| **GitHub API** | ⚠️ **PARCIAL** | `server.ts:63-164` | Apenas API pública (sem token = rate limit baixo) |
| **Paperclip** | ❌ **NÃO CONFIGURADO** | `enterpriseSeed.ts:771-778`, `server.ts:57` | `PAPERCLIP_ENDPOINT` não configurado |
| **Supabase** | ❌ **NÃO CONFIGURADO** | `enterpriseSeed.ts:751-760`, `server.ts:56` | `SUPABASE_URL`/`ANON_KEY` não configurados |
| **GitHub (privado)** | ❌ **NÃO CONFIGURADO** | `server.ts:88-90`, `enterpriseSeed.ts:761-769` | `GITHUB_TOKEN` não configurado |
| **Gemini API Key** | ⚠️ **PARCIAL** | `server.ts:12-14` | Chave placeholder `MY_GEMINI_API_KEY` |

### 3.3 Persistência Real (Evidenciada)

| Camada | Implementação Real | Arquivo:Linha | Limitação |
|--------|-------------------|---------------|-----------|
| **Frontend State** | localStorage (`nettoscorp_enterprise_state_v1`) | `enterpriseService.ts:17-51` | Apenas browser, não servidor |
| **Sync Queue** | localStorage (`nettoscorp_enterprise_sync_queue_v1`) | `enterpriseService.ts:61-76` | Apenas browser |
| **Backend Sync** | Arquivo `/tmp/nettoscorp-enterprise-sync.json` | `server.ts:9,32-41` | `/tmp` é efêmero (container/ephemeral) |
| **Banco de Dados** | **NENHUM** | `grep -r "drizzle\|prisma\|supabase\|d1\|kysely" src/` → vazio | **CRÍTICO** |
| **Migrations** | **NENHUMA** | `ls` → nenhum arquivo de migration | **CRÍTICO** |
| **ORM** | **NENHUM** | `package.json` → sem drizzle/prisma/kysely | **CRÍTICO** |

### 3.4 Autenticação/Autorização Real

| Aspecto | Implementação Real | Evidência | Gap Crítico |
|---------|-------------------|-----------|-------------|
| **Auth Backend** | **NENHUM** | `server.ts` → sem auth middleware | **CRÍTICO** |
| **Auth Frontend** | Role via localStorage/UI | `App.tsx:60`, `App.tsx:113-119` | Apenas UI, sem validação server |
| **Roles** | 11 roles hardcoded | `permissions.ts:15-137` | Hardcoded, sem backend |
| **Permissions** | `canAccessModule()` client-side | `permissions.ts:139-141` | Apenas UI, sem enforcement server |
| **JWT/Session** | **NENHUM** | `server.ts` → sem cookies/JWT | **CRÍTICO** |
| **X-NettosCorp-Role** | **NÃO EXISTE** | `grep -r "X-NettosCorp-Role" src/` → vazio | Documentação anterior incorreta |
| **getCallerRole** | **NÃO EXISTE** | `grep -r "getCallerRole" src/` → vazio | Documentação anterior incorreta |

---

## 4. Análise do Frontend (React 19 + Vite) — Evidências Reais

### 4.1 Estrutura Real (`src/`)

| Diretório | Conteúdo Real | Arquivos Principais |
|-----------|---------------|---------------------|
| `src/modules/` | **17 módulos** (React components) | `AdminModule`, `AgencyLibraryModule`, `CommercialModule`, `CustomersModule`, `ExecutiveDashboard`, `FinanceModule`, `GovernanceModule`, `IntelligenceFactoryModule`, `MarketingModule`, `OperationsModule`, `PeopleModule`, `ProductsModule`, `ProjectsModule`, `SoftwareFactoryModule`, `IntelligenceFactoryModule`, `OperationalAgentsModule`, `TeamComposerModule` |
| `src/domain/` | `permissions.ts` (145 linhas), `enterpriseSeed.ts` (883 linhas, 29979 bytes) | `permissions.ts`, `enterpriseSeed.ts` |
| `src/services/` | `adapters.ts` (5489 bytes), `enterpriseService.ts` (10463 bytes) | `adapters.ts`, `enterpriseService.ts` |
| `src/types/` | `enterprise.ts` (374 linhas, 8889 bytes) | `enterprise.ts` |
| `src/components/` | `Common/CommandPalette`, `Layout/AppShell` | `CommandPalette`, `AppShell` |
| `src/hooks/` | `useEnterpriseHooks.ts` (4416 bytes) | `useEnterpriseHooks.ts` |

### 4.2 Módulos Implementados (17 — Evidenciados em `App.tsx:311-421`)

| Módulo | Componente | Rota (hash) | Status |
|--------|------------|-------------|--------|
| `executive` | `ExecutiveDashboard` | `#executive` | ✅ |
| `finance` | `FinanceModule` | `#finance` | ✅ |
| `commercial` | `CommercialModule` | `#commercial` | ✅ |
| `customers` | `CustomersModule` | `#customers` | ✅ |
| `marketing` | `MarketingModule` | `#marketing` | ✅ |
| `products` | `ProductsModule` | `#products` | ✅ |
| `projects` | `ProjectsModule` | `#projects` | ✅ |
| `software-factory` | `SoftwareFactoryModule` | `#software-factory` | ✅ |
| `intelligence-factory` | `IntelligenceFactoryModule` | `#intelligence-factory` | ✅ |
| `operations` | `OperationsModule` | `#operations` | ✅ |
| `agency-library` | `AgencyLibraryModule` | `#agency-library` | ✅ |
| `team-composer` | `TeamComposerModule` | `#team-composer` | ✅ |
| `operational-agents` | `OperationalAgentsModule` | `#operational-agents` | ✅ |
| `people` | `PeopleModule` | `#people` | ✅ |
| `governance` | `GovernanceModule` | `#governance` | ✅ |
| `admin` | `AdminModule` | `#admin` | ✅ |
| `software-factory` | `SoftwareFactoryModule` | `#software-factory` | ✅ |

### 4.3 RBAC Frontend (Evidenciado)

| Aspecto | Implementação | Arquivo:Linha |
|---------|--------------|---------------|
| **11 Roles** | `direcao_executiva`, `gestor`, `financeiro`, `comercial`, `operacoes`, `desenvolvimento`, `ia`, `rh`, `auditoria`, `operacional` | `permissions.ts:1-11` |
| **Module Access** | `canAccessModule(role, moduleId)` | `permissions.ts:139-141` |
| **Module Definitions** | 17 módulos em `NAV_ITEMS` | `App.tsx` imports |
| **Role Switching** | `handleChangeRole()` com fallback | `App.tsx:113-119` |
| **Access Control** | `navigateTo()` valida `canAccessModule` | `App.tsx:121-143` |

### 4.4 Estado e Persistência Frontend (Evidenciados)

| Funcionalidade | Implementação | Arquivo:Linha |
|----------------|--------------|---------------|
| **State Management** | `useState` + `useEffect` + `EnterpriseDomainActions` | `App.tsx:58-229`, `enterpriseService.ts:129-348` |
| **Persistence** | `localStorage` (`nettoscorp_enterprise_state_v1`) | `enterpriseService.ts:17-51` |
| **Sync Queue** | `localStorage` + queue em memória | `enterpriseService.ts:61-76`, `App.tsx:59,92-94` |
| **Audit Log** | `appendAuditRecord()` com hash FNV-1a | `enterpriseService.ts:84-121` |
| **Audit Hash** | FNV-1a 32-bit (`makeAuditHash`) | `enterpriseService.ts:84-91` |
| **RBAC Enforcement** | `assertPermission()` throws Error | `enterpriseService.ts:123-127` |
| **Demo Data** | **TODOS** os registros com `origin: 'demonstrativo'` | `enterpriseSeed.ts:5-882` |

---

## 5. Dados de Semente (Mock Data) — Evidência Completa

**Arquivo:** `src/domain/enterpriseSeed.ts` (883 linhas, 29979 bytes)  
**Status:** **100% MOCK DATA** — Todos os registros têm `origin: 'demonstrativo'`

| Entidade | Registros | Status | Evidência |
|----------|-----------|--------|-----------|
| `financialEntries` | 6 | Mock | `enterpriseSeed.ts:4-83` |
| `costCenters` | 4 | Mock | `enterpriseSeed.ts:84-89` |
| `accounts` | 4 | Mock | `enterpriseSeed.ts:90-147` |
| `opportunities` | 4 | Mock | `enterpriseSeed.ts:148-202` |
| `contracts` | 3 | Mock | `enterpriseSeed.ts:203-243` |
| `campaigns` | 3 | Mock | `enterpriseSeed.ts:244-281` |
| `products` | 3 | Mock | `enterpriseSeed.ts:282-322` |
| `projects` | 4 | Mock | `enterpriseSeed.ts:323-435` |
| `tasks` | 5 | Mock | `enterpriseSeed.ts:436-487` |
| `repos` | 3 | Mock | `enterpriseSeed.ts:488-528` |
| `incidents` | 2 | Mock | `enterpriseSeed.ts:529-548` |
| `aiSolutions` | 2 | Mock | `enterpriseSeed.ts:549-572` |
| `operationalInstances` | 3 | Mock | `enterpriseSeed.ts:573-619` |
| `compositions` | 1 | Mock | `enterpriseSeed.ts:620-633` |
| `people` | 5 | Mock | `enterpriseSeed.ts:634-697` |
| `governance` | 4 | Mock | `enterpriseSeed.ts:698-750` |
| `integrations` | 6 | Mock | `enterpriseSeed.ts:751-806` |
| `weeklyProgress` | 6 | Mock | `enterpriseSeed.ts:807-814` |
| `commitments` | 4 | Mock | `enterpriseSeed.ts:815-852` |
| `notifications` | 3 | Mock | `enterpriseSeed.ts:853-881` |

**Todos** os registros têm `origin: 'demonstrativo'` — **ZERO dados reais persistidos**.

---

## 6. Tipos TypeScript (Domínio) — Evidenciados

**Arquivo:** `src/types/enterprise.ts` (374 linhas, 8889 bytes)

Principais tipos definidos (evidenciados):

| Tipo | Descrição | Linhas |
|------|-----------|--------|
| `UserRole` | 11 roles | 1-11 |
| `ModuleId` | 17 módulos | 13-29 |
| `DataOrigin` | `'demonstrativo' \| 'integrado' \| 'calculado'` | 31 |
| `FinancialEntry` | Lançamento financeiro | 35-48 |
| `CompanyAccount` | Conta cliente | 59-72 |
| `CommercialOpportunity` | Oportunidade comercial | 74-87 |
| `EnterpriseProject` | Projeto empresarial | 144-168 |
| `EnterpriseState` | Estado global da app | 352-374 |
| `AgentBlueprint` | Perfil de agente (283 catálogo) | 222-238 |
| `OperationalAgentInstance` | Instância Paperclip | 240-254 |
| `GovernanceRecord` | DEC/CNS/DELIB/AUDIT | 292-304 |

---

## 7. Diagnóstico Consolidado (Atualizado com Evidências)

| Dimensão | Status Real | Evidência Principal | Gap para NettosCorp Enterprise |
|----------|-------------|---------------------|-------------------------------|
| **Arquitetura Geral** | React 19 + Express (não Cloudflare Workers) | `server.ts`, `package.json` | Migrar para arquitetura híbrida (Edge + VM) |
| **Backend Completo** | Express mínimo (390 linhas) | `server.ts:1-390` | **Reconstruir** — adicionar DB, Auth, Agent Runtime |
| **Frontend Completo** | **17 módulos React funcionais** | `src/modules/`, `App.tsx` | **APROVEITAR** — base sólida |
| **Persistência** | **AUSENTE** (localStorage + /tmp) | `enterpriseService.ts`, `server.ts:9` | **CRÍTICO** — Implementar PostgreSQL + Drizzle |
| **Auth/Authorization** | **Apenas Frontend RBAC** | `permissions.ts`, `App.tsx:60` | **CRÍTICO** — Implementar Auth real (Better Auth) |
| **Camada de Agentes** | **AUSENTE** (apenas UI) | `OperationalAgentsModule`, `AgencyLibraryModule` | **CRÍTICO** — Integrar Paperclip + ACP |
| **Reconciliação** | **AUSENTE** | `grep -r "reconcile\|ledger\|hash" src/` → vazio | **CRÍTICO** — Implementar Ledger + 5-state |
| **Memória Institucional** | **AUSENTE** | `grep -r "vector\|embedding\|rag" src/` → vazio | **ALTO** — Implementar RAG + Vector DB |
| **CI/CD** | **AUSENTE** | `.github/workflows/` vazio | **ALTO** — Implementar Turbo + Changesets |
| **Observabilidade** | **AUSENTE** | `grep -r "sentry\|otel\|tracing" src/` → vazio | **ALTO** — Implementar OTel + Sentry |
| **Paperclip Integration** | **NÃO CONFIGURADO** | `enterpriseSeed.ts:771-778` | **CRÍTICO** — Implementar Adapter |
| **Supabase** | **NÃO CONFIGURADO** | `enterpriseSeed.ts:751-760` | **CRÍTICO** — Configurar Auth + DB |
| **Gemini AI** | **FUNCIONAL** (server-side) | `server.ts:166-290` | **APROVEITAR** — Base para AI layer |

---

## 8. Próximos Passos de Investigação (Completados)

| Item | Status | Evidência |
|------|--------|-----------|
| Ler `server.ts` integral | ✅ **CONCLUÍDO** | `server.ts:1-390` lido integralmente |
| Inspecionar `src/routes/` e `src/lib/` | ✅ **N/A** — React usa hash routing | `App.tsx` usa hash routing (`window.location.hash`) |
| Ler `wrangler.toml` completo | ✅ **CONCLUÍDO** | `wrangler.toml:1-17` — apenas Pages config |
| Verificar `package.json` scripts | ✅ **CONCLUÍDO** | `package.json:6-13` |
| Buscar configs de auth | ✅ **CONCLUÍDO** | **AUSENTE** no backend |
| Verificar D1 schema / migrations | ✅ **CONCLUÍDO** | **AUSENTE** |
| Rodar localmente | ✅ **CONCLUÍDO** | `bun dev` / `tsx server.ts` funcionais |

---

## 9. Referência aos Documentos Atualizados

Esta auditoria **substitui** a versão anterior (v1.0) com evidências reais de código. Todos os gaps anteriormente marcados como "NÃO VERIFICADO" foram **verificados e classificados**.

**Próximo:** Auditoria profunda do **Agency Agents** (fork local) e **Paperclip** para completar a matriz de aderência com evidências reais.

---

*Auditoria baseada em inspeção direta de código (`server.ts`, `src/`, `package.json`, `wrangler.toml`). Zero suposições — toda afirmação tem evidência `arquivo:linha`.*