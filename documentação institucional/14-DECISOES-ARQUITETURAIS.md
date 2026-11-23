# Decisões Arquiteturais — NettosCorp Enterprise

> **Versão:** 1.0  \
> **Data:** 22 de novembro de 2026  \
> **Status:** ADRs 01, 02, 03 registrados e aprovados \
> **Responsável:** Hermes (Chefe de Gabinete Executivo) \
> **Aprovação:** Founder (Netto Farias) \
> **Finalidade:** Registro formal de todas as decisões arquiteturais tomadas durante o roadmap institucional, com status de aprovação claramente identificado e justificativas detalhadas.

---

## 1. Propósito

Este documento tem por objetivo centralizar todas as decisões arquiteturais (ADRs) tomadas ao longo do roadmap institucional da NettosCorp Enterprise. Cada decisão está registrada com:

- **Título** — Identificação clara da decisão
- **Contexto** — Situação que motivou a decisão
- **Decisão** — O que foi decidido
- **Consequências** — Impactos positivos e negativos
- **Status de Aprovação** — Aprovado/Pendente/Reaberto
- **Data** — Quando a decisão foi tomada
- **Autoridade** — Quem aprovou (Founder/Hermes)
- **Referências** — Documentos e seções relacionados

---

## 2. ADRs Registrados

### ADR 01: Separação de Identidade (22/11/2026)

**Contexto:** Necessidade de distinguir entre identidade humana, identidade de agente, instância operacional e configuração de execução em uma plataforma unificada, evitando confusões no frontend, backend e RBAC/ABAC.

**Decisão:** Criar quatro tipos de entidade distintas com fronteiras claras:
- `Professional` — perfil humano (RH source of truth)
- `Agent` — agente IA com slug e frontmatter canonico (Agency Agents source of truth)
- `Instance` — instância operacional ativa (runtime config)
- `Profile` — perfil de habilidades e specialities (Agency Agents frontmatter)

**Consequências:**
- ✅ Frontend não confunde usuários humanos com agentes IA
- ✅ RBAC e ABAC têm bases distintas por tipo de entidade
- ✅ Fontes de verdade são isoladas e rastreadas
- ⚠️ Necessita mapeamento de conversão em migrações existentes
- ⚠️ Requere ADRs subsequentes para validar trade-offs

**Status de Aprovação:** ✅ **APROVADO** — Aprovado pelo Founder (Netto Farias) em 22/11/2026  
**Data:** 22/11/2026  
**Autoridade:** Netto Farias (Founder, NettosCorp)  
**Referências:** `01-VISAO-E-DIRETRIZES.md#adr-01-separacao-de-identidade`, `10-ROADMAP-DE-INTEGRACAO.md#adr-01-separacao-de-identidade`

---

### ADR 02: Fonte Única de Verdade por Domínio (22/11/2026)

**Contexto:** Cada domínio precisa de sua fonte de verdade durável e única para evitar inconsistências e garantia de consistência.

**Decisão:**
- Human Domain: RH / Active Directory
- Agent Domain: Agency Agents corpus (fork Tokenizaa/4df4038)
- Operational Domain: PostgreSQL + Drizzle ORM + RLS Policies
- Integration Domain: Código fonte + especificações de adaptadores

**Consequências:**
- ✅ Cada domínio tem responsabilidade clara sobre sua fonte de verdade
- ✅ Consistência aumentada — nenhuma entidade em dois lugares
- ⚠️ Migrações necessárias para reestruturar fontes existentes
- ⚠️ Requere coordenação com Founder para aprovação de fontes humanas

**Status de Aprovação:** ✅ **APROVADO** — Aprovado pelo Founder (Netto Farias) em 22/11/2026  
**Data:** 22/11/2026  
**Autoridade:** Netto Farias (Founder, NettosCorp)  
**Referências:** `01-VISAO-E-DIRETRIZES.md#adr-02-fonte-unica-de-verdade`, `10-ROADMAP-DE-INTEGRACAO.md#adr-02-fonte-unica-de-verdade`

---

### ADR 03: Integração via Adaptadores, Não Modelo Unificado (22/11/2026)

**Contexto:** Decisão sobre como integrar Agency Agents e Paperclip ao TokenizAi sem criar dependências circulares ou monolito.

**Decisão:** Usar adaptadores desacoplados por provedor, com contrato definido em vez de um modelo unificado centralizado.

**Consequências:**
- ✅ Cada provedor tem adapter próprio — isolamento de falhas
- ✅ Nova integração adicionada sem modificar código existente
- ⚠️ Necessidade de manter 12+ adapters (Paperclip) + adaptadores IA
- ⚠️ Sobrecarga inicial de configuração

**Status de Aprovação:** ✅ **APROVADO** — Aprovado pelo Founder (Netto Farias) em 22/11/2026  
**Data:** 22/11/2026  
**Autoridade:** Netto Farias (Founder, NettosCorp)  
**Referências:** `01-VISAO-E-DIRETRIZES.md#adr-03-integracao-via-adaptadores`, `10-ROADMAP-DE-INTEGRACAO.md#adr-03-integracao-via-adaptadores`

---

## 3. Protocolo de Gestão de ADRs

| Ação | Responsável | Critério |
|------|-------------|----------|
| **Criar ADR** | Hermes | Contexto documentado, decisão clara, consequências identificadas |
| **Aprovar ADR** | Founder (Netto Farias) | Revisão técnica, impacto avaliado, concordância com princípios |
| **Reabrir ADR** | Founder | Novas evidências, mudança de cenário, trade-offs reavaliados |
| **Remover ADR** | Founder | Decisão anterior anulada, substituída por nova decisão |
| **Consultar ADR** | Qualquer membro da equipe | Contexto de decisão para implementação ou troubleshooting |

**Formato:** Cada ADR segue o modelo acima (seções 1-3). Novas ADRs seguem o mesmo padrão para consistência.

---

## 4. Histórico de Revisões

| Versão | Data | Autor | Mudança |
|--------|------|-------|---------|
| 1.0 | 22/11/2026 | Hermes / Founder | Registro inicial: ADRs 01, 02, 03 |

---