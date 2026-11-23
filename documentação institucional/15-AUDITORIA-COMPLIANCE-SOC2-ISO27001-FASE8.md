# Auditoria de Compliance SOC 2 / ISO 27001 — Fase 8: Governance Layer

> **Versão:** 1.0  
> **Data:** 22 de novembro de 2026  
> **Auditor:** ComplianceAuditor (Hermes) — Divisão: Security  
> **Autoridade:** Netto Farias (Founder, NettosCorp)  
> **Status:** FINAL — Baseado em evidências de código reais  
> **Frameworks:** SOC 2 Trust Services Criteria (CC6.1, CC7.1, CC7.2) + ISO/IEC 27001:2022 (Anexo A)  
> **Escopo:** Repositório TokenizAi (`/home/lg/workspace/NettosCorp/TokenizAi`, branch `main`, commit `61da94a`), backend `server.ts`, frontend `src/`, migrations Supabase e documentação institucional (`documentação institucional/09-SEGURANCA-E-GOVERNANCA.md`, `13-BASELINE-REAL-SUPABASE-E-SEGURANCA.md`, `AUDITORIA-FASES-1-8-REPORT.md`).

---

## 1. Escopo e Metodologia

### 1.1 Critérios em escopo

| ID | Critério SOC 2 | Descrição | Controle ISO 27001:2022 (mapeamento) | Foco da avaliação |
|----|----------------|-----------|--------------------------------------|-------------------|
| CC6.1 | Logical and Physical Access Controls | Acesso lógico restrito a pessoas autorizadas | A.9.2.1, A.9.2.2, A.9.2.3, A.9.4.2, A.9.4.3, A.8.2.1 | Autenticação, autorização, MFA, provisioning/deprovisioning, revisão de acesso |
| CC7.1 | Monitoring | Detecção de anomalias e monitoramento de sistemas | A.8.16, A.12.4, A.12.7 | Logs centralizados, alertas, integridade de logs de auditoria, retenção |
| CC7.2 | Incident Response | Resposta a incidentes de segurança | A.16.1.1–A.16.1.7, A.5.26, A.5.37 | Plano de resposta, playbooks, SLAs, pós-mortem, notificação |

### 1.2 Base de evidências

Toda afirmação de estado atual cita origem no formato `[EVIDENCIADO] arquivo:linha` ou `[AUSENTE]`, conforme a regra documental da NettosCorp (00-INDICE-E-GOVERNANCA.md, seção 3.1). O estado "implementado" só é declarado quando verificado no código/fonte; documentos de proposta (status PROPOSTA) contam como ausência de controle operacional.

### 1.3 Limitações

- Não há credenciais reais de Supabase/Auth configuradas; `0 usuários em auth.users` (13-BASELINE:39).
- Backend ainda não consome tabelas Supabase observadas (13-BASELINE:115).
- CI remoto do GitHub Actions bloqueado por cobrança financeira (12-EVIDENCIAS-E-PENDENCIAS:249); validações são de código-fonte, não de execução em produção.

---

## 2. Sumário Executivo

| Item | Resultado |
|------|-----------|
| **Data da avaliação** | 2026-11-22 |
| **Certificação alvo** | SOC 2 Type II + ISO/IEC 27001:2022 |
| **Readiness geral** | **16 / 100** |
| **Gaps críticos** | **6** (todos com controle referenciado) |
| **Gaps altos** | 4 |
| **Tempo estimado para auditoria-ready (controles implementados)** | 10–14 semanas |
| **Observação SOC 2 Type II** | Requer período de observação mínimo de 3–6 meses após os controles estarem operando, antes da emissão do laudo |

**Conclusão:** A Fase 8 (Governance Layer) existe apenas parcialmente — três migrations de hardening RLS no Supabase estão aplicadas (13-BASELINE:49–96), mas Authority Engine, Policy Engine (OPA/Rego), Approval Gateway, Audit Trail imutável e Compliance Dashboard estão ausentes (AUDITORIA-FASES-1-8-REPORT:192–209). O modelo de segurança (09-SEGURANCA-E-GOVERNANCA.md) está definido apenas como proposta. Nenhum dos três controles avaliados (CC6.1, CC7.1, CC7.2) opera efetivamente no backend hoje.

---

## 3. Gap Assessment por Controle

### 3.1 CC6.1 — Controle de Acesso Lógico (SOC 2) / A.9.2.x, A.9.4.x (ISO 27001)

**Status:** Não implementado — **Crítico**

**Estado atual (evidenciado):**
- Nenhuma autenticação de backend: `server.ts` não possui auth middleware (12-EVIDENCIAS-E-PENDENCIAS:87–89; servidor opera sem autenticação de usuários).
- Papel de autoridade derivado de header do cliente `X-NettosCorp-Role`, passível de falsificação; fallback para `direcao_executiva` (13-BASELINE:16; 09-SEGURANCA-E-GOVERNANCA: bloqueio #2).
- RBAC existe apenas no frontend: `src/domain/permissions.ts` com 11 roles (11-MATRIZ-DE-ADERENCIA:119), não imposto pelo servidor.
- Nenhum provedor de identidade (SSO/SAML), nenhum MFA, nenhum gerenciamento de sessão server-side.
- Estado do backend em arquivos temporários (`/tmp/*.json`) e cache `localStorage` do navegador (12-EVIDENCIAS-E-PENDENCIAS:20–22, 29).
- 0 usuários em `auth.users` do Supabase; nenhuma identidade organizacional vinculada (13-BASELINE:39, 116).
- Service accounts via chaves de placeholder em variáveis de ambiente (`server.ts:12–14`, `server.ts:231` Bearer `PAPERCLIP_API_KEY`).
- Não há processo de joiner/mover/leaver, revisão de acesso trimestral nem inventário de credenciais.

**Estado alvo:**
- Identidades individuais via IdP (SSO/SAML + Google Workspace/Azure AD/Okta) com MFA obrigatório para todo acesso humano.
- Autenticação e autorização impostas exclusivamente no backend (Better Auth / Supabase Auth + JWT), nunca confiando em headers do cliente.
- RBAC + ABAC (Policy Engine OPA/Rego) com least privilege, clearance levels (Public → Classified) e approval gates (09-SEGURANCA-E-GOVERNANCA:2–4, 3.3, 7.1).
- Provisioning e desprovisioning automáticos com SLA (ex.: acesso revogado em até 1h após desligamento), revisão de acesso trimestral com evidência, inventário e rotação de credenciais de serviço a cada 90 dias.

**Remediação:**
1. Implementar autenticação de backend (Better Auth + JWT + sessões) e remover confiança em `X-NettosCorp-Role` do cliente.
2. Publicar e consumir `@nettoscorp/auth` (Fase 1 já implementada localmente, não publicada — AUDITORIA-FASES-1-8-REPORT:42–54).
3. Implementar Policy Engine (OPA/Rego) para validação de `delegate()`, orçamento, acesso a dados e ferramentas (09-SEGURANCA:3.4).
4. Impor MFA para todos os usuários humanos e SSO para apps corporativos.
5. Estabelecer fluxo de provisioning/desprovisioning vinculado a RR.HH., com desligamento em ≤ 1 hora.
6. Executar revisão de acesso trimestral de todos os usuários e contas de serviço, com ata e evidência.
7. Inventariar service accounts, substituir credenciais compartilhadas por credenciais escopadas com rotação automática de 90 dias.

**Esforço estimado:** 3–4 semanas (depende da conclusão e publicação dos packages Fase 1).  
**Prioridade:** Crítica — auditor flagra imediatamente.

---

### 3.2 CC7.1 — Monitoramento de Sistemas (SOC 2) / A.8.16, A.12.4, A.12.7 (ISO 27001)

**Status:** Não implementado — **Crítico**

**Estado atual (evidenciado):**
- Nenhum sistema de log centralizado; backend emite apenas `console.log` (`server.ts:2168`).
- Nenhuma ferramenta de observabilidade (Sentry/OTel) — ausente na Matriz de Aderência (11-MATRIZ-DE-ADERENCIA:111–112).
- Nenhuma alerta configurada para falhas de autenticação, elevação de privilégio, drift de RLS ou eventos de segurança.
- Logs de auditoria existem apenas no frontend (hash FNV-1a em `localStorage`, `enterpriseService.ts:84–121`) — não são imutáveis, não sobrevivem ao navegador e não são protegidos contra adulteração.
- Não há retenção definida de logs de auditoria (alvo: 7 anos para compliance, per 09-SEGURANCA:6.3 — ainda proposta).
- Não há dashboard de compliance nem monitoramento de integridade de logs (09-SEGURANCA:7.3 lista checks planejados, não implementados).

**Estado alvo:**
- Logs estruturados e centralizados com redação de segredos (Pino ou equivalente), retenção mínima de 90 dias operacional e 7 anos compliance.
- Auditoria imutável server-side: append-only, hash-chained / Merkle, à prova de adulteração (09-SEGURANCA:6.1 design; 6.3 retenção).
- Alertas automáticos para: falhas de login, acesso negado, mudanças de papel/permissão, drift de política RLS, acesso a segredos classificados.
- Dashboard de governança/compliance com métricas de integridade e alertas de drift.

**Remediação:**
1. Substituir `console.log` por logging estruturado (Pino) com redação de PII/segredos, backend e frontend.
2. Centralizar logs em destino durável com política de retenção (90 dias operacional / 7 anos compliance).
3. Implementar audit trail imutável server-side (append-only + hash-chaining), conectado às tabelas Supabase com RLS tenant-aware.
4. Configurar regras de alerta e notificação para eventos de segurança (falhas de auth, elevação de privilégio, drift RLS).
5. Implementar verificação diária de integridade de logs de auditoria com alerta (09-SEGURANCA:7.3).
6. Construir dashboard de compliance com visibilidade de postura para a liderança.

**Esforço estimado:** 2–3 semanas.  
**Prioridade:** Alta.

---

### 3.3 CC7.2 — Resposta a Incidentes (SOC 2) / A.16.1.x, A.5.26, A.5.37 (ISO 27001)

**Status:** Parcial (apenas no papel) — **Alto**

**Estado atual (evidenciado):**
- Matriz de severidade e SLAs de resposta existe apenas como proposta na documentação: P0 15 min / 2h, P1 1h / 8h, P2 4h / 24h, P3 24h / 72h (09-SEGURANCA:7.2) — não operacionalizada.
- Não há plano de resposta a incidentes (IRP), playbooks, equipe de resposta definida, nem processo de pós-mortem.
- Não há registro de incidentes, cadeia de custódia de evidências, procedimento de contenção/erradicação/recuperação, nem notificação a reguladores/titulares.
- Não há treinamento, exercício de mesa (tabletop) anual, nem teste de recuperação.

**Estado alvo:**
- Política de Resposta a Incidentes aprovada, com escopo, papéis, severidades, SLAs e escalação.
- Runbooks para os principais cenários (vazamento de dados, comprometimento de conta, ransomware, vazamento de segredo).
- Registro de incidentes com evidências, pós-mortem obrigatório, lições aprendidas e feed de melhoria de controles.
- Procedimento de notificação a titulares e reguladores (ex.: LGPD/anacom dentro dos prazos legais).
- Teste de mesa anual e exercício de recuperação documentado.

**Remediação:**
1. Aprovar Política de Resposta a Incidentes (template na seção 5.3).
2. Definir equipe de resposta (IR lead, CISO, Eng Lead, Legal, Founder) e matriz de escalação por severidade.
3. Criar runbooks para os 4 cenários mais prováveis com etapas de detecção, contenção, erradicação, recuperação e comunicação.
4. Implementar registro de incidentes vinculado ao audit log imutável, com campo de evidências e status.
5. Adotar template de pós-mortem obrigatório para todo incidente P0/P1, com lições aprendidas e plano de ação.
6. Realizar exercício de mesa (tabletop) trimestral/semestral e registrar ata.
7. Definir procedimento de notificação a titulares de dados e autoridades, respeitando prazos legais.

**Esforço estimado:** 2–3 semanas (implantação inicial); maturação contínua.  
**Prioridade:** Alta.

---

## 4. Matriz de Coleta de Evidências

| Control ID | Controle | Tipo de evidência | Fonte | Método de coleta | Frequência |
|------------|----------|-------------------|-------|------------------|------------|
| CC6.1 | Controle de acesso lógico — autenticação e MFA | Relatórios de login, configuração do IdP, políticas de MFA | IdP (Okta/Azure AD/Google), Better Auth/Supabase Auth | Export via API / console do IdP | Mensal |
| CC6.1 | Provisioning e desprovisioning de usuários | Tickets de admissão/desligamento, logs de criação/remoção de contas | Sistema de RR.HH., IdP, log de auditoria | Webhook automatizado + export | Por evento |
| CC6.1 | Revisão de acesso trimestral | Ata de revisão, lista de usuários/contas de serviço aprovados | IAM, IdP, arquivo de revisão assinado | Export + assinatura do responsável | Trimestral |
| CC6.1 | Credenciais de serviço e rotação | Inventário de service accounts, logs de rotação de chaves | 1Password / Vault, logs de acesso a segredos | Export via API | Trimestral |
| CC7.1 | Logs de auditoria (append-only, hash-chained) | Arquivos de log, cadeia de hashes, relatórios de integridade | Banco de log central, sistema de SIEM | Export automatizado | Diário |
| CC7.1 | Alertas de segurança configurados | Lista de regras de alerta, canais de notificação, testes de disparo | Ferramenta de alerta/monitoramento | Export de configuração + evidência de teste | Mensal |
| CC7.1 | Retenção de logs | Política de retenção, comprovação de arquivamento/purga | Armazenamento de logs | Relatório do sistema | Mensal |
| CC7.2 | Plano de resposta a incidentes | Documento aprovado, versão, data, responsável | Repositório de políticas | Export do documento | Anual (ou na mudança) |
| CC7.2 | Registro de incidentes | Tickets de incidente, evidências, pós-mortems | Ferramenta de tickets, repositório de pós-mortem | Export | Por evento |
| CC7.2 | Exercício de mesa (tabletop) | Ata do exercício, cenário, participantes, lições aprendidas | Repositório de governança | Documento da reunião | Semestral |

**Princípio aplicado:** evidência coletada de forma automatizada sempre que possível; evidência manual é frágil e só aceita com revisão periódica (regra "Substance Over Checkbox" do Compliance Auditor).

---

## 5. Templates de Política

Cada política segue o padrão: dono por **função** (não por nome de pessoa), declarações numeradas e testáveis, exceções documentadas e mapeamento a controles de framework.

### 5.1 Política de Controle de Acesso

**Owner:** CISO / Security Lead  
**Approved By:** Founder (Netto Farias)  
**Effective Date:** YYYY-MM-DD  
**Review Cycle:** Annual  
**Last Reviewed:** YYYY-MM-DD

**Purpose**
Estabelecer requisitos obrigatórios para conceder, revisar e revogar acesso lógico a sistemas, dados e ambientes da NettosCorp, garantindo que apenas pessoas e serviços autorizados acessem recursos, com base em least privilege e need-to-know.

**Scope**
Aplica-se a todos os usuários humanos (funcionários, prestadores, terceiros), agentes autônomos, service accounts e sistemas que acessem dados, código, infraestrutura ou ferramentas operacionais da NettosCorp, incluindo ambientes de produção, staging e desenvolvimento.

**Policy Statements**
1. Todo acesso humano deve ser autenticado por identidade individual via IdP corporativo com MFA; credenciais compartilhadas são proibidas.
2. A autorização de acesso é concedida exclusivamente pelo servidor, com base em papel (RBAC) e atributos (ABAC); nunca se confia em declarações enviadas pelo cliente (headers, cookies ou tokens falsificados).
3. O princípio de least privilege se aplica: um usuário ou agente recebe apenas as permissões mínimas necessárias para sua função, com clearance compatível com a classificação do dado (Public → Classified).
4. O acesso a dados classificados ou restritos requer aprovação explícita do dono do dado e do CISO, registrada com justificativa e data de expiração.
5. Toda criação, alteração ou remoção de acesso gera evento no audit log imutável com ator, ação, recurso, carimbo de data/hora e IP.
6. O desligamento ou transferência de função deve revogar ou ajustar acessos em até 1 hora (desligamento) ou 1 dia útil (transferência).
7. Service accounts devem ter credenciais escopadas, rotação automática a cada 90 dias e acesso revisado trimestralmente.
8. Revisão de acesso de todos os usuários e contas de serviço é feita a cada trimestre, com ata documentada e evidência de aprovação.
9. Exceções a esta política exigem aprovação do Founder e do CISO, com justificativa, compensating control e data de expiração.

**Exceptions**
Solicitações de exceção são submetidas ao CISO com justificativa, risco aceito, compensating control e data de expiração máxima de 90 dias; renovações precisam de nova aprovação.

**Enforcement**
Violações geram revisão de acesso imediata, notificação ao dono do dado e ao CISO, e, em caso de acesso indevido confirmado, abertura de incidente conforme a Política de Resposta a Incidentes.

**Related Controls**
SOC 2 CC6.1, CC6.2, CC6.3; ISO 27001 A.9.2.1, A.9.2.2, A.9.2.3, A.9.4.1, A.9.4.2, A.9.4.3, A.8.2.1, A.8.2.2.

---

### 5.2 Política de Gestão de Mudanças (Change Management)

**Owner:** Engineering Lead / Release Manager  
**Approved By:** CTO  
**Effective Date:** YYYY-MM-DD  
**Review Cycle:** Annual  
**Last Reviewed:** YYYY-MM-DD

**Purpose**
Garantir que mudanças em sistemas, infraestrutura, código, configurações de segurança e políticas sejam autorizadas, testadas, revisadas e revertíveis, reduzindo o risco de introdução de vulnerabilidades ou interrupções não planejadas.

**Scope**
Aplica-se a mudanças em produção e staging: implantação de código, mudanças de infraestrutura, alterações de políticas RLS/segurança, atualização de dependências, mudanças de variáveis de ambiente e alterações no Policy/Approval Engine.

**Policy Statements**
1. Toda mudança em produção requer registro de pedido de mudança (RFC) com descrição, impacto, plano de rollback, data de implementação e aprovador.
2. Mudanças de segurança (RBAC, RLS, auth, criptografia, segredos) exigem aprovação do CISO ou Security Lead além do Eng Lead.
3. Toda mudança passa por revisão de código/pull request com pelo menos um revisor diferente do autor, antes da implantação.
4. Mudanças são testadas em ambiente não-produção (staging) com validação de segurança antes da liberação em produção.
5. Toda implantação tem plano de rollback documentado e testado, executável em caso de falha.
6. Mudanças de emergência podem ser implantadas com aprovação retroativa em até 24h, com pós-mortem obrigatório.
7. Toda mudança gera evento no audit log imutável com autor, aprovador, recurso alterado e carimbo de data/hora.
8. Acesso a segredos e credenciais não pode ser alterado sem aprovação do dono do segredo e registro no log de acesso a segredos.
9. Versões de dependências e imagens de container são versionadas e verificadas (assinatura/SBOM) antes do uso em produção.

**Exceptions**
Mudanças de emergência sem revisão prévia exigem justificativa escrita e aprovação retroativa do CTO ou Founder em até 24h.

**Enforcement**
Implantações não registradas ou não aprovadas são revertidas imediatamente e geram incidente de segurança para investigação.

**Related Controls**
SOC 2 CC7.2, CC8.1; ISO 27001 A.8.32, A.5.36, A.5.37, A.8.29, A.8.30, A.8.31.

---

### 5.3 Política de Resposta a Incidentes

**Owner:** CISO  
**Approved By:** Founder (Netto Farias)  
**Effective Date:** YYYY-MM-DD  
**Review Cycle:** Annual  
**Last Reviewed:** YYYY-MM-DD

**Purpose**
Definir como a NettosCorp detecta, responde, se recupera de e comunica incidentes de segurança, minimizando impacto, preservando evidências e cumprindo obrigações legais e contratuais.

**Scope**
Aplica-se a todos os eventos de segurança que afetem confidencialidade, integridade ou disponibilidade de dados, sistemas, agentes ou infraestrutura da NettosCorp, incluindo vazamento de dados, comprometimento de contas, vazamento de segredos e indisponibilidade por ataque.

**Policy Statements**
1. Existe um Plano de Resposta a Incidentes (IRP) aprovado, com papéis, responsabilidades, severidades, SLAs e escalação definidos.
2. Todo funcionário ou agente que detectar um incidente de segurança deve reportá-lo imediatamente ao CISO ou ao canal de segurança designado.
3. Incidentes são classificados por severidade (P0–P3) com SLAs de resposta e resolução: P0 resposta ≤ 15 min / resolução ≤ 2h; P1 ≤ 1h / ≤ 8h; P2 ≤ 4h / ≤ 24h; P3 ≤ 24h / ≤ 72h.
4. Todo incidente gera registro com número, descrição, severidade, datas, responsáveis, ações tomadas e evidências preservadas, vinculado ao audit log imutável.
5. Incidentes P0/P1 exigem pós-mortem obrigatório em até 5 dias úteis, com lições aprendidas, plano de ação e responsável por cada item.
6. Vazamento ou suspeita de vazamento de dados pessoais aciona procedimento de notificação a titulares e autoridades dentro dos prazos legais aplicáveis (ex.: LGPD).
7. É proibido destruir, alterar ou ocultar evidências de incidente; a cadeia de custódia é mantida pelo CISO.
8. Exercício de mesa (tabletop) é realizado no mínimo semestralmente, com ata registrada e melhorias tratadas como itens de ação.
9. A política é revisada anualmente ou após qualquer incidente P0/P1, com atualização de runbooks e SLAs.

**Exceptions**
Nenhuma exceção à obrigação de reportar ou preservar evidências; exceções de SLA exigem aprovação do Founder com justificativa documentada.

**Enforcement**
Não reportar incidente conhecido, adulterar evidências ou descumprir SLAs sem exceção aprovada gera processo disciplinar e revisão de acessos.

**Related Controls**
SOC 2 CC7.2, CC7.3; ISO 27001 A.16.1.1–A.16.1.7, A.5.26, A.5.37, A.5.30.

---

## 6. Plano de Remediação Priorizado por Risco

| Prioridade | ID | Controle(s) | Gap | Ação de remediação | Responsável | Prazo | Esforço |
|------------|----|-------------|-----|-------------------|-------------|-------|---------|
| P0 | GAP-01 | CC6.1 | Nenhuma autenticação de backend; papel falsificável via header do cliente | Implementar Better Auth/Supabase Auth + JWT; remover confiança em `X-NettosCorp-Role`; vincular `auth.users` à associação organizacional | Platform Engineer / Security | 2 semanas | 3–4 dias |
| P0 | GAP-02 | CC6.1 | RBAC apenas no frontend; nenhum least privilege server-side | Impor RBAC+ABAC no backend com clearance levels e policy engine (OPA/Rego) | Security Lead / Eng Lead | 3 semanas | 5 dias |
| P0 | GAP-03 | CC6.1 / CC7.1 | Nenhum audit trail imutável server-side; logs apenas `console.log` e frontend FNV-1a | Implementar logging estruturado (Pino) com redação + audit trail append-only hash-chained com retenção 90d/7 anos | Security Lead | 2 semanas | 4 dias |
| P0 | GAP-04 | CC7.1 | Sem alertas de segurança nem monitoramento de integridade de logs | Configurar alertas (falhas de auth, elevação de privilégio, drift RLS) e verificação diária de integridade de logs | Security Lead / Ops | 2 semanas | 3 dias |
| P1 | GAP-05 | CC6.1 | Sem MFA, sem SSO, sem provisioning/desprovisioning de acesso | Impor MFA para todos os usuários humanos; integrar IdP corporativo; fluxo joiner/leaver com revogação ≤ 1h | Security Lead / IT | 3 semanas | 5 dias |
| P1 | GAP-06 | CC6.1 | Sem revisão de acesso trimestral nem inventário de service accounts | Executar revisão de acesso trimestral com ata; inventariar service accounts com rotação de credenciais a cada 90 dias | Security Lead | 3 semanas | 4 dias |
| P1 | GAP-07 | CC7.2 | Sem plano de resposta a incidentes operacionalizado | Aprovar Política de Resposta a Incidentes; definir equipe, severidades e SLAs; criar registro de incidentes | CISO / Founder | 2 semanas | 3 dias |
| P1 | GAP-08 | CC7.2 | Sem runbooks nem pós-mortem | Criar runbooks para 4 cenários principais; template de pós-mortem obrigatório para P0/P1; exercício de mesa semestral | CISO / Eng Lead | 3 semanas | 5 dias |
| P2 | GAP-09 | CC6.1 / CC7.1 | Policy Engine (OPA/Rego) e Approval Gateway ausentes | Implementar policy engine para validação de delegate(), orçamento, acesso a dados e ferramentas; gates de aprovação P0–P3 | Platform Engineer | 4 semanas | 8 dias |
| P2 | GAP-10 | CC7.1 | Sem dashboard de compliance nem retenção consolidada | Construir dashboard de governança com métricas de integridade, alertas de drift e retenção de logs | Ops / Security | 3 semanas | 5 dias |

**Critério de risco aplicado:** gaps que permitem acesso não autorizado, adulteração de logs ou ausência de detecção são tratados como P0 porque um auditor de SOC 2 os flagra imediatamente e invalidam o laudo (regra "Substance Over Checkbox").

---

## 7. Critério de Aceitação (Rastreabilidade de Gaps)

Cada gap relatado nesta auditoria contém obrigatoriamente:

| Campo | Exemplo (CC6.1) |
|-------|-----------------|
| **Controle referenciado** | SOC 2 CC6.1; ISO 27001 A.9.2.1, A.9.2.2, A.9.4.2 |
| **Estado atual** | Sem auth de backend; papel por header `X-NettosCorp-Role` falsificável (`server.ts:96`, `13-BASELINE:16`) |
| **Estado alvo** | Identidades individuais via IdP + MFA, auth e autorização impostas exclusivamente no backend |
| **Passos de remediação** | 7 passos listados na seção 3.1 |
| **Esforço estimado** | 3–4 semanas |

Este critério foi verificado para os três controles em escopo (CC6.1, CC7.1, CC7.2) no presente relatório.

---

## 8. Próximos Passos (Fase 8 — Governance Layer)

1. Aprovar as três políticas da seção 5 com o Founder (autoridade necessária para decisão arquitetural, 00-INDICE-E-GOVERNANCA:3.3).
2. Concluir a Fase 1 (publicar `@nettoscorp/shared`, `@nettoscorp/db`, `@nettoscorp/auth` no registry privado e configurar `pnpm-workspace.yaml` no root — AUDITORIA-FASES-1-8-REPORT:289–294).
3. Executar o plano de remediação na ordem P0 → P1 → P2, com re-teste de cada controle antes de considerar fechado (auditor interno prévio à auditoria externa).
4. Coletar evidências de operação dos controles por período mínimo de 3–6 meses antes de agendar a auditoria SOC 2 Type II.

---

*Relatório baseado exclusivamente em inspeção de código-fonte, migrations e documentação institucional do repositório TokenizAi. Não envolve execução em produção nem credenciais reais. Classificação de evidências segue a regra documental da NettosCorp (EVIDENCIADO / AUSENTE / PLANEJADO / NÃO VERIFICADO).*