# Paperclip — Decisões Arquiteturais Identificadas

> **Data:** 21 de novembro de 2026  
> **Versão analisada:** 0.3.1  
> **Base:** Engenharia reversa completa dos 6 documentos anteriores

---

## 1. Resumo das Decisões Arquiteturais

| # | Decisão | Categoria | Impacto |
|---|---------|-----------|---------|
| 1 | Monorepo pnpm workspaces | Organizacional | Alto |
| 2 | TypeScript strict + ESM only | Linguagem | Alto |
| 3 | Express 5 + React 19 (RC) | Framework | Médio |
| 4 | Drizzle ORM (SQL-first) | Data | Alto |
| 5 | Embedded PostgreSQL para dev | Infraestrutura | Alto |
| 6 | Better Auth (framework-agnostic) | Auth | Médio |
| 7 | ACP (Agent Client Protocol) | Integração | Alto |
| 8 | Plugin Workers isolados (RPC) | Extensibilidade | Alto |
| 9 | MCP (Model Context Protocol) | Integração | Médio |
| 10 | TanStack Query + WebSocket fanout | Frontend State | Alto |
| 11 | Tailwind 4 (CSS-first) | Styling | Médio |
| 12 | Zod para validação runtime | Type Safety | Alto |
| 13 | OpenTelemetry + Sentry | Observabilidade | Médio |
| 14 | Company-scoped multi-tenancy | Arquitetura | Alto |
| 15 | Graceful shutdown 90s | Operacional | Médio |

---

## 2. Análise Detalhada por Decisão

### 2.1 Monorepo pnpm Workspaces

**Evidência:** `pnpm-workspace.yaml` com 27 packages, `package.json` root com `scripts` orquestrando tudo.

| Vantagens | Limitações |
|-----------|------------|
| Single lockfile, atomic installs | Build mais lento (todos packages) |
| Shared types (`@paperclipai/shared`) | Version coupling entre packages |
| Refatoração cross-package atômica | `pnpm -r` executa em todos |
| CI/CD simplificado (turbo) | Dependências circulares possíveis |
| Workspace protocol (`workspace:*`) | Hoisting limitado vs npm/yarn |

**Oportunidade Unificação:** Extrair `@nettoscorp/shared`, `@nettoscorp/db`, `@nettoscorp/plugin-sdk` como packages independentes versionados separadamente.

---

### 2.2 TypeScript Strict + ESM Only

**Evidência:** `tsconfig.base.json` → `"strict": true`, `"module": "NodeNext"`, `"type": "module"` em todos `package.json`.

| Vantagens | Limitações |
|-----------|------------|
| Type safety máximo | Curva de aprendizado |
| Tree-shaking nativo ESM | Interop CommonJS complexa |
| Top-level await | Alguns libs ainda CJS |
| Import assertions/attributes | NodeNext resolution quirks |

**Oportunidade Unificação:** Manter — base sólida para qualquer plataforma TypeScript.

---

### 2.3 Express 5 + React 19 (Release Candidates)

**Evidência:** `server/package.json` → `"express": "^5.1.0"`, `ui/package.json` → `"react": "^19.2.8"`.

| Vantagens | Limitações/Riscos |
|-----------|-------------------|
| Performance (Express 5) | APIs instáveis, breaking changes |
| React 19: Actions, Forms, Compiler | RC — não recomendado para prod crítico |
| Modern patterns nativos | Ecossistema de libs ainda adaptando |
| Menos middleware custom | Debugging mais difícil |

**Recomendação Unificação:** Considerar **Express 4.x LTS** + **React 18.x** para estabilidade, ou pinar versões exatas com upgrade planejado.

---

### 2.4 Drizzle ORM (SQL-first)

**Evidência:** `packages/db/` — 200+ schema files, 490+ migrations, `drizzle-orm` + `drizzle-kit`.

| Vantagens | Limitações |
|-----------|------------|
| Type-safe SQL (zero runtime overhead) | Schema manual (não auto-generate de DB) |
| Leve (~50KB) | Migrações mais verbosas que Prisma |
| SQL-first — controle total | Relacionamentos complexos verbosos |
| Prepared statements nativos | Learning curve vs ORMs tradicionais |
| Funciona com qualquer PG | — |

**Oportunidade Unificação:** **Altamente reutilizável** — extrair `@nettoscorp/db` com schema base (auth, companies, memberships) + migrations. Cada plataforma estende com suas tabelas.

---

### 2.5 Embedded PostgreSQL para Desenvolvimento

**Evidência:** `packages/db/src/embedded-postgres-*.ts`, `docker-compose.yml` usa `postgres:17-alpine` para prod.

| Vantagens | Limitações |
|-----------|------------|
| Zero-config local dev | Não reflete produção exatamente |
| CI determinístico (mesmo binário) | Versão embedded (18.1.0-beta) ≠ prod (17) |
| Isolamento total por developer | Primeira execução lenta (3-5s download) |
| Testes integrados reais | Dados persistem em `~/.paperclip/` |

**Recomendação Unificação:** Manter para dev, mas **documentar gaps dev/prod** (versão PG, config, extensions). Considerar Testcontainers para CI.

---

### 2.6 Better Auth (Framework-Agnostic)

**Evidência:** `server/src/auth/better-auth.ts`, `server/package.json` → `"better-auth": "1.7.16"`.

| Vantagens | Limitações |
|-----------|------------|
| Não acoplado a Next.js/Remix | Documentação limitada |
| Plugin system (org, admin, api-key) | Breaking changes frequentes (v1.x) |
| Multi-session, multi-device | Menos exemplos comunitários |
| Cookie/token flexível | Debugging auth flows complexo |
| WebAuthn/passkeys built-in | — |

**Oportunão Unificação:** Reutilizável como base de auth. Extrair config comum para `@nettoscorp/auth`.

---

### 2.7 ACP (Agent Client Protocol)

**Evidência:** 12 adapters em `packages/adapters/*`, `@agentclientprotocol/sdk: 1.9.0`.

| Vantagens | Limitações |
|-----------|------------|
| Padroniza agent communication | Ecossistema jovem (poucos agents) |
| Local + remote unified interface | Spec em evolução |
| Streaming, cancellation, tools | Debugging ACP flows difícil |
| Type-safe (TypeScript SDK) | Version mismatch entre agents |

**Oportunidade Unificação:** **Core reutilizável** — publicar adapters como `@nettoscorp/adapter-{claude,codex,cursor,...}` independentes.

---

### 2.8 Plugin Workers Isolados (RPC over WebSocket)

**Evidência:** `packages/plugins/sdk/`, `server/src/services/plugin-worker-manager.ts`, `plugin-host-services.ts`.

| Vantagens | Limitações |
|-----------|------------|
| Segurança (isolação de processo) | Overhead IPC (serialização, latency) |
| Fault isolation (crash não derruba server) | Debugging cross-process difícil |
| Versionamento independente | Memory overhead (Node por worker) |
| Hot reload de plugins | Complexidade operacional |
| Sandbox providers plugáveis | — |

**Oportunidade Unificação:** **Plugin SDK v1.0.0 estável** — extrair como `@nettoscorp/plugin-sdk` independente. Arquitetura worker RPC é diferencial competitivo.

---

### 2.9 MCP (Model Context Protocol)

**Evidência:** `packages/mcp-server/`, `server/src/services/public-mcp/`, `server/src/routes/mcp-apps.ts`.

| Vantagens | Limitações |
|-----------|------------|
| Padrão emergente (Anthropic, Microsoft) | Spec v1.0 recente (2024) |
| Integração nativa Cursor, Claude Desktop | Tool discovery ainda limitada |
| HTTP/SSE + STDIO transports | Auth/OAuth complexo |
| Expõe tools Paperclip externamente | Rate limiting, quotas manuais |

**Oportunidade Unificação:** Manter MCP server + gateway como integração padrão para ambas plataformas.

---

### 2.10 TanStack Query + WebSocket Fanout (Frontend State)

**Evidência:** `ui/src/lib/query-client.ts`, `ui/src/context/LiveUpdatesProvider.tsx` (100KB).

| Vantagens | Limitações |
|-----------|------------|
| Server state cache inteligente | Complexidade de reconciliação |
| Stale-while-revalidate nativo | WebSocket fanout custom (não standard) |
| Optimistic updates + rollback | BroadcastChannel para multi-tab |
| Connectivity-aware (pause/resume) | Memory leak risk se gcTime alto |
| Persisted query cache (cross-session) | — |

**Oportunidade Unificação:** **Pattern reutilizável** — extrair `createAppQueryClient` + `LiveUpdatesProvider` como `@nettoscorp/frontend-query`.

---

### 2.11 Tailwind CSS 4 (CSS-first)

**Evidência:** `ui/package.json` → `"tailwindcss": "^4.3.3"`, `"@tailwindcss/vite": "^4.3.3"`, `ui/src/index.css` com `@import "tailwindcss"`.

| Vantagens | Limitações |
|-----------|------------|
| Zero config (CSS-first) | Breaking v3→v4 (plugins incompatíveis) |
| Performance (Lightning CSS) | Menos documentação/comunidade v4 |
| Design tokens nativos (CSS vars) | Migration effort existente |
| No PostCSS needed | — |

**Recomendação Unificação:** Avaliar custo migração vs benefício. Tailwind 3.4 estável pode ser mais seguro para unificação.

---

### 2.12 Zod para Validação Runtime

**Evidência:** `packages/shared/` → `"zod": "^4.6.6"`, usado em schemas, config, API validation.

| Vantagens | Limitações |
|-----------|------------|
| TypeScript inference (z.infer) | Bundle size (~50KB) |
| Composável, extensível | Performance em hot paths |
| Error messages úteis | v4 breaking changes |
| Integração nativa com Drizzle (zod-drizzle) | — |

**Oportunidade Unificação:** **Base compartilhada** — `@nettoscorp/shared` já exporta Zod schemas reutilizáveis.

---

### 2.13 OpenTelemetry + Sentry

**Evidência:** `server/src/instrumentation.ts`, `server/src/sentry.ts`, `@opentelemetry/*` deps.

| Vantagens | Limitações |
|-----------|------------|
| Vendor-neutral tracing/metrics | Setup complexo (muitos pacotes) |
| Auto-instrumentation rica | Overhead em alta throughput |
| Sentry para errors + performance | Custo Sentry em escala |
| Custom metrics fácil | Sampling config non-trivial |

**Oportunidade Unificação:** Config base extraível para `@nettoscorp/observability`.

---

### 2.14 Company-Scoped Multi-Tenancy

**Evidência:** Todas tabelas têm `company_id`, `CompanyContext` no frontend, `actorMiddleware` resolve company.

| Vantagens | Limitações |
|-----------|------------|
| Simples (single schema) | Não é true multi-tenant (schema isolation) |
| RLS-ready (policies definidas) | Query filters em todo lugar |
| Compartilhamento controlado | Cross-company queries complexas |
| Migração simples | — |

**Oportunidade Unificação:** **Modelo reutilizável** — ambas plataformas (B2C/B2B) precisam isolamento por organização. RLS nativo PG quando ativado.

---

### 2.15 Graceful Shutdown 90s

**Evidência:** `docker-compose.yml` → `stop_grace_period: 90s`, `server/src/shutdown.ts` (13KB).

| Vantagens | Limitações |
|-----------|------------|
| Drains in-flight requests | 90s pode ser longo para K8s |
| Coordena workers background | Embedded PG supervisor adiciona tempo |
| Release native processes | Force kill após timeout |
| Flush telemetry | — |

**Oportunidade Unificação:** Pattern reutilizável — configurável por ambiente.

---

## 3. Matriz de Reutilização para Unificação

| Componente | Reutilização | Esforço | Prioridade | Estratégia |
|------------|--------------|---------|------------|------------|
| `@paperclipai/shared` | ✅ Total | Baixo | 🔴 Crítico | Extrair → `@nettoscorp/shared` |
| `@paperclipai/db` (core) | ✅ Parcial | Médio | 🔴 Crítico | Base schema + migrations → `@nettoscorp/db` |
| `@paperclipai/plugin-sdk` | ✅ Total | Baixo | 🟡 Alto | Publicar independente v1.0.0 |
| `packages/adapters/*` | ✅ Total | Baixo | 🟡 Alto | Publicar como `@nettoscorp/adapter-*` |
| `packages/mcp-server` | ✅ Total | Baixo | 🟢 Médio | Publicar independente |
| `server/src/middleware/*` | ✅ Parcial | Baixo | 🟡 Alto | Auth, logging, error → shared |
| `server/src/services/plugin/*` | ✅ Parcial | Médio | 🟡 Alto | Worker manager, RPC → SDK |
| `ui/src/components/ui/*` | ✅ Parcial | Médio | 🟢 Médio | Design system → `@nettoscorp/ui-primitives` |
| `ui/src/lib/query-client.ts` | ✅ Parcial | Baixo | 🟡 Alto | `createAppQueryClient` → shared |
| `ui/src/context/LiveUpdatesProvider` | ✅ Parcial | Médio | 🟡 Alto | WebSocket fanout → shared |
| `server/src/services/agent-lifecycle` | ⚠️ Específico | Alto | 🟢 Baixo | Kernel genérico + domain extensions |
| `server/src/services/issues.ts` | ⚠️ Específico | Alto | 🟢 Baixo | Domain-specific, não reutilizar |
| `ui/src/pages/*` | ❌ Não | — | — | Module-specific, não reutilizar |

---

## 4. Pontos Fortes da Arquitetura Atual

| Força | Evidência | Valor para Unificação |
|-------|-----------|----------------------|
| **Type safety end-to-end** | TS strict + Drizzle + Zod + TanStack Query | Reduz bugs, facilita refatoração |
| **Plugin architecture madura** | SDK v1.0.0, 9 sandbox providers, worker isolation | Diferencial competitivo, extensibilidade |
| **Agent protocol padrão (ACP)** | 12 adapters, local + gateway unified | Vendor-neutral, future-proof |
| **MCP nativo** | STDIO + HTTP/SSE + gateway | Integração ecossistema AI |
| **Real-time robusto** | LiveUpdatesProvider 100KB, fanout, reconciliation | UX rica, multi-tab |
| **DevEx embedded PG** | Zero-config, CI determinístico | Onboarding rápido |
| **Observabilidade integrada** | OTel + Sentry + custom metrics | Production-ready |
| **Graceful operations** | Shutdown 90s, health endpoints, migrations | Operational excellence |

---

## 5. Limitações e Riscos

| Limitação | Risco | Mitigação |
|-----------|-------|-----------|
| **Domain logic acoplada** | Services 500+ files com Paperclip-specific | Extrair kernels genéricos, domain plugins |
| **Schema único (480 tabelas)** | Migrações lentas, coupling | Modularizar migrations por domínio |
| **React 19 RC + Express 5 RC** | Instabilidade, breaking changes | Pin versions, upgrade planejado |
| **Tailwind 4 breaking** | Plugins incompatíveis, migration effort | Avaliar ficar no 3.4 estável |
| **Better Auth v1.x breaking** | Upgrades dolorosos | Lock version, test matrix |
| **Single-process server** | Escala vertical limitada | Planejar horizontal (stateless + Redis) |
| **Embedded PG version drift** | Dev ≠ Prod (18 beta vs 17 stable) | Documentar, Testcontainers para CI |
| **No OpenAPI auto-gen** | Integração externa manual | Adicionar `express-openapi-validator` |
| **Plugin debugging difícil** | Cross-process, RPC serialization | Tooling: plugin inspector, logs agregados |

---

## 6. Recomendações para Arquitetura Unificada

### 6.1 Princípios Norteadores

1. **Shared kernel, domain plugins** — Core compartilhado (`shared`, `db`, `plugin-sdk`, `adapters`), domínios como plugins isolados
2. **Module federation** — Cada plataforma (DefesaI Saúde, Enterprise) = módulo com routes, services, UI próprios
3. **Versionamento independente** — Packages core versionados separadamente (`@nettoscorp/*`)
4. **Backward compatibility** — Migração incremental, não big bang
5. **Observability first** — OTel + Sentry + health endpoints em tudo

### 6.2 Arquitetura Proposta

```
nettoscorp-platform/
├── packages/
│   ├── core/
│   │   ├── shared/              # @nettoscorp/shared (types, zod, constants)
│   │   ├── db/                  # @nettoscorp/db (Drizzle, migrations base, embedded PG)
│   │   ├── auth/                # @nettoscorp/auth (Better Auth config base)
│   │   ├── observability/       # @nettoscorp/observability (OTel, Sentry, health)
│   │   └── plugin-sdk/          # @nettoscorp/plugin-sdk (v1.0.0+)
│   ├── adapters/                # @nettoscorp/adapter-{claude,codex,cursor,hermes,...}
│   ├── mcp/                     # @nettoscorp/mcp-server, @nettoscorp/mcp-gateway
│   ├── ui-primitives/           # @nettoscorp/ui-primitives (Radix + Tailwind)
│   ├── frontend-query/          # @nettoscorp/frontend-query (TanStack + WS fanout)
│   └── infra/                   # Docker, CI/CD, scripts compartilhados
├── apps/
│   ├── defesai-saude/           # B2C beneficiário (module)
│   │   ├── server/              # Domain services, routes
│   │   ├── ui/                  # Pages, components
│   │   └── shared/              # Types, hooks específicos
│   └── enterprise/              # B2B admin/org (module)
│       ├── server/
│       ├── ui/
│       └── shared/
├── docker/                      # Base images, compose templates
├── turbo.json                   # Pipeline orchestration
└── pnpm-workspace.yaml
```

### 6.3 Roadmap de Migração

| Fase | Entregável | Duração | Dependências |
|------|------------|---------|--------------|
| **1. Foundation** | `@nettoscorp/shared`, `@nettoscorp/db`, `@nettoscorp/auth` | 2-3 semanas | — |
| **2. Adapters & MCP** | Publicar 12 adapters + MCP server/gateway | 1-2 semanas | Foundation |
| **3. Plugin SDK** | `@nettoscorp/plugin-sdk` v2 (independente) | 1 semana | Foundation |
| **4. Frontend Shared** | `@nettoscorp/ui-primitives`, `@nettoscorp/frontend-query` | 2 semanas | Foundation |
| **5. Module Architecture** | Module federation no server + UI | 3-4 semanas | 1-4 |
| **6. DefesaI Saúde Module** | Port existing app como module | 4-6 semanas | 5 |
| **7. Enterprise Module** | Port existing enterprise como module | 4-6 semanas | 5 |
| **8. Unified CI/CD** | Turbo pipeline + changesets + Docker | 2 semanas | 5 |
| **9. Observability Unified** | Dashboards, alertas, runbooks | 1 semana | 8 |

---

## 7. Evidências Consolidadas

| Documento | Decisões Cobertas | Linhas de Código Analisadas |
|-----------|-------------------|----------------------------|
| `REVERSE_ENGINEERING_OVERVIEW.md` | 1, 2, 14 | ~500 (config + structure) |
| `FRONTEND_ARCHITECTURE.md` | 3, 10, 11, 12 | ~2.000 (App.tsx, main.tsx, hooks, contexts) |
| `BACKEND_ARCHITECTURE.md` | 3, 6, 7, 8, 13, 14, 15 | ~3.000 (index.ts, app.ts, services, middleware) |
| `DATABASE_ARCHITECTURE.md` | 4, 5, 14 | ~1.500 (schema, migrations, client) |
| `INTEGRATIONS_ARCHITECTURE.md` | 7, 8, 9 | ~1.000 (adapters, plugins, MCP, CLI) |
| `INFRASTRUCTURE_ARCHITECTURE.md` | 5, 13, 15 | ~1.000 (docker, shutdown, build, storage) |

**Total estimado:** ~9.000 linhas de código inspecionadas diretamente + estrutura de 2.500+ arquivos.

---

## 8. Conclusão

O Paperclip é uma **plataforma de orquestração de agentes madura e bem arquitetada** com:

- ✅ **Base técnica sólida** para unificação (shared packages, plugin SDK, adapters)
- ✅ **Decisões modernas** (ACP, MCP, Drizzle, TanStack Query, OTel)
- ✅ **Operational excellence** (graceful shutdown, health checks, embedded PG)
- ⚠️ **Riscos gerenciáveis** (RC frameworks, domain coupling, schema size)

**Recomendação:** Prosseguir com extração de `@nettoscorp/*` core packages e arquitetura modular por domínio. O investimento inicial (fases 1-4) habilita desenvolvimento paralelo das duas plataformas com compartilhamento real de infraestrutura.

---

*Este documento consolida evidências de 6 documentos de engenharia reversa. Todas as conclusões baseiam-se em inspeção direta de código — zero suposições sobre comportamento em runtime sem evidência.*