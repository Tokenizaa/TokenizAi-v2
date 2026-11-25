# Conciliação de 271 Agentes — Supabase × Hermes × Backend TokenizAi × Frontend TokenizAi

## Aviso Importante

Este documento apresenta diagnóstico técnico baseado em evidências do repositório TokenizAi V2 `main` (`0b32a7c6a0a395c9bad3afa3128ddf04d857d72a`) e da instância Hermes instalada. **Nenhuma contagem fictícia é apresentada.** O número "271" aparece em documentação interna (`AgencyLibraryView.tsx:151` — "283 indexed profiles") mas **não foi verificado em banco de dados operacional**. Este documento limita-se a evidências concretas encontradas no repositório e suas limitações declaradas.

---

## 1. Evidências Disponíveis

### 1.1 Banco de Dados (Supabase/local migration only)

| Hallazgo | Evidência |
|---|---|
| **Apenas uma migration** existe: `supabase/migrations/001_initial_schema.sql` (525 linhas) | `git show --stat` confirmado |
| **`agentes_empresariais` table** presente no migration (linhas 60-75) | Estrutura: `id uuid PK`, `slug unique not null`, `departamento_id → departments(id)`, `status CHECK (ativo,inativo,suspenso)`, `capabilities text[] default {}`, `Hermes correlation ids text` (linhas 69-70) |
| **Nenhum INSERT seed** no migration | Palavra-chave `INSERT` ausente do scan de 525 linhas (exceto comentários) |
| **`useSupabase = false`** no repositório corrente | `supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY)`; `.env` e `.env.example` não têm `SUPABASE_SERVICE_ROLE_KEY`; portanto `useSupabase = false`; `supabaseRepo` opera em modo degradado sobre `enterpriseState` em memória |
| **Nenhum `supabaseRepo.` métodos invocados para `agentes_empresariais`** | `grep supabaseRepo.` em `server.ts` → apenas 8 domínios (projetos, clientes, negociaios, produtos, assinaturas, lançamentos, automacoes, perfis_empresariais); **nenhum** método `agente` ou listagem similar |
| **Contagem real de registros:** **Não verificada** | Não há acesso ao banco de dados remoto Supabase; o migration SQL local não contém dados (nenhum `INSERT`); `printenv` da variáveis `SUPABASE_*` não disponível no shell de auditoria |

### 1.2 Runtime Hermes (instalado)

| Hallazgo | Evidência |
|---|---|
| **`GET /api/hermes/agents`** retorna agentes | `HermesBotDto` com `id/name/description/status`; `parseProfileList` (HPARSERS:13-19) retorna apenas `id/name/description/status`; `HermesGateway` CLI path hardcoded `/home/lg/.local/bin/hermes`; `activeTokens` Map (sessão em memória, perdida em restart — S7) |
| **`GET /api/hermes/org`** retorna organograma Hermes | `HermesBotDto` com `team`, `children`, `reportsTo`, `chainOfCommand` fields opcionais; `tree: HermesBotDto[]` e `agents: HermesBotDto[]` |
| **Nenhum `hermes_agent_id`** encontrado em enterpriseState ou enterprise routes | `grep hermes_agent_id` em `server.ts` e `src/` → nenhum match relevante; `enterpriseState` não armazena `hermes_agent_id`; `supabaseRepo` methods para agentes não existem |
| **Contagem no runtime:** **Não verificada** | O CLI `hermes` não está disponível no ambiente de auditoria; `execSync('<cli> --version')` falha silenciosamente; o ambiente não tem `/home/lg/.local/bin/hermes` |

### 1.3 Frontend TokenizAi

| Hallazgo | Evidência |
|---|---|
| **`AgencyLibraryView` apresenta 283 "perfis indexados"** | `src/modules/library/AgencyLibraryView.tsx:151`; divisão totalizam 283 a partir de 12 entries fixas em `AGENCY_SPECIALISTS` (linhas 3-18); divisão que soma 184 (contagem displayed como 283 — discrepância de contagem) |
| **12 specialist entries fixas** definidos em `AGENCY_SPECIALISTS` | `src/data/agencyCatalog.ts:3-18`; entries com `slug`, `name`, `division`; `competencies`, `runbook`, `limitations`, `recommendedAdapter` fields declarados mas **nunca enviados** ao backend; apenas `slug`, `name`, `division` são postados em `POST /api/hermes/agents/hire` (HROUTER:336-372) |
| **`283 indexed profiles`** = soma das contagens por divisão no catalogofrontend-only | `AgencyLibraryView.tsx:59,176`; a soma das contagens por divisão do catalogofrontend resulta em 184, mas a interface exibe "283 indexed profiles" — **discrepância de contagem** não resolvida no código |
| **Nenhum vínculo banco↔frontend↔runtime** | O frontend exibe catálogo estático; não consulta backend para contagem de agents; `HermesApi.getAgents()` (API:416-452) consome bundle + `getAgent`, `getAgentRuntimeState` (ausentes em HROUTER); `runtime-state` não existe no backend (identificado em auditoria anterior) |

### 1.4 Paperclip (referência)

| Hallazgo | Evidência |
|---|---|
| **Paperclip** tem 27 packages; 480+ tabelas; 12 adapters; Agent lifecycle completo; `agent_lifecycle`; `reconcile engine`; `agent_runtime_state`; `run_identity_contexts` | Documentação institucional `04-ENGENHARIA-REVERSA-PAPERCLIP.md`; `documentação institucional/11-MATRIZ-DE-ADERENCIA.md`; `cb64a236b` (v0.3.1) |
| **O número 271 não é referenciado** na documentação do Paperclip consultada | Busca por "271" nos documentos do Paperclip no repositório TokenizAi → zero matches |

---

## 2. Análise de Concorrência Entre Fontes

### 2.1 O que **pode** ser confirmado

| Fonte | Dados verificados | Status |
|---|---|---|
| **Migration local** | `agentes_empresariais` table structure definida; **zero registros** confirmados (migration sem INSERT) | ✅ Estrutura verificada; ❌ Dados verificados |
| **Frontend AgencyLibraryView** | 12 entries fixas `AGENCY_SPECIALISTS`; display de "283 indexed profiles" (contagem fonte); divisão que soma 184 (divulgada como 283) | ✅ Entries fixas verificadas; ❌ Contagem 283 verificada apenas no frontend; ❌ Conexão backend/runtime não verificada |
| **Backend supabaseRepo** | `useSupabase = false` (credenciais ausentes); methods para projetos/clientes/etc. existem mas **nenhum para listagem/consulta de agentes** | ✅ `useSupabase = false` verificado; ❌ Methods de agente não verificados |
| **Hermes runtime** | `GET /api/hermes/agents` retorna `HermesBotDto` com `id/name/description/status`; `parseProfileList` achatado; `activeTokens` Map em memória | ✅ Retorno de endpoint verificado; ❌ Contagem no runtime não verificada |

### 2.2 O que **não pode** ser confirmado (limitações declaradas)

| Limitação | Justificativa |
|---|---|
| **Contagem real de agentes em Supabase remoto** | Sem acesso ao banco de dados remoto; migration local não contém INSERT; variáveis `SUPABASE_*` não disponíveis no shell de auditoria |
| **Contagem de agentes ativos no Hermes CLI** | CLI `hermes` não disponível no ambiente; path hardcoded `/home/lg/.local/bin/hermes` inexistente; `execSync` falha silenciosamente |
| **Correspondência entre fontes** | Não possível estabelecer sem dados das fontes acima; `283` frontend vs estrutura DB desconhecida vs Paperclip 27 packages sem número 271 referenciado |
| **Se 271 agentes empresariais existem** | Apenas estrutura de tabela confirmada; nenhum dado inserido confirmado em nenhuma fonte |

---

## 3. Conciliação de Registros — O Que o Documento Mostra

| Fonte | Registros Verificáveis | Registros Invernificáveis | Observação |
|---|---|---|---|
| **Migration local (SQL)** | Estrutura da tabela `agentes_empresariais` (colunas, tipos, constraints) | Dados inseridos (linhas LINH); migration sem `INSERT` | A tabela existe estruturalmente mas está vazia de dados |
| **Frontend AgencyLibraryView** | 12 entries fixas `AGENCY_SPECIALISTS`; display "283 indexed profiles" (contagem fonte); divisão que soma 184 (divulgada como 283) | Contagem real de agents no banco; conexão com backend/runtime | O frontend mostra catálogo estático; a contagem "283" é declarada no código mas sua origem não foi rastreada até dados de banco |
| **Backend TokenizAi** | `useSupabase = false`; `agentes_empresariais` table structure conhecida; Nenhum método de listagem de agentes expostos | Contagem real; IDs dos agents; vínculos com Hermes ou Supabase | O backend não tem methods de listagem de agentes expostos; `useSupabase = false` impede queries reais |
| **Hermes Runtime** | `GET /api/hermes/agents` retorna schema `HermesBotDto` (id/name/description/status); `parseProfileList` achatado | Contagem no runtime; IDs que correspondem ao banco; vínculos com frontend | O endpoint existe mas retorna dados achatados; contagem não verificada |
| **Paperclip (referência)** | 27 packages; 480+ tabelas; 12 adapters; estrutura de agente completa | Número "271" não referenciado em nenhum documento Paperclip consultado | O Paperclip referencia modelos diferentes; o número 271 não aparece na documentação de referência |

---

## 4. Conclusões Sobre a Conciliação

1. **Não existe evidência de 271 agentes operacionais** em nenhuma das fontes verificadas:
   - O migration local não contém dados inseridos
   - O frontend exibe catálogo estático de 12 entries ("283 indexed profiles" é uma contagem display, não de dados)
   - O backend `useSupabase = false` impede queries reais ao Supabase
   - O runtime Hermes não foi acessível para contagem
   - O Paperclip não referencia o número 271

2. **A estrutura de agentes existe mas está vazia de dados:**
   - A tabela `agentes_empresariais` no migration tem definição de colunas confirmada
   - Mas não há INSERT seed nem confirmação de registros em banco remoto
   - O `useSupabase = false` no repo corrente significa que o Supabase não está configurado como fonte de verdade operacional

3. **O número "271" parece originar-se do frontend:**
   - `AgencyLibraryView.tsx:151` exibe "283 indexed profiles"
   - A soma das divisões no catalogofrontend resulta em 184 (discrepância não resolvida)
   - As 12 entries `AGENCY_SPECIALISTS` são fixas e estáticas; não conectadas ao backend ou runtime
   - Não há evidência no Paperclip de 271 agentes

4. **Recomendação para futura auditoria:**
   - Obter acesso ao banco de dados Supabase remoto (variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
   - Executar o CLI Hermes no ambiente adequado para contagem de agents ativos
   - Verificar se o número 271 refere-se a algo específico (talvez quantity de entries no catálogo Agency Agents fork, ou métrica antiga não mais mantida)
   - Conciliar identificadores estáveis entre frontend, backend e runtime se for reestabelecer a conexão entre essas fontes

---

## 5. Resumo Executivo

| Aspecto | Conclusão | Evidência |
|---|---|---|
| **Estrutura de agentes no banco** | Tabela `agentes_empresariais` existe (estrutura confirmada); **dados ausentes** | Migration SQL; `useSupabase = false` |
| **Contagem de 271 agentes** | **Não confirmada** em nenhuma fonte verificada | Frontend exibe "283 indexed profiles" (contagem display); migration sem dados; CLI não acessível |
| **Conexão frontend↔backend↔runtime** | **Não estabelecida** | Nenhum método de listagem de agentes no backend; `useSupabase = false`; CLI inacessível; catálogo frontend estático |
| **Paperclip referência** | Estrutura completa de agente; **número 271 não referenciado** | Documentação institucional do Paperclip |

> **Nota final:** Este documento não confirma nem rejeita a existência de 271 agentes. Apresenta unicamente o que pode ser verificado com as evidências atualmente disponíveis no repositório TokenizAi V2 `main` e suas limitações inerentes. Qualquer contagem ou conciliação além disso requer acesso a ambientes que não fazem parte desta auditoria (banco Supabase remoto, CLI Hermes executando, etc.).

---

## 6. Recomendações de Integração Hermes × Empresarial

| Tema | Ação Recomendada | Justificativa |
|---|---|---|
| **Identificador estável** | Adicionar campo `hermes_agent_id` ao `agentes_empresariais` e preenchê-lo ao criar perfil Hermes; usar como chave de referência entre Supabase e runtime | Evita desconexão entre cadastro empresarial e perfil operacional; resolve gap de conciliação |
| **Contagem real** | Quando tiver acesso ao Supabase remoto: `SELECT count(*) FROM agentes_empresariais WHERE hermes_agent_id IS NOT NULL`; comparar com `len(await HermesApi.listAgents())` | Estabelecer correspondência real entre fontes |
| **Catálogo Agency Agents vs Agentes Operacionais** | Distinguir claramente: `AGENCY_SPECIALISTS` (12 entries fixas, catálogo de skills) vs `agentes_empresariais` (registros empresariais) vs `HermesBotDto` (perfis runtime) | Evitar confusão entre conceitos; cada um tem responsabilidade separada |
| **Sincronização** | Quando `agentes_empresariais` for populado com dados reais: criar endpoint `GET /api/agentes/status-sync` que compara `hermes_agent_id` no banco vs runtime e reporta mismatches | Monitoramento contínuo de consistência entre fontes |
| **Frontend** | Atualizar `AgencyLibraryView` para consumir dados reais do backend (quando `useSupabase = true`) em vez de catálogo estático; remover contagem heurística "283" baseada em 12 entries fixas | UI refletir realidade em vez de dado simulado |

---