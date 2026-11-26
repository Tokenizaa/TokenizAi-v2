# Deploy da TokenizAi na Vercel

## Arquitetura publicada

- Frontend: Vite, publicado como arquivos estáticos em `dist/`.
- API empresarial: Express, exposto por `api/[...path].ts` como Vercel Function.
- Persistência empresarial: Supabase. O backend serverless não usa JSON local como armazenamento.
- Runtime Hermes: permanece no host local. A Vercel não executa o binário Hermes do computador do fundador.

## Variáveis obrigatórias no projeto Vercel

Configurar nos ambientes Production, Preview e Development conforme o uso:

| Variável | Finalidade | Exposição |
|---|---|---|
| `SUPABASE_URL` | URL do projeto Supabase correto da TokenizAi | Backend |
| `SUPABASE_ANON_KEY` | Chave publicável/anon para validar sessões e criar clientes de usuário | Backend |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso privilegiado do repositório empresarial | Backend, segredo |
| `VITE_SUPABASE_URL` | URL do Supabase usada pelo frontend | Navegador |
| `VITE_SUPABASE_ANON_KEY` | Chave publicável usada pelo frontend | Navegador |
| `TOKENIZAI_SESSION_SECRET` | Assinatura de sessões operacionais | Backend, segredo |
| `TOKENIZAI_ADMIN_PASSCODE` | Proteção das operações administrativas legadas | Backend, segredo |
| `FOUNDER_EMAIL` | Identidade autorizada do fundador | Backend |

**Nunca** cadastrar `SUPABASE_SERVICE_ROLE_KEY`, `TOKENIZAI_SESSION_SECRET` ou `TOKENIZAI_ADMIN_PASSCODE` com prefixo `VITE_`.

## Comportamento de segurança

- A inicialização serverless falha com HTTP 503 quando o Supabase não está configurado ou não pode carregar o estado empresarial.
- Gravações empresariais aguardam a sincronização com Supabase antes de responder.
- Persistência em arquivo local é desabilitada no ambiente Vercel.
- Hermes é reportado como desconectado na Vercel até a implantação de uma ponte remota autenticada. Não apontar a Vercel para `/home/lg/.local/bin/hermes`.

## Critérios para homologar produção

1. Todas as variáveis acima configuradas com credenciais do projeto Supabase correto.
2. Confirmar que as tabelas e migrations do Control Plane estão aplicadas nesse projeto.
3. Validar login, leitura, criação e atualização de projeto diretamente na URL Vercel.
4. Validar que o estado persiste após uma nova instância serverless.
5. Validar a ponte Hermes separadamente antes de declarar gestão de agentes operacional.

A criação do projeto Vercel e o build não equivalem à homologação funcional do backend.
