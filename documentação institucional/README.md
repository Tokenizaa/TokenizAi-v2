# Documentação de Engenharia Reversa — NettosCorp

Este diretório reúne a documentação técnica produzida durante as etapas de engenharia reversa dos dois projetos de referência da NettosCorp:

- **Paperclip** — Plataforma de orquestração de agentes de IA (monorepo Node.js/pnpm)
- **Agency Agents** — Catálogo de agentes especializados com app Tauri (Rust + Svelte)

A investigação foi realizada exclusivamente por inspeção estática de código e estrutura de arquivos — **nenhuma alteração foi feita nos repositórios de origem**, nenhum serviço foi reiniciado e nenhuma dependência foi atualizada.

---

## Estrutura de Diretórios

```
docs/
├── README.md                        # Este arquivo
├── paperclip/                       # Engenharia reversa do Paperclip (7 docs)
│   ├── REVERSE_ENGINEERING_OVERVIEW.md
│   ├── FRONTEND_ARCHITECTURE.md
│   ├── BACKEND_ARCHITECTURE.md
│   ├── DATABASE_ARCHITECTURE.md
│   ├── INTEGRATIONS_ARCHITECTURE.md
│   ├── INFRASTRUCTURE_ARCHITECTURE.md
│   └── ARCHITECTURAL_DECISIONS.md
└── agency-agents/                   # Engenharia reversa do Agency Agents (12 docs)
    ├── 00-OVERVIEW.md
    ├── 01-REPOSITORY-STRUCTURE.md
    ├── 02-AGENT-CATALOG.md
    ├── 03-AGENT-IDENTITY-AND-PERSONAS.md
    ├── 04-NEXUS-ORCHESTRATION.md
    ├── 05-HANDOFF-AND-QUALITY-GATES.md
    ├── 06-HERMES-INTEGRATION.md
    ├── 07-CONVERSION-AND-INSTALLATION.md
    ├── 08-TESTING-AND-CI.md
    ├── 09-NETTOSCORP-ARCHITECTURAL-ASSESSMENT.md
    ├── 10-INTEGRATION-OPPORTUNITIES-WITH-PAPERCLIP.md
    └── 11-TECHNICAL-RISKS-AND-INCONSISTENCIES.md
```

---

## Paperclip — 7 Documentos

| Documento | Descrição |
|-----------|-----------|
| `REVERSE_ENGINEERING_OVERVIEW.md` | Visão geral da arquitetura, stack, estrutura do monorepo, decisões e oportunidades de unificação |
| `FRONTEND_ARCHITECTURE.md` | Framework React 19 + Vite, sistema de rotas, layout principal, componentes, gerenciamento de estado (TanStack Query + Context), autenticação, estratégia de carregamento |
| `BACKEND_ARCHITECTURE.md` | Ponto de entrada Express, organização de rotas (100+), serviços de domínio (500+), middlewares, autenticação Better Auth, eventos assíncronos, tratamento de erros |
| `DATABASE_ARCHITECTURE.md` | Drizzle ORM, PostgreSQL (embedded para dev), 480+ tabelas, 490+ migrations, relacionamentos, estratégia de persistência, backup e ciclo de vida |
| `INTEGRATIONS_ARCHITECTURE.md` | 12 adapters ACP (agent adapters), plugin SDK, sandbox providers (9), MCP server (STDIO + HTTP), APIs REST, CLI, integração Hermes, credenciais e segredos |
| `INFRASTRUCTURE_ARCHITECTURE.md` | Como inicia, como UI e API são servidas, banco embedado, processos, dev/build/deploy, Docker/ECS, porta 3100, integração MCP, observabilidade |
| `ARCHITECTURAL_DECISIONS.md` | 15 decisões arquiteturais identificadas com vantagens, limitações, matriz de reutilização e roadmap para unificação das duas plataformas Node.js |

---

## Agency Agents — 12 Documentos

| Documento | Descrição |
|-----------|-----------|
| `00-OVERVIEW.md` | Visão geral, ecossistema, catálogo upstream vs app Tauri local, diferenças checkout vs upstream, estado da integração Hermes |
| `01-REPOSITORY-STRUCTURE.md` | Estrutura completa de diretórios, arquivos-chave, fluxo de dados, convenções de naming, ausências notáveis vs upstream |
| `02-AGENT-CATALOG.md` | Inventário completo dos 282 agentes por divisão (21 divisões), formato de arquivo, frontmatter, qualidade e consistência |
| `03-AGENT-IDENTITY-AND-PERSONAS.md` | Modelo de identidade (frontmatter), mapeamento para formatos de ferramenta, archetypes de persona, estrutura de personalidade, variação notáveis |
| `04-NEXUS-ORCHESTRATION.md` | Metodologia NEXUS, agentes-orchestrator, modelo de coordenação, hierarquia, ativação, delegação, paralelismo, compartilhamento de contexto, handoffs, gates de qualidade |
| `05-HANDOFF-AND-QUALITY-GATES.md` | Matriz de handoffs, 5-state reconcile, quality gates no convert.sh e no app Tauri, métricas, controle de tentativas, falhas conhecidas |
| `06-HERMES-INTEGRATION.md` | Integração Hermes (agency_agents_search/inspect/load/delegate), tools.json, convert.sh, arquivo `build-hermes-plugin.py` ausente, ciclo de vida dos subagentes |
| `07-CONVERSION-AND-INSTALATION.md` | Arquitetura do convert.sh (954 linhas), 15 formatos de saída, lib.sh ausente, mapeamento de tools, instalação real vs conversão, detecção automática |
| `08-TESTING-AND-CI.md` | 23 testes unitários Rust, parity test ignorado, testes frontend Svelte, zero CI/CD workflows no fork, scripts de validação ausentes |
| `09-NETTOSCORP-ARCHITECTURAL-ASSESSMENT.md` | Avaliação para NettosCorp: identidade institucional, governança, Paperclip, Hermes, memória e conhecimento, matriz de riscos, esforço por workstream |
| `10-INTEGRATION-OPPORTUNITIES-WITH-PAPERCLIP.md` | 10 oportunidades de integração, top 5 detalhadas, mapa técnico, roadmap sugerido |
| `11-TECHNICAL-RISKS-AND-INCONSISTENCIES.md` | 20 riscos identificados (4 críticos, 7 altos, 5 médios, 4 baixos), matriz de mitigacao, plano priorizado |

---

## Principais Conclusões da Investigação

### Paperclip
- Monorepo pnpm com 27 packages, TypeScript strict, Express 5, React 19 (RC), Drizzle ORM
- 480+ tabelas, 490+ migrations, embedded PostgreSQL para dev
- 12 adapters ACP para agentes locais/remotos, Plugin SDK v1.0.0, MCP server
- App Tauri + Svelte 5 para UI desktop
- Oportunidade clara de extração de `@nettoscorp/shared`, `@nettoscorp/db`, `@nettoscorp/plugin-sdk`

### Agency Agents
- 282 agentes Markdown em 21 divisões, catálogo canônico em `msitarzewski/agency-agents` (upstream)
- Checkout local é o fork `Tokenizaa/agency-agents-app` (app Tauri) — **não** inclui pasta `strategy/` (NEXUS) nem scripts completos
- Integração Hermes **quebrada**: `build-hermes-plugin.py` ausente no checkout local
- 8/18 ferramentas installable via app; 10 recognized-only
- Ledger + 5-state reconcile é o diferencial técnico reutilizável

---

## Regras de Uso

Esta documentação é resultado de **engenharia reversa apenas**. Não modifique os arquivos aqui sem autorização. Para implementar qualquer oportunidade identificada, aguarde a próxima etapa de deliberação arquitetural conjunta.

---

*Produzido por Hermes (Chefe de Gabinete Executivo) — 21 de novembro de 2026*