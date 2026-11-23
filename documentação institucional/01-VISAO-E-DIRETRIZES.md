# Visão e Diretrizes Institucionais

> **Versão:** 1.1  \
> **Data:** 22 de novembro de 2026  \
> **Status:** **Fase 1 autorizada** — Arquitetura e Modelo de Domínio \
> **Responsável:** Hermes (Chefe de Gabinete Executivo)

---

## 1. Declaração de Visão

**NettosCorp Enterprise** é a plataforma unificada de orquestração de agentes de IA para organizações que exigem:

- **Governança rastreável** — toda decisão de agente é auditável, hierárquica e reversível
- **Identidade institucional** — agentes não são "prompts", são cargos com autoridade, responsabilidade e limites claros
- **Interoperabilidade real** — mesmo agente roda em Claude Code, Codex, Cursor, Hermes, Paperclip, CLI, sem reescrita
- **Memória persistente** — aprendizado cross-sessão, cross-agente, cross-organização, com atribuição e controle
- **Escala operacional** — de 1 a 10.000 agentes, com reconciliação automática de estado

---

## 2. Princípios Arquiteturais (Não Negociáveis)

| Princípio | Descrição | Implicação Técnica |
|-----------|-----------|-------------------|
| **Autoridade Centralizada** | Founder → Diretoria → Gerência → Especialistas | RBAC hierárquico, delegação explícita, sem "agentes autônomos soltos" |
| **Identidade > Prompt** | Agente = Cargo + Contrato + Memória + Ferramentas | Frontmatter estendido, schema versionado, provisionamento controlado |
| **Catálogo Único** | Um agente, múltiplos runtimes (ACP, MCP, CLI, HTTP) | Adapters ACP + renderers determinísticos + plugin Hermes |
| **Reconciliação Contínua** | Estado instalado vs. catálogo vs. execução = fonte da verdade | Ledger + hash-match + 5-state (CURRENT/OUTDATED/MODIFIED/REMOVED/FOREIGN) |
| **Memória Institucional** | Aprendizado persiste, é atribuível, auditável, controlável | RAG + vector DB + knowledge graph + clearance-based access |
| **Isolamento por Design** | Perfil ≠ Instância ≠ Runtime ≠ Organização | Multi-tenancy nativo (RLS), namespaces, sandbox providers |

---

## 3. Diretrizes de Produto

### 3.1 Para Agentes (Especialistas)
- **Contrato de Cargo** — cada agente tem: missão, autoridade, limites, métricas de sucesso, relatórios a quem
- **Formação de Equipes** — Division (21) → Squad (preset) → Task Force (ad-hoc) → Solo
- **Metodologia NEXUS** — Pipeline PM → Architect → [Dev ↔ QA Loop] → Integration (adotada do Agency Agents)
- **Delegação Rastreável** — `delegate(task, context) → subagent → result + evidence`

### 3.2 Para Organizações (Instâncias)
- **Multi-tenancy Real** — RLS nativo PostgreSQL, não "query filter"
- **Hierarquia de Instâncias** — Holding → Company → Department → Team → Agent
- **Políticas de Orçamento** — Cost accounting por agente, por organização, por runtime
- **Auditoria Completa** — Quem instanciou, quem aprovou, quem executou, custo, resultado

### 3.3 Para Runtimes (Execução)
- **ACP First** — Agent Client Protocol como padrão de comunicação (12 adapters prontos)
- **MCP Native** — Model Context Protocol para ferramentas externas (STDIO + HTTP)
- **Sandbox Providers** — 9 providers (Daytona, E2B, Modal, K8s, Cloudflare, etc.) para isolamento
- **Paperclip Runner** — Execução nativa (copilot, codex, claude) com PRP protocol

### 3.4 Para Comunicação
- **Chat Channels** — Discord, Slack, GitHub, Telegram, Teams (já no Paperclip)
- **Hermes Gateway** — HTTP/SSE para agentes remotos (plugin Agency Agents)
- **Structured Handoffs** — Issue ↔ Case ↔ Task ↔ Agent, com evidência e rastreabilidade

---

## 4. O que NÃO É NettosCorp Enterprise

| Conceito Errado | Correção |
|-----------------|----------|
| "Marketplace de agentes" | Catálogo curado, versionado, governado — não loja aberta |
| "Agentes autônomos" | Agentes com autoridade delegada, limites, prestação de contas |
| "Prompt engineering platform" | Plataforma de cargos institucionais com ferramentas, memória, governança |
| "Wrapper sobre LLMs" | Orquestração de runtime, estado, identidade, reconciliação, auditoria |
| "SaaS multi-tenant genérico" | Instâncias organizacionais isoladas, com hierarquia e políticas próprias |

---

## 5. Métricas de Sucesso (Nível Institucional)

| Métrica | Target | Medição |
|---------|--------|---------|
| **Agent Provisioning Time** | < 30s (catálogo → runtime) | Ledger timestamp |
| **Reconcile Accuracy** | 100% (5-state) | Hash-match audit |
| **Delegation Success Rate** | > 95% (task → subagent → result) | Task completion log |
| **Memory Retrieval Precision** | > 90% (RAG + graph) | Evaluation set |
| **Cross-runtime Parity** | Byte-identical render | Parity test suite |
| **Audit Coverage** | 100% (ações sensíveis) | Immutable log |
| **Incident MTTR** | < 15min (agent failure) | Runtime metrics |

---

## 6. Riscos Aceitos vs. Riscos Mitigados

| Risco | Decisão | Mitigação |
|-------|---------|-----------|
| React 19 RC / Express 5 RC | **Aceito** — pinar versões exatas, upgrade planejado | Lockfile + test matrix |
| Better Auth v1.x breaking | **Mitigado** — wrapper próprio, version lock | Adapter pattern |
| NEXUS methodology incomplete | **Aceito** — adotar pipeline Dev-QA, evoluir internamente | Documentar gaps, não depender de upstream |
| Hermes plugin broken | **Crítico** — P0 fix | Recuperar `build-hermes-plugin.py` do upstream |
| Embedded PG dev/prod gap | **Mitigado** — Testcontainers para CI | Documentar divergências conhecidas |

---

## 7. Autoridade de Decisão

| Nível | Quem | Escopo |
|-------|------|--------|
| **Estratégico** | Netto Farias (Founder) | Arquitetura, roadmap, budget, parcerias, governance |
| **Arquitetural** | Hermes (Chefe de Gabinete) | Tech stack, patterns, integrações, trade-offs técnicos |
| **Tático** | Tech Leads (por módulo) | Implementation, code review, testing, delivery |
| **Operacional** | Agents (via orquestração) | Task execution, delegation, reporting |

> **Regra:** Decisões técnicas rotineiras são autônomas (Hermes). Migrações remotas, deploy, secrets, dados reais e ports são sob autoria do Founder.

---

*Este documento estabelece a "constituição" da NettosCorp Enterprise. Toda decisão arquitetural deve ser rastreável a um princípio aqui definido.*
## 6. Fase 1 — Arquitetura e Modelo de Domínio (Autorizada 22/11/2026)

### Objetivo
- Definir a arquitetura conceitual e os contratos do TokenizAi antes de implementar a fundação corporativa

### Entregáveis
1. Mapa de domínios e subdomínios da plataforma
2. Modelo de entidades e relacionamentos
3. Responsabilidades e limites de cada domínio
4. Fonte única de verdade de cada entidade e informação
5. Separação entre identidade humana, identidade de agentes, instâncias operacionais e configurações de execução
6. Modelo de autorização, hierarquia e autoridade institucional
7. Contratos entre frontend, backend, banco de dados e integrações
8. Relações com Paperclip e Agency Agents, sem confundir ferramentas externas com domínios proprietários do TokenizAi
9. Matriz de dependências entre domínios
10. ADRs e decisões arquiteturais necessárias

### Conclusão da Fase 1
- Documentação arquitetural completa
- Modelo de domínio consistente
- Contratos e responsabilidades sem ambiguidades relevantes
- Decisões arquiteturais registradas
- Revisão de consistência entre documentos
- Reconciliação local com origin/main
- Evidências de validação e relatório final

## 7. Protocolo Permanente de Execução das Fases

- Cada fase do roadmap institucional deverá ser executada como uma unidade completa de trabalho, do início ao encerramento formal
- Não será permitido iniciar a fase seguinte enquanto a fase atual não estiver integralmente concluída, validada, documentada e submetida à homologação
- Todos os 9 critérios obrigatórios devem ser atendidos: escopo, implementação, validação, consistência, Git, documentação, pendências, relatório de encerramento e homologação
- Uma pendência não bloqueadora pode ser aceita na homologação, desde que documentada, com impacto avaliado e que não comprometa os objetivos ou critérios de aceite da fase
- O fluxo institucional passa a ser: Planejamento da fase → Execução integral → Validação → Revisão de consistência → Documentação → Reconciliação Git → Relatório de encerramento → Homologação → Abertura da próxima fase

- Não iniciar a Fase 2 antes da homologação integral da Fase 1

