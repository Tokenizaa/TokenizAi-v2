# Segurança e Governança

> **REVISÃO — 25/11/2026:** Este documento contém desenho anterior à migração, com referências ao Paperclip como origem de conceitos. Paperclip não participa da autenticação, autorização, execução, auditoria ou governança atuais do TokenizAi V2. A arquitetura vigente usa Supabase Auth/RLS e BFF próprio; execução de agentes é via Hermes. Toda referência ao Paperclip abaixo é histórica e não representa componente, integração ou requisito ativo.

> **Versão:** 1.0  
> **Data:** 21 de novembro de 2026  
> **Status:** **PROPOSTA** — Baseado em requisitos NettosCorp, Supabase Auth/RLS, Hermes e Agency Agents (referências históricas não operacionais)  
> **Responsável:** Hermes  
> **Autoridade:** Netto Farias (Founder)

---

## 1. Princípios de Segurança

| Princípio | Implementação |
|-----------|---------------|
| **Zero Trust** | Nenhuma confiança implícita — toda requisição autenticada, autorizada, auditada |
| **Least Privilege** | Agentes e usuários recebem apenas permissões necessárias para sua tarefa |
| **Defense in Depth** | Camadas: Network → Application → Data → Runtime → Audit |
| **Immutable Audit** | Logs append-only, tamper-evident, queryável |
| **Data Sovereignty** | Dados não saem do tenant sem autorização explícita |
| **Supply Chain Security** | Adapters, plugins, sandboxes assinados e verificados |

---

## 2. Identidade e Autenticação

### 2.1 Modelo de Identidade

| Tipo | Descrição | Credenciais |
|------|-----------|-------------|
| **Human User** | Pessoa física (Founder, Dev, PM) | Email + Password + MFA (TOTP/WebAuthn) |
| **Service Account** | Sistemas internos (CI/CD, bots) | JWT RS256 + rotação automática |
| **Agent Identity** | Instância de cargo (Agent) | Certificate mTLS + scoped token |
| **System** | Processos internos (scheduler, heartbeat) | Internal mTLS |

### 2.2 Autenticação (Better Auth + Extensões)

| Fluxo | Descrição |
|-------|-----------|
| **Web Login** | Email/password + TOTP → Session cookie (HttpOnly, SameSite=Lax) |
| **SSO/SAML** | Enterprise — Okta, Azure AD, Google Workspace |
| **Agent Bootstrap** | Setup token (short-lived) → Workspace login handoff → Session |
| **API Access** | Bearer token (JWT) com `agent_id`, `company_id`, `scopes`, `exp` |
| **MCP/OAuth** | Client credentials + PKCE para ferramentas externas |

### 2.3 Session Management

| Aspecto | Configuração |
|---------|--------------|
| **Session TTL** | 24h (web), 90d (remember me), 1h (agent bootstrap) |
| **Refresh** | Sliding window + rotation a cada 15min |
| **Concurrent Sessions** | Max 5 por user, 1 por agent |
| **Revocation** | Imediata (logout, password change, security event) |
| **Storage** | PostgreSQL (sessions table) + KV (cache) |

---

## 3. Autorização (RBAC + ABAC)

### 3.1 Hierarquia de Autoridade (modelo histórico; enforcement deve ocorrer no BFF e Supabase)

```text
Founder (Netto Farias)
    │
    ├── Hermes (Chefe de Gabinete Executivo) → coordenação operacional
    │
    ├── CEO (Diretor Executivo) → authority: ["approve", "delegate", "budget", "governance"]
    │   ├── CCO (Comercial/Vendas) → 9 agentes (sales)
    │   ├── CFO (Financeiro) → 5 agentes (finance)
    │   ├── CMO (Marketing/Aquisição) → 44 agentes (marketing, paid-media)
    │   ├── COO (Operações) → 13 agentes (project-management, support)
    │   ├── CPO (Produto/Design) → 16 agentes (product, design)
    │   ├── CTO (Tecnologia) → 111 agentes (engineering, security, testing, gis, spatial-computing, game-development)
    │   └── Summarizer (Apoio) → 0 agentes (função de apoio)
    │
    └── 267 especialistas da Agency Agents subordinados aos respectivos diretores
```

### 3.1b Hierarquia de Autoridade (NettosCorp Enterprise — Planejada, não implantada)

```text
Founder (Netto Farias)
    │
    ├── C-Level (CTO, CFO, CSO)          → authority: ["approve", "budget", "deploy", "governance"]
    │
    ├── Directors (Eng, Sec, Ops)        → authority: ["approve", "delegate", "budget"]
    │
    ├── Engineering Leads                → authority: ["execute", "delegate", "code_review"]
    │
    ├── Senior Agents (role-based)       → authority: ["execute", "delegate"]
    │
    └── Junior Agents                    → authority: ["execute"]
```

### 3.2 Matriz de Permissões (Role → Permissions)

| Recurso | Founder | C-Level | Director | Eng Lead | Senior Agent | Junior Agent |
|---------|---------|---------|----------|----------|--------------|--------------|
| **Agent Lifecycle** | CRUD | CRUD | CRUD | R | R | R |
| **Skill Catalog** | CRUD | CRUD | CRUD | R | R | R |
| **Task Dispatch** | CRUD | CRUD | CRUD | CRUD | Execute | Execute |
| **Delegation** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Budget Override** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Tool Access Grant** | ✅ | ✅ | ✅ | ✅ | Request | Request |
| **Sandbox Config** | ✅ | ✅ | ✅ | Read | Read | Read |
| **Audit Logs** | ✅ | ✅ | ✅ | Read | Read | ❌ |
| **Security Config** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **User Management** | ✅ | ✅ | ✅ | Read | ❌ | ❌ |

### 3.3 Clearance Levels (Multi-level Security)

| Nível | Descrição | Acesso a Dados | Exemplos |
|-------|-----------|----------------|----------|
| **Public** | Público | Documentação, skills públicas | Marketing agents |
| **Internal** | Padrão | Código, specs, tasks, agents | Eng, PM, Design |
| **Restricted** | Sensível | Segredos, budgets, security findings | Security, Finance, Legal |
| **Classified** | Máximo | Incident response, strategic plans | Founder, CISO, CSO |

### 3.4 Policy Engine (OPA/Rego)

```rego
# Exemplo: Agent pode delegar?
allow_delegate(agent, target_agent, task) {
  # 1. Agent tem authority "delegate"
  agent.authority[_] == "delegate"
  
  # 2. Target agent está na mesma company
  agent.company_id == target_agent.company_id
  
  # 3. Agent clearance >= target agent clearance
  clearance_rank(agent.clearance) >= clearance_rank(target_agent.clearance)
  
  # 4. Task não requer clearance acima do agent
  clearance_rank(task.required_clearance) <= clearance_rank(agent.clearance)
  
  # 5. Budget policy permite
  budget_allows(agent.company_id, task.estimated_cost)
}
```

---

## 4. Gestão de Segredos e Credenciais

### 4.1 Providers Suportados — inventário histórico do Paperclip (não operacional)

| Provider | Uso | Integração |
|----------|-----|------------|
| **1Password** | Primário (teams, CLI) | `@1password/sdk` + SDK nativo |
| **Env File** | Dev, CI | `dotenv` (override=false) |
| **Database** | Fallback, proposals | `company_secrets` table (encrypted) |
| **Vercel** | Vercel env vars | `vercel-connect.ts` |

### 4.2 Secret Proposals Flow

```
1. User/Agent solicita segredo → Cria proposal (company_secret_proposals)
         │
         ▼
2. Admin revisa → Aprova/Rejeita com justificativa
         │
         ▼
3. Se aprovado → Escrito no 1Password + DB (company_secrets)
         │
         ▼
4. Agent/Plugin consome → Runtime injection via secret-proposals.ts
         │
         ▼
5. Auditoria → Secret access events logados (secret_access_events)
```

### 4.3 Tool OAuth (GitHub, Slack, Discord, Google, etc.)

- **PKCE Flow** obrigatório para todos
- **State Management** para CSRF protection
- **Token Storage** criptografado (AES-256-GCM) no DB + sync 1Password
- **Rotation** automática a cada 90 dias ou sob demanda
- **Revocation** imediata via approval request

---

## 5. Segurança de Runtime (Agentes + Sandboxes)

### 5.1 Sandbox Isolation

| Camada | Implementação |
|--------|---------------|
| **Process** | Cada agent/plugin em worker/processo isolado |
| **Container** | Sandbox providers (9) — MicroVM, Container, Worker |
| **Network** | `none` | `restricted` (allowlist) | `full` (raro) |
| **Filesystem** | OverlayFS — read-only base + writable overlay |
| **Resources** | CPU, Memory, Disk, GPU limits via cgroups |
| **Syscalls** | Seccomp profile (deny by default) |

### 5.2 Agent Runtime Security

| Medida | Implementação |
|--------|---------------|
| **mTLS** | Todos canais ACP/MCP/RPC usam mutual TLS |
| **Token Scoping** | Agent tokens scoped to `company_id` + `agent_id` + `scopes` |
| **Tool Access** | Cada tool call validado contra `tool_access` policy |
| **Network Egress** | Allowlist de domínios/IPs por agent/profile |
| **File Access** | Workspace-scoped — não escapa do working_dir |

### 5.3 Supply Chain Security

| Artefato | Verificação |
|----------|-------------|
| **Adapters ACP** | Assinados (cosign/sigstore), verificados no bootstrap |
| **Plugins** | `npm install` em worker isolado, `package-lock.json` verificado |
| **Sandbox Images** | Assinadas (cosign), SBOM gerado (Syft), vulnerabilidades (Grype) |
| **MCP Servers** | Verificação de assinatura + allowlist de servers confiáveis |

---

## 6. Auditoria e Conformidade

### 6.1 Audit Log (Immutable)

```sql
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  actor_type      TEXT NOT NULL,           -- user|agent|system
  actor_id        UUID NOT NULL,
  action          TEXT NOT NULL,           -- create|update|delete|delegate|approve|spawn
  resource_type   TEXT NOT NULL,           -- agent|skill|task|workspace|budget|secret
  resource_id     UUID,
  before_state    JSONB,                   -- Estado anterior (para diff)
  after_state     JSONB,                   -- Estado posterior
  clearance_used  TEXT,                    -- Clearance do actor no momento
  authority_used  TEXT[],                  -- Authority exercida
  ip_address      INET,
  user_agent      TEXT,
  request_id      UUID,                    -- Correlation ID para tracing
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Particionado por mês, retenção 7 anos, imutável (não UPDATE/DELETE)
```

### 6.2 Eventos Auditados (Obrigatórios)

| Categoria | Ações |
|-----------|-------|
| **Agent Lifecycle** | hire, configure, activate, suspend, decommission |
| **Skill/Plugin** | install, update, uninstall, reconcile |
| **Task/Delegation** | create, assign, delegate, complete, fail, escalate |
| **Workspace** | create, snapshot, restore, destroy |
| **Budget** | create, update, alert, enforce, override |
| **Secrets** | propose, approve, access, rotate, revoke |
| **Auth** | login, logout, mfa_change, password_reset, session_revoke |
| **Admin** | user_invite, role_assign, policy_change, config_change |

### 6.3 Retenção e Acesso

| Nível | Retenção | Acesso |
|-------|----------|--------|
| **Operacional** | 90 dias | Eng Leads, Security |
| **Compliance** | 7 anos | Founder, CISO, Legal, Auditores |
| **Forense** | Indefinido (cold storage) | Founder, CISO, Legal (com aprovação) |

---

## 7. Governança Operacional

### 7.1 Approval Gates (Obrigatórios)

| Ação | Aprovação Necessária | Timeout |
|------|---------------------|---------|
| **Agent Deploy (prod)** | Eng Lead + Security | 24h |
| **Budget Override** | Director + Finance | 4h |
| **Secret Access (classified)** | CISO + Founder | 1h |
| **Tool Access Grant (restricted)** | Eng Lead + Security | 4h |
| **Sandbox Config Change** | Eng Lead | 24h |
| **Agent Delegation (cross-clearance)** | Authority Engine (auto) | Imediato |
| **Agent Delegation (cross-company)** | Founder + Legal | 24h |

### 7.2 Incident Response

| Severidade | SLA Resposta | SLA Resolução | Escalação |
|------------|--------------|---------------|-----------|
| **P0 (Critical)** | 15 min | 2 horas | Founder + CISO + Eng Lead |
| **P1 (High)** | 1 hora | 8 horas | Eng Lead + Security |
| **P2 (Medium)** | 4 horas | 24 horas | Eng Lead |
| **P3 (Low)** | 24 horas | 72 horas | Team Lead |

### 7.3 Compliance Checks (Automatizados)

| Check | Frequência | Falha → Ação |
|-------|------------|--------------|
| **Secret Rotation** | Diário | Alert + auto-create proposal |
| **Agent Certificate Expiry** | Diário | Auto-renew 30 dias antes |
| **Budget Threshold** | Horário | Alert + enforcement |
| **RLS Policy Drift** | Semanal | Alert + auto-repair |
| **Audit Log Integrity** | Diário | Hash verification + alert |
| **Sandbox Image Vulns** | Semanal | Grype scan + block deploy se CRITICAL |

---

## 8. Gaps e Riscos

| Gap | Risco | Mitigação |
|-----|-------|-----------|
| **OPA/Rego não implementado** | 🟡 Policy engine ausente | Implementar como service |
| **mTLS entre todos runtimes** | 🟡 Parcial (ACP ok, outros não) | Estender para MCP, Plugin RPC, Sandbox |
| **Secret rotation automática** | 🟡 Manual em partes | Automatizar via 1Password SDK |
| **Audit log tamper-proof** | 🟢 Append-only + hash chaining | Implementar hash chaining + Merkle tree |
| **Cross-company delegation policy** | 🔴 Não definida | Definir política + approval gate |
| **Agent impersonation protection** | 🟡 Token scoping básico | Short-lived tokens + bound credentials |

---

*Documento define modelo de segurança e governança para NettosCorp Enterprise. Requer aprovação do Founder (Netto Farias) para implementação. Authority Engine e Policy Engine são componentes novos a serem desenvolvidos.*