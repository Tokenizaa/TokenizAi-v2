# Baseline real de implementação — TokenizAi e Supabase

**Data da inspeção:** 21/11/2026 (horário local do projeto)  
**Repositório:** `Tokenizaa/TokenizAi`  
**Branch:** `main`  
**Projeto Supabase:** `nettocorp` (`udeglcdloehagljrrukj`)

Este documento registra fatos observados diretamente no GitHub e no banco Supabase conectado. Não substitui a especificação arquitetural; atualiza a linha de base com o estado operacional real.

## 1. Estado do repositório

- Branch padrão confirmada: `main`.
- `package.json`: React 19, Vite, Express 4.21, TypeScript e Gemini.
- Não há dependência `@supabase/supabase-js`, Drizzle ou Better Auth declarada no `package.json` inspecionado.
- `server.ts` usa `/tmp/nettoscorp-tokenizai-db.json` e `/tmp/nettoscorp-enterprise-sync.json`.
- `getCallerRole()` deriva o papel do header `X-NettosCorp-Role`, com fallback para `direcao_executiva`.
- `src/services/enterpriseService.ts` usa `localStorage` como cache e fila de sincronização.
- `src/services/adapters.ts` envia o papel selecionado pelo cliente em cada requisição.
- O health check apenas verifica a presença de variáveis Supabase; isso não comprova conexão ou persistência real.
- O seed frontend contém dados marcados como demonstrativos.

## 2. Estado real do banco

O projeto Supabase está em estado `ACTIVE_HEALTHY`, PostgreSQL 17.

Inventário observado em `public`:

- 75 tabelas.
- RLS habilitado nas 75 tabelas.
- Antes das correções desta sessão, havia 6 políticas permissivas em 3 tabelas do catálogo Agency Agents.
- 72 tabelas não tinham políticas RLS antes da correção; após a correção, as 75 tabelas ficaram sem políticas explícitas, aplicando negação por padrão para os papéis da API.
- 283 registros em `agency_agent_profiles`.
- 14 registros em `agents`.
- 4 departamentos e 14 posições.
- 6 papéis e 16 permissões associadas.
- 8 objetivos, 10 issues, 4 sessões, 4 execuções, 4 checkpoints e 4 passos de execução.
- 0 registros em `projects` e 0 em `skills`.
- 2 registros de empresa com o nome NettosCorp: um sem registros operacionais associados e outro contendo os dados operacionais acima. Nenhum registro foi removido; a duplicidade precisa de decisão de reconciliação antes de qualquer limpeza.
- 0 usuários em `auth.users` no momento da inspeção.

Os números acima são contagens diretas no banco, não estimativas de interface.

## 3. Correções de segurança executadas

### 3.1. Fechamento de políticas públicas do catálogo

As tabelas `agency_agent_profiles`, `agency_agent_selections` e `agency_agent_homologations` tinham políticas com papel `public`, condição `true` e permissão de escrita/leitura, além de grants amplos a `anon` e `authenticated`.

Foi aplicada a migration:

- Arquivo: `supabase/migrations/20261122002000_harden_agency_catalog_rls.sql`
- Migration Supabase: `harden_agency_catalog_rls`
- Commit GitHub: `fbd65e6e5d3957cdd0ba8b23c9793d0101d6ff9d`

A migration removeu as seis políticas permissivas e revogou privilégios de `anon`, `authenticated` e `PUBLIC` nessas três tabelas. Não removeu nem alterou registros.

Verificação posterior: consulta a `pg_policies` retornou zero políticas para as três tabelas.

### 3.2. Restrição de função SECURITY DEFINER

A função `public.rls_auto_enable()` é uma função de evento `ddl_command_end`, SECURITY DEFINER, usada pelo event trigger `ensure_rls` para habilitar RLS em novas tabelas públicas.

Ela estava com EXECUTE disponível a `anon` e `authenticated`. Foi revogado o EXECUTE direto desses papéis e de PUBLIC, preservando o event trigger.

- Arquivo: `supabase/migrations/20261122002500_restrict_rls_event_function.sql`
- Migration Supabase: `restrict_rls_event_function`
- Commit GitHub: `291cea9bd041de3d3e87aff492becca4b7c055fc`

Verificação posterior:
- `anon_can_execute = false`
- `authenticated_can_execute = false`
- `service_role_can_execute = true`
- O event trigger `ensure_rls` permanece habilitado.

## 4. Histórico de migrations

Antes desta intervenção, `list_migrations` retornava uma lista vazia, apesar de já existirem 75 tabelas e dados operacionais.

Após as correções, o Supabase registra:

- `20261122000942 — harden_agency_catalog_rls`
- `20261122000956 — restrict_rls_event_function`
- `20261122001109 — create_company_memberships`

As migrations SQL correspondentes estão versionadas no repositório.

A ausência anterior de histórico de migrations é uma pendência estrutural: o schema preexistente precisa ser reconciliado e colocado sob controle de versão sem recriar ou sobrescrever objetos existentes.


### 3.3. Vínculo entre usuário autenticado e organização

Foi criada a tabela `public.company_memberships`, sem alterar registros empresariais existentes.

- Arquivo: `supabase/migrations/20261122004000_create_company_memberships.sql`
- Migration Supabase: `create_company_memberships`
- Commit GitHub: `3abbd3b4bbdb655a6504a44406f804fb841e4072`

A tabela relaciona `auth.users`, `companies` e o papel da aplicação, com status de associação. RLS está habilitado. Usuários autenticados podem consultar apenas a própria associação; `anon` não tem SELECT. Não há políticas de escrita para usuários finais.

Verificação posterior:
- RLS habilitado.
- Uma política de SELECT próprio.
- `anon_select = false`.
- `authenticated_select = true`.

Nenhum usuário foi criado ou associado nesta etapa.

## 5. Bloqueios técnicos confirmados

1. O backend ainda não autentica usuários.
2. O papel de autoridade ainda pode ser falsificado pelo cliente via header.
3. O frontend ainda inicia com papel executivo local.
4. O estado principal do backend continua em arquivos temporários.
5. O frontend usa cache local como fallback de estado.
6. O backend não está conectado às tabelas Supabase observadas.
7. Ainda não há usuários Auth para associar a uma identidade organizacional.
8. A duplicidade de registros NettosCorp precisa ser reconciliada sem exclusão prematura.
9. As 75 tabelas estão em default-deny para API roles até que políticas tenant-aware sejam implementadas.
10. O modelo de domínio existente precisa ser reconciliado com as tabelas já criadas, especialmente `companies`, `agents`, `departments`, `positions`, `roles`, `role_permissions`, `sessions`, `executions` e `agency_agent_profiles`.

## 6. Próxima sequência de implementação

1. Definir e implementar identidade humana com Supabase Auth.
2. Criar vínculo explícito entre `auth.users`, empresa e papel organizacional, usando o registro NettosCorp que já possui dados operacionais.
3. Derivar autoridade exclusivamente no backend a partir da identidade validada e da associação organizacional.
4. Implementar cliente Supabase server-side e repositórios de domínio.
5. Mapear as entidades atuais às tabelas existentes; criar somente estruturas realmente ausentes.
6. Implementar políticas RLS tenant-aware, após validar o modelo de membership e os fluxos.
7. Migrar estado de demonstração e arquivos temporários para persistência durável sem apagar dados existentes.
8. Criar testes de autorização, isolamento entre empresas, persistência e recuperação.

## 7. Regra de segurança

Não criar políticas genéricas `USING (true)`, não confiar em `user_metadata` para autorização e não expor `service_role` ao frontend.

Acesso autenticado deve combinar identidade verificada, associação ativa à empresa e permissão específica. O papel hierárquico não concede poderes fora da política de autoridade da NettosCorp.

## 8. Evidência e limitações

Esta linha de base foi obtida por leitura do GitHub e consultas SQL read-only, exceto pelas duas migrations de hardening identificadas acima. Não houve exclusão ou alteração de dados empresariais existentes. Não houve deploy da aplicação nem alegação de que o frontend já consome o Supabase.
