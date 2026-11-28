-- ============================================================================
-- Seed completo INITIAL_ENTERPRISE_DATA para aplicar via SQL Editor do Supabase
-- Projeto: udeglcdloehagljrrukj (nettocorp)
-- Copie e cole no SQL Editor do painel Supabase
-- ============================================================================

-- ============================================================================
-- Empresas
-- ============================================================================
INSERT INTO empresas (nome, codigo, cnpj, email, telefone, plano, status, created_at, updated_at) VALUES
('NettosCorp', 'NTZ', '00.000.000/0001-00', 'contato@nettoscorp.com.br', '(11) 99000-0000', 'empresarial', 'ativa', now(), now()),
('Grupo Atlântico Logística', 'GAL', '18.492.310/0001-42', 'contato@atlanticolog.com.br', '(11) 98421-3309', 'empresarial', 'ativa', now(), now()),
('Vértice Distribuidora', 'VRT', '29.104.881/0001-19', 'contato@verticedistribuidora.com.br', '(31) 99104-8820', 'profissional', 'ativa', now(), now()),
('Banco Horizonte Digital', 'BHD', '41.773.205/0001-08', 'contato@bancohorizonte.com.br', '(11) 97210-4411', 'empresarial', 'ativa', now(), now()),
('Kora Saúde Corporativa', 'KSC', '12.665.910/0001-75', 'contato@korasaude.com.br', '(21) 98872-1904', 'profissional', 'ativa', now(), now()),
('AgroSul Cooperativa', 'ASC', '07.981.334/0001-60', 'contato@agrosulcoop.com.br', '(41) 99654-7120', 'profissional', 'ativa', now(), now())
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================================
-- Departamentos (referenciam empresas.id via subquery)
-- ============================================================================
WITH emp AS (SELECT id FROM empresas WHERE codigo = 'NTZ')
INSERT INTO departamentos (id, nome, codigo, descricao, departamento_pai_id, empresa_id, created_at, updated_at)
SELECT * FROM (VALUES
  ('dep-01', 'Diretoria Executiva', 'DIR', 'Liderança estratégica e governança corporativa', NULL, (SELECT id FROM emp), now(), now()),
  ('dep-02', 'Engenharia de Software', 'ENG', 'Desenvolvimento de produtos e plataformas', NULL, (SELECT id FROM emp), now(), now()),
  ('dep-03', 'Operações & SRE', 'OPS', 'Operações, infraestrutura e confiabilidade', NULL, (SELECT id FROM emp), now(), now()),
  ('dep-04', 'Comercial & Revenue Ops', 'COM', 'Vendas, receita e operações comerciais', NULL, (SELECT id FROM emp), now(), now())
) AS v(id, nome, codigo, descricao, departamento_pai_id, empresa_id, created_at, updated_at)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Perfis Empresariais (Usuários) - referenciam departamentos e empresas
-- ============================================================================
WITH emp AS (SELECT id FROM empresas WHERE codigo = 'NTZ'),
     dep AS (SELECT id FROM departamentos WHERE codigo IN ('DIR','ENG','OPS','COM') AND empresa_id = (SELECT id FROM emp))
INSERT INTO perfis_empresariais (id, email, nome, role, departamento_id, empresa_id, status, avatar_url, ultimo_acesso, created_at, updated_at)
SELECT * FROM (VALUES
  ('usr-01', 'helena@tokenizai.com.br', 'Helena Vasconcelos', 'Diretoria Executiva', (SELECT id FROM departamentos WHERE codigo = 'DIR' AND empresa_id = (SELECT id FROM emp)), (SELECT id FROM emp), 'Ativo', '/src/assets/images/avatar_exec_director_1795391391515.jpg', now(), now(), now()),
  ('usr-02', 'rafael@tokenizai.com.br', 'Rafael Mendes', 'Gestor Operacional', (SELECT id FROM departamentos WHERE codigo = 'ENG' AND empresa_id = (SELECT id FROM emp)), (SELECT id FROM emp), 'Ativo', '/src/assets/images/avatar_tech_lead_1795391391883.jpg', now(), now(), now()),
  ('usr-03', 'mariana@tokenizai.com.br', 'Mariana Costa', 'Financeiro', (SELECT id FROM departamentos WHERE codigo = 'OPS' AND empresa_id = (SELECT id FROM emp)), (SELECT id FROM emp), 'Ativo', '/src/assets/images/avatar_ops_manager_1795391391772.jpg', now(), now(), now()),
  ('usr-04', 'camila@tokenizai.com.br', 'Camila Duarte', 'Comercial & CRM', (SELECT id FROM departamentos WHERE codigo = 'COM' AND empresa_id = (SELECT id FROM emp)), (SELECT id FROM emp), 'Ativo', NULL, now(), now(), now())
) AS v(id, email, nome, role, departamento_id, empresa_id, status, avatar_url, ultimo_acesso, created_at, updated_at)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- Clientes
-- ============================================================================
INSERT INTO clientes (id, nome, segmento, cnpj, contato_principal, email, telefone, gerente_conta, status, mrr_brl, ltv_brl, since, produtos, created_at, updated_at)
SELECT * FROM (VALUES
  ('cli-01', 'Grupo Atlântico Logística', 'Logística & Transporte', '18.492.310/0001-42', 'Eduardo Siqueira', 'eduardo.siqueira@atlanticolog.com.br', '(11) 98421-3309', 'Helena Vasconcelos', 'Ativo', 18500, 342000, '2025-03-14', ARRAY['TokenizAi Core Enterprise', 'Orquestração Hermes Dedicada'], now(), now()),
  ('cli-02', 'Vértice Distribuidora', 'Varejo & Distribuição', '29.104.881/0001-19', 'Patrícia Alencar', 'patricia@verticedistribuidora.com.br', '(31) 99104-8820', 'Mariana Costa', 'Em Implantação', 12900, 168000, '2026-04-02', ARRAY['Suite Automação Fiscal IA', 'Suporte Gerenciado 24x5'], now(), now()),
  ('cli-03', 'Banco Horizonte Digital', 'Serviços Financeiros', '41.773.205/0001-08', 'Lucas Bittencourt', 'lbittencourt@bancohorizonte.com.br', '(11) 97210-4411', 'Helena Vasconcelos', 'Ativo', 32000, 520000, '2024-11-10', ARRAY['TokenizAi Core Enterprise', 'Auditoria & Governança SOC2', 'Orquestração Hermes Dedicada'], now(), now()),
  ('cli-04', 'Kora Saúde Corporativa', 'Saúde & Benefícios', '12.665.910/0001-75', 'Dra. Renata Frota', 'rfrota@korasaude.com.br', '(21) 98872-1904', 'Camila Duarte', 'Em Risco', 9400, 214000, '2025-07-21', ARRAY['TokenizAi CRM Corporativo'], now(), now()),
  ('cli-05', 'AgroSul Cooperativa', 'Agronegócio', '07.981.334/0001-60', 'Marcelo Tavares', 'marcelo.tavares@agrosulcoop.com.br', '(41) 99654-7120', 'Rafael Mendes', 'Ativo', 14800, 229000, '2026-01-19', ARRAY['TokenizAi Core Enterprise', 'Suite Previsão de Demanda'], now(), now())
) AS v(id, nome, segmento, cnpj, contato_principal, email, telefone, gerente_conta, status, mrr_brl, ltv_brl, since, produtos, created_at, updated_at)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Interações de Cliente
-- ============================================================================
INSERT INTO interacoes_de_cliente (id, cliente_id, data, canal, autor, nota, created_at)
SELECT * FROM (VALUES
  ('int-1', 'cli-01', '20/11/2026', 'Reunião', 'Helena Vasconcelos', 'Alinhamento mensal de entregas do Portal B2B e expansão para filial Sul.', now()),
  ('int-2', 'cli-01', '08/11/2026', 'Proposta', 'Mariana Costa', 'Enviado aditivo para módulo de conciliação automática.', now()),
  ('int-3', 'cli-02', '21/11/2026', 'Suporte', 'Rafael Mendes', 'Validação conjunta dos últimos 120 XMLs de entrada interestadual.', now()),
  ('int-4', 'cli-03', '19/11/2026', 'Reunião', 'Helena Vasconcelos', 'Revisão de arquitetura multi-região e metas de SLA para Q1/2027.', now()),
  ('int-5', 'cli-04', '17/11/2026', 'E-mail', 'Camila Duarte', 'Fatura de novembro em aberto há 9 dias; contato financeiro acionado.', now()),
  ('int-6', 'cli-05', '18/11/2026', 'Reunião', 'Rafael Mendes', 'Demonstração do conector SAP Business One aprovada pela diretoria.', now())
) AS v(id, cliente_id, data, canal, autor, nota, created_at)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Projetos
-- ============================================================================
INSERT INTO projetos (id, codigo, nome, cliente_id, cliente_nome, stage, owner_name, owner_avatar, start_date, end_date, progress, budget_brl, spent_brl, deliverables, activities, created_at, updated_at)
SELECT * FROM (VALUES
  ('proj-01', 'PRJ-204', 'Portal B2B & Billing Recorrente', 'cli-01', 'Grupo Atlântico Logística', 'Em Execução', 'Rafael Mendes', '/src/assets/images/avatar_tech_lead_1795391391883.jpg', '2026-10-05', '2026-12-12', 68, 145000, 92400,
   '[{"id":"del-1","title":"Arquitetura de cobrança recorrente e webhooks","owner":"Rafael Mendes","dueDate":"2026-10-28","done":true},{"id":"del-2","title":"Painel do cliente e emissão de faturas NF-e","owner":"Camila Duarte","dueDate":"2026-11-18","done":true},{"id":"del-3","title":"Homologação de conciliação bancária","owner":"Rafael Mendes","dueDate":"2026-11-29","done":false},{"id":"del-4","title":"Go-live assistido e treinamento financeiro","owner":"Mariana Costa","dueDate":"2026-12-10","done":false}]'::jsonb,
   '[{"id":"act-1","author":"Rafael Mendes","date":"20/11/2026","summary":"Webhooks de compensação Pix validados em sandbox bancário."},{"id":"act-2","author":"Mariana Costa","date":"15/11/2026","summary":"Aprovação da etapa de UX pelo CFO do Grupo Atlântico."}]'::jsonb,
   now(), now()),
  ('proj-02', 'PRJ-209', 'Automação de Triagem Fiscal com IA', 'cli-02', 'Vértice Distribuidora', 'Revisão', 'Mariana Costa', '/src/assets/images/avatar_ops_manager_1795391391772.jpg', '2026-09-18', '2026-11-28', 88, 98000, 81200,
   '[{"id":"del-5","title":"Extração estruturada de XML e DANFE","owner":"Rafael Mendes","dueDate":"2026-10-15","done":true},{"id":"del-6","title":"Regras de conferência CFOP e alíquotas","owner":"Mariana Costa","dueDate":"2026-11-05","done":true},{"id":"del-7","title":"Auditoria final com equipe contábil","owner":"Mariana Costa","dueDate":"2026-11-26","done":false}]'::jsonb,
   '[{"id":"act-3","author":"Mariana Costa","date":"21/11/2026","summary":"Taxa de acerto em lote de 1.200 notas atingiu 99,1% sem revisão manual."}]'::jsonb,
   now(), now()),
  ('proj-03', 'PRJ-215', 'Migração Cloud & Observabilidade Multi-região', 'cli-03', 'Banco Horizonte Digital', 'Descoberta', 'Helena Vasconcelos', '/src/assets/images/avatar_exec_director_1795391391515.jpg', '2026-11-12', '2027-01-30', 24, 210000, 34000,
   '[{"id":"del-8","title":"Mapeamento de latência e dependências críticas","owner":"Rafael Mendes","dueDate":"2026-11-27","done":false},{"id":"del-9","title":"Plano de cutover sem indisponibilidade","owner":"Helena Vasconcelos","dueDate":"2026-12-08","done":false}]'::jsonb,
   '[{"id":"act-4","author":"Helena Vasconcelos","date":"19/11/2026","summary":"Kickoff técnico concluído com diretoria de tecnologia do cliente."}]'::jsonb,
   now(), now()),
  ('proj-04', 'PRJ-198', 'Central de Relacionamento & CRM Unificado', 'cli-04', 'Kora Saúde Corporativa', 'Entregue', 'Camila Duarte', NULL, '2026-08-01', '2026-11-02', 100, 112000, 104500,
   '[{"id":"del-10","title":"Base unificada de beneficiários e contratos","owner":"Camila Duarte","dueDate":"2026-09-20","done":true},{"id":"del-11","title":"Painel executivo de SLAs e renovação","owner":"Mariana Costa","dueDate":"2026-10-29","done":true}]'::jsonb,
   '[{"id":"act-5","author":"Camila Duarte","date":"02/11/2026","summary":"Termo de aceite assinado. Cliente convertido para plano de sustentação mensal."}]'::jsonb,
   now(), now()),
  ('proj-05', 'PRJ-218', 'Integração ERP & Previsão de Demanda', 'cli-05', 'AgroSul Cooperativa', 'Em Execução', 'Rafael Mendes', '/src/assets/images/avatar_tech_lead_1795391391883.jpg', '2026-10-22', '2027-01-15', 45, 130000, 52800,
   '[{"id":"del-12","title":"Conector bidirecional com SAP Business One","owner":"Rafael Mendes","dueDate":"2026-11-24","done":true},{"id":"del-13","title":"Modelo sazonal de reposição por filial","owner":"Mariana Costa","dueDate":"2026-12-18","done":false}]'::jsonb,
   '[{"id":"act-6","author":"Rafael Mendes","date":"18/11/2026","summary":"Sincronização incremental reduzida de 40 min para 3 min."}]'::jsonb,
   now(), now())
) AS v(id, codigo, nome, cliente_id, cliente_nome, stage, owner_name, owner_avatar, start_date, end_date, progress, budget_brl, spent_brl, deliverables, activities, created_at, updated_at)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Entregas de Projeto
-- ============================================================================
INSERT INTO entregas_de_projeto (id, projeto_id, titulo, responsavel, data_vencimento, concluida, created_at)
SELECT * FROM (VALUES
  ('del-1', 'proj-01', 'Arquitetura de cobrança recorrente e webhooks', 'Rafael Mendes', '2026-10-28', true, now()),
  ('del-2', 'proj-01', 'Painel do cliente e emissão de faturas NF-e', 'Camila Duarte', '2026-11-18', true, now()),
  ('del-3', 'proj-01', 'Homologação de conciliação bancária', 'Rafael Mendes', '2026-11-29', false, now()),
  ('del-4', 'proj-01', 'Go-live assistido e treinamento financeiro', 'Mariana Costa', '2026-12-10', false, now()),
  ('del-5', 'proj-02', 'Extração estruturada de XML e DANFE', 'Rafael Mendes', '2026-10-15', true, now()),
  ('del-6', 'proj-02', 'Regras de conferência CFOP e alíquotas', 'Mariana Costa', '2026-11-05', true, now()),
  ('del-7', 'proj-02', 'Auditoria final com equipe contábil', 'Mariana Costa', '2026-11-26', false, now()),
  ('del-8', 'proj-03', 'Mapeamento de latência e dependências críticas', 'Rafael Mendes', '2026-11-27', false, now()),
  ('del-9', 'proj-03', 'Plano de cutover sem indisponibilidade', 'Helena Vasconcelos', '2026-12-08', false, now()),
  ('del-10', 'proj-04', 'Base unificada de beneficiários e contratos', 'Camila Duarte', '2026-09-20', true, now()),
  ('del-11', 'proj-04', 'Painel executivo de SLAs e renovação', 'Mariana Costa', '2026-10-29', true, now()),
  ('del-12', 'proj-05', 'Conector bidirecional com SAP Business One', 'Rafael Mendes', '2026-11-24', true, now()),
  ('del-13', 'proj-05', 'Modelo sazonal de reposição por filial', 'Mariana Costa', '2026-12-18', false, now())
) AS v(id, projeto_id, titulo, responsavel, data_vencimento, concluida, created_at)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Atividades de Projeto
-- ============================================================================
INSERT INTO atividades_de_projeto (id, projeto_id, autor, data, resumo, created_at)
SELECT * FROM (VALUES
  ('act-1', 'proj-01', 'Rafael Mendes', '20/11/2026', 'Webhooks de compensação Pix validados em sandbox bancário.', now()),
  ('act-2', 'proj-01', 'Mariana Costa', '15/11/2026', 'Aprovação da etapa de UX pelo CFO do Grupo Atlântico.', now()),
  ('act-3', 'proj-02', 'Mariana Costa', '21/11/2026', 'Taxa de acerto em lote de 1.200 notas atingiu 99,1% sem revisão manual.', now()),
  ('act-4', 'proj-03', 'Helena Vasconcelos', '19/11/2026', 'Kickoff técnico concluído com diretoria de tecnologia do cliente.', now()),
  ('act-5', 'proj-04', 'Camila Duarte', '02/11/2026', 'Termo de aceite assinado. Cliente convertido para plano de sustentação mensal.', now()),
  ('act-6', 'proj-05', 'Rafael Mendes', '18/11/2026', 'Sincronização incremental reduzida de 40 min para 3 min.', now())
) AS v(id, projeto_id, autor, data, resumo, created_at)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Negócios (Deals)
-- ============================================================================
INSERT INTO negocios (id, titulo, cliente_id, cliente_nome, stage, value_brl, probability, owner_name, expected_close, next_step, notes, created_at, updated_at)
SELECT * FROM (VALUES
  ('deal-01', 'Expansão Automação Logística Sul', 'cli-01', 'Grupo Atlântico Logística', 'Negociação', 84000, 80, 'Helena Vasconcelos', '2026-12-05', 'Revisão jurídica da cláusula de SLA', ARRAY['Proposta comercial revisada com desconto anual de 8%.'], now(), now()),
  ('deal-02', 'Implantação Núcleo IA Atendimento', 'cli-05', 'AgroSul Cooperativa', 'Proposta', 62000, 60, 'Mariana Costa', '2026-12-18', 'Apresentação de ROI para conselho cooperado', ARRAY['Escopo contempla 3 agentes especialistas no Hermes.'], now(), now()),
  ('deal-03', 'Plataforma Compliance & Auditoria Contínua', 'cli-03', 'Banco Horizonte Digital', 'Qualificação', 148000, 40, 'Helena Vasconcelos', '2027-01-20', 'Workshop técnico com CISO do cliente', ARRAY['Demanda originada após auditoria trimestral do Banco Central.'], now(), now()),
  ('deal-04', 'Portal de Fornecedores & Cotações', 'cli-02', 'Vértice Distribuidora', 'Prospecção', 49000, 25, 'Camila Duarte', '2027-02-10', 'Mapeamento de fluxo de compras atual', ARRAY['Primeiro contato positivo após resultado da triagem fiscal.'], now(), now()),
  ('deal-05', 'Renovação + Módulo Financeiro Integrado', 'cli-04', 'Kora Saúde Corporativa', 'Ganho', 56400, 100, 'Camila Duarte', '2026-11-14', 'Contrato assinado — faturamento iniciado', ARRAY['Fechamento confirmado para ciclo de 12 meses.'], now(), now())
) AS v(id, titulo, cliente_id, cliente_nome, stage, value_brl, probability, owner_name, expected_close, next_step, notes, created_at, updated_at)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Produtos
-- ============================================================================
INSERT INTO produtos (id, sku, nome, categoria, billing_model, price_brl, margin_percent, active_clients, status, description, created_at, updated_at)
SELECT * FROM (VALUES
  ('prod-01', 'TKZ-CORE-ENT', 'TokenizAi Core Enterprise', 'Software SaaS', 'Recorrente Mensal', 14500, 82, 14, 'Ativo', 'Licença corporativa completa com gestão de projetos, CRM, financeiro e relatórios executivos.', now(), now()),
  ('prod-02', 'TKZ-HERMES-DED', 'Orquestração Hermes Dedicada', 'Automação IA', 'Recorrente Mensal', 8900, 74, 9, 'Ativo', 'Instância isolada de runtime Hermes com governança de custos, heartbeats e até 25 agentes.', now(), now()),
  ('prod-03', 'TKZ-FISCAL-AI', 'Suite Automação Fiscal IA', 'Automação IA', 'Recorrente Mensal', 6400, 78, 7, 'Ativo', 'Leitura, validação de regras tributárias e conciliação automática de documentos fiscais.', now(), now()),
  ('prod-04', 'TKZ-IMPL-PRO', 'Implantação & Arquitetura Sob Medida', 'Consultoria', 'Projeto Fechado', 45000, 58, 5, 'Ativo', 'Projeto estruturado de integração ERP, desenho de fluxos e capacitação das equipes.', now(), now()),
  ('prod-05', 'TKZ-SLA-24X5', 'Suporte Gerenciado & SRE 24x5', 'Suporte Gerenciado', 'Recorrente Mensal', 4200, 69, 11, 'Ativo', 'Monitoramento contínuo, resposta a incidentes em até 30 minutos e otimização mensal.', now(), now())
) AS v(id, sku, nome, categoria, billing_model, price_brl, margin_percent, active_clients, status, description, created_at, updated_at)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Assinaturas
-- ============================================================================
INSERT INTO assinaturas (id, cliente_id, cliente_nome, plan_name, cycle, mrr_brl, status, next_billing_date, overdue_days, payments, created_at, updated_at)
SELECT * FROM (VALUES
  ('sub-01', 'cli-01', 'Grupo Atlântico Logística', 'Enterprise + Hermes Dedicado', 'Mensal', 18500, 'Ativa', '2026-12-05', 0, '[{"id":"pay-1","date":"2026-11-05","amountBRL":18500,"method":"Pix","status":"Pago"},{"id":"pay-2","date":"2026-10-05","amountBRL":18500,"method":"Pix","status":"Pago"}]'::jsonb, now(), now()),
  ('sub-02', 'cli-03', 'Banco Horizonte Digital', 'Enterprise Compliance Suite', 'Anual', 32000, 'Ativa', '2026-12-10', 0, '[{"id":"pay-3","date":"2026-11-10","amountBRL":32000,"method":"Boleto","status":"Pago"},{"id":"pay-4","date":"2026-10-10","amountBRL":32000,"method":"Boleto","status":"Pago"}]'::jsonb, now(), now()),
  ('sub-03', 'cli-04', 'Kora Saúde Corporativa', 'CRM Corporativo Plus', 'Mensal', 9400, 'Inadimplente', '2026-11-13', 9, '[{"id":"pay-5","date":"2026-11-13","amountBRL":9400,"method":"Boleto","status":"Falhou"},{"id":"pay-6","date":"2026-10-13","amountBRL":9400,"method":"Boleto","status":"Pago"}]'::jsonb, now(), now()),
  ('sub-04', 'cli-02', 'Vértice Distribuidora', 'Automação Fiscal + Suporte', 'Mensal', 12900, 'Ativa', '2026-12-02', 0, '[{"id":"pay-7","date":"2026-11-02","amountBRL":12900,"method":"Cartão Corporativo","status":"Pago"}]'::jsonb, now(), now()),
  ('sub-05', 'cli-05', 'AgroSul Cooperativa', 'Enterprise + Previsão de Demanda', 'Mensal', 14800, 'Em Teste', '2026-12-01', 0, '[{"id":"pay-8","date":"2026-11-01","amountBRL":14800,"method":"Pix","status":"Pendente"}]'::jsonb, now(), now())
) AS v(id, cliente_id, cliente_nome, plan_name, cycle, mrr_brl, status, next_billing_date, overdue_days, payments, created_at, updated_at)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Lançamentos Financeiros
-- ============================================================================
INSERT INTO lancamentos_financeiros (id, date, description, counterparty, category, type, status, amount_brl, created_at, updated_at)
SELECT * FROM (VALUES
  ('fin-01', '2026-11-21', 'Mensalidade Enterprise Compliance Suite', 'Banco Horizonte Digital', 'Assinaturas', 'Receber', 'Liquidado', 32000, now(), now()),
  ('fin-02', '2026-11-19', 'Parcela 2/3 — Portal B2B & Billing', 'Grupo Atlântico Logística', 'Projetos', 'Receber', 'Liquidado', 48300, now(), now()),
  ('fin-03', '2026-11-18', 'Infraestrutura Cloud Kubernetes & DB', 'Google Cloud Brasil', 'Infraestrutura Cloud', 'Pagar', 'Liquidado', 11400, now(), now()),
  ('fin-04', '2026-11-16', 'Consumo APIs LLM & Runtime Hermes', 'Provedores de Modelos IA', 'Operação IA', 'Pagar', 'Liquidado', 6850, now(), now()),
  ('fin-05', '2026-11-13', 'Assinatura CRM Corporativo (em aberto)', 'Kora Saúde Corporativa', 'Assinaturas', 'Receber', 'Em Atraso', 9400, now(), now()),
  ('fin-06', '2026-11-25', 'Folha Engenharia & Operações', 'Equipe Interna TokenizAi', 'Folha & Parceiros', 'Pagar', 'Agendado', 64200, now(), now()),
  ('fin-07', '2026-11-28', 'ISS / PIS / COFINS Competência Nov', 'Receita Federal / Prefeitura SP', 'Impostos', 'Pagar', 'Agendado', 14900, now(), now()),
  ('fin-08', '2026-11-29', 'Entrega Homologação Triagem Fiscal', 'Vértice Distribuidora', 'Projetos', 'Receber', 'Agendado', 34500, now(), now())
) AS v(id, date, description, counterparty, category, type, status, amount_brl, created_at, updated_at)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Automações
-- ============================================================================
INSERT INTO automacoes (id, nome, trigger, action, target_agent_name, active, runs_last_30d, last_run_at, created_at, updated_at)
SELECT * FROM (VALUES
  ('auto-01', 'Contrato Ganho -> Provisionar Onboarding', 'Oportunidade marcada como Ganho no Comercial', 'Cria projeto inicial e delega checklist técnico ao Hermes', 'Arquiteto de Implantação', true, 12, '14/11/2026 · 16:40', now(), now()),
  ('auto-02', 'Fatura Vencida > 5d -> Notificar Retenção', 'Assinatura entra em Inadimplência', 'Prepara dossiê de uso do cliente e alerta gestor da conta', 'Analista de Revenue Ops', true, 4, '18/11/2026 · 09:15', now(), now()),
  ('auto-03', 'Fechamento Semanal de Margem por Projeto', 'Toda sexta-feira às 18:00', 'Consolida horas, custos Hermes e desvio orçamentário', 'Controladoria & Custos', false, 3, '15/11/2026 · 18:00', now(), now())
) AS v(id, nome, trigger, action, target_agent_name, active, runs_last_30d, last_run_at, created_at, updated_at)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Auditorias
-- ============================================================================
INSERT INTO auditoria (id, timestamp, actor, action, target, origin, metadata, created_at)
SELECT * FROM (VALUES
  ('log-01', '22/11/2026 15:32', 'Rafael Mendes', 'Verificação de saúde do proxy Hermes', '/api/hermes/overview', 'Hermes Adapter', '{}'::jsonb, now()),
  ('log-02', '22/11/2026 14:15', 'Helena Vasconcelos', 'Atualizou orçamento do projeto PRJ-215', 'PRJ-215', 'Plataforma', '{}'::jsonb, now()),
  ('log-03', '21/11/2026 18:04', 'Mariana Costa', 'Exportou relatório de fluxo de caixa (CSV)', 'Relatório Financeiro Nov/26', 'Plataforma', '{}'::jsonb, now()),
  ('log-04', '20/11/2026 11:20', 'Sistema RBAC', 'Bloqueio de exposição direta de chave no navegador', 'Política TOKENIZAI_HERMES_URL', 'Segurança', '{}'::jsonb, now())
) AS v(id, timestamp, actor, action, target, origin, metadata, created_at)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- FIM DO SEED
-- ============================================================================
SELECT 'seed_completo_ok' as resultado;
