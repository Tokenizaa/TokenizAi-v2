import dotenv from 'dotenv';
dotenv.config();
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { INITIAL_ENTERPRISE_DATA } from './src/data/enterpriseSeed.ts';
import type {
  AdminUserRecord,
  AuditLogEntry,
  ClientStatus,
  DealStage,
  EnterpriseDataState,
  FinanceEntry,
  ProductCategory,
  ProductRecord,
  ProjectRecord,
  ProjectStage,
  RunRecord,
  ActivityRecord,
} from './src/types/platform.ts';
import {
  issueNonAdminUserSession,
  logoutAdminToken,
  requirePermission,
  resolveWorkspaceActor,
  type TokenizAiRole,
} from './server/integrations/hermes/adminAuth.ts';
import { hermesGateway } from './server/integrations/hermes/index.ts';
import { createHermesRouter } from './server/integrations/hermes/router.ts';
import { loadEnterpriseState, saveEnterpriseState } from './server/persistence.ts';
import { SupabaseRepository } from './server/supabase/repository.ts';
import {
  authenticate,
  createSupabaseUserClient,
  getSupabaseAdmin,
  isPlatformAdmin,
  type SupabaseUser,
} from './server/supabase.ts';
import {
  startExecutionOrchestrator,
  stopExecutionOrchestrator,
} from './server/services/execution-orchestrator.ts';
import { startDevLifecycle } from './server/lifecycle/dev-lifecycle.ts';
import { createFallbackWorkers } from './server/services/worker-manager.ts';

const VALID_ROLES: TokenizAiRole[] = [
  'Diretoria Executiva',
  'Gestor Operacional',
  'Comercial & CRM',
  'Financeiro',
  'Auditor',
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

// Estado empresarial. Carregado do Supabase na inicializacao (fonte de verdade
// duravel), com degradacao graciosa para estado em memoria + JSON quando
// Supabase nao estiver configurado. Variaveis declaradas aqui e inicializadas
// de forma assincrona dentro de startServer() / initializeServerState().
let enterpriseState: EnterpriseDataState = structuredClone(INITIAL_ENTERPRISE_DATA);
let serverInitialization: Promise<void> | null = null;
let supabaseRepo = new SupabaseRepository(structuredClone(INITIAL_ENTERPRISE_DATA));

/**
 * Carrega o estado empresarial do Supabase (fonte de verdade) ou, em falta
 * de configuracao, do arquivo JSON local / seed demonstrativo.
 */
async function loadEnterpriseStateFromSupabase(): Promise<EnterpriseDataState> {
  if (!supabaseRepo.isSupabaseAvailable()) {
    if (process.env.VERCEL) throw new Error('Supabase é obrigatório no ambiente Vercel. Configure SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.');
    return loadEnterpriseState() ?? structuredClone(INITIAL_ENTERPRISE_DATA);
  }
  try {
    const [projects, clients, deals, products, subscriptions, financeEntries, automations, users, departamentos, agentesEmpresariais, equipes] =
      await Promise.all([
        supabaseRepo.listProjects(),
        supabaseRepo.listClients(),
        supabaseRepo.listDeals(),
        supabaseRepo.listProducts(),
        supabaseRepo.listSubscriptions(),
        supabaseRepo.listFinanceEntries(),
        supabaseRepo.listAutomations(),
        supabaseRepo.listUsers(),
        supabaseRepo.listDepartamentos(),
        supabaseRepo.listAgentesEmpresariais(),
        supabaseRepo.listEquipes(),
      ]);

    // Recupera auditoria, runs e atividades separadamente (listas pode ser vazias)
    const [auditLogs, runs, activities] = await Promise.all([
      supabaseRepo.listAuditLogs(),
      supabaseRepo.listRuns(),
      supabaseRepo.listActivities(),
    ]);

    const state: EnterpriseDataState = {
      projects,
      clients,
      deals,
      products,
      subscriptions,
      financeEntries,
      automations,
      users: users as unknown as AdminUserRecord[],
      auditLogs: auditLogs as unknown as AuditLogEntry[],
      runs: runs as unknown as RunRecord[],
      activities: activities as unknown as ActivityRecord[],
      departamentos,
      agentesEmpresariais,
      equipes,
    };

    // Anexa entregas e atividades de cada projeto (estao em tabelas separadas no Supabase)
    for (const project of state.projects) {
      const [deliverables, projectActivities] = await Promise.all([
        supabaseRepo.listDeliverables(project.id),
        supabaseRepo.listProjectActivities(project.id),
      ]);
      project.deliverables = deliverables.map((d: any) => ({
        id: d.id,
        title: d.titulo,
        owner: d.responsavel,
        dueDate: d.data_vencimento,
        done: d.concluida,
      }));
      project.activities = projectActivities.map((a: any) => ({
        id: a.id,
        author: a.autor,
        date: a.data,
        summary: a.resumo,
      }));
    }

    return state;
  } catch (err) {
    console.error(
      '[Supabase] Falha ao carregar estado empresarial, usando fallback local:',
      err instanceof Error ? err.message : String(err),
    );
    if (process.env.VERCEL) throw new Error('Não foi possível carregar o estado empresarial do Supabase no ambiente Vercel.');
    return loadEnterpriseState() ?? structuredClone(INITIAL_ENTERPRISE_DATA);
  }
}

/**
 * Espelha o estado empresarial no Supabase (aguarda confirmação).
 * Quando Supabase nao esta configurado, e um no-op silencioso.
 * Falhas de persistencia sao propagadas para nao mascarar erro como sucesso.
 */
async function supabaseSync(state: EnterpriseDataState): Promise<void> {
  if (!supabaseRepo.isSupabaseAvailable()) return;
  const errors: string[] = [];
  // Sincroniza os dominios principais de forma idempotente (upsert por id).
  for (const project of state.projects) {
    try {
      await supabaseRepo.createProject(project).catch(() =>
        supabaseRepo.updateProject(project.id, project),
      );
    } catch (err) {
      errors.push(`projeto ${project.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  for (const client of state.clients) {
    try {
      await supabaseRepo.createClient(client).catch(() =>
        supabaseRepo.updateClient(client.id, client),
      );
    } catch (err) {
      errors.push(`cliente ${client.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  for (const deal of state.deals) {
    try {
      await supabaseRepo.createDeal(deal).catch(() =>
        supabaseRepo.updateDeal(deal.id, deal),
      );
    } catch (err) {
      errors.push(`negocio ${deal.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  for (const product of state.products) {
    try {
      await supabaseRepo.createProduct(product).catch(() =>
        supabaseRepo.updateProduct(product.id, product),
      );
    } catch (err) {
      errors.push(`produto ${product.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  for (const sub of state.subscriptions) {
    try {
      await supabaseRepo.createSubscription(sub).catch(() =>
        supabaseRepo.updateSubscription(sub.id, sub),
      );
    } catch (err) {
      errors.push(`assinatura ${sub.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  for (const entry of state.financeEntries) {
    try {
      await supabaseRepo.createFinanceEntry(entry).catch(() =>
        supabaseRepo.updateFinanceEntry(entry.id, entry),
      );
    } catch (err) {
      errors.push(`lancamento ${entry.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  for (const flow of state.automations) {
    try {
      await supabaseRepo.createAutomation(flow).catch(() =>
        supabaseRepo.updateAutomation(flow.id, flow),
      );
    } catch (err) {
      errors.push(`automacao ${flow.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  for (const user of state.users) {
    try {
      await supabaseRepo.createUser(user).catch(() =>
        supabaseRepo.updateUser(user.id, user),
      );
    } catch (err) {
      errors.push(`usuario ${user.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  // Sincroniza entregas e atividades de cada projeto
  for (const project of state.projects) {
    for (const del of project.deliverables || []) {
      try {
        await supabaseRepo.createDeliverable({
          id: del.id,
          projeto_id: project.id,
          titulo: del.title,
          responsavel: del.owner,
          data_vencimento: del.dueDate,
          concluida: del.done,
        }).catch(() =>
          supabaseRepo.updateDeliverable(del.id, {
            titulo: del.title,
            responsavel: del.owner,
            data_vencimento: del.dueDate,
            concluida: del.done,
          }),
        );
      } catch (err) {
        errors.push(`entrega ${del.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    for (const act of project.activities || []) {
      try {
        await supabaseRepo.createProjectActivity({
          id: act.id,
          projeto_id: project.id,
          autor: act.author,
          data: act.date,
          resumo: act.summary,
        }).catch(() =>
          supabaseRepo.updateProjectActivity(act.id, {
            autor: act.author,
            data: act.date,
            resumo: act.summary,
          }),
        );
      } catch (err) {
        errors.push(`atividade ${act.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(`Falha na sincronizacao com Supabase: ${errors.join('; ')}`);
  }
}

function appendAudit(
  actor: string,
  action: string,
  target: string,
  origin: 'Plataforma' | 'Hermes Adapter' | 'Segurança' = 'Plataforma',
) {
  const now = new Date();
  const formatted = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
  enterpriseState.auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: formatted,
    actor,
    action,
    target,
    origin,
  });
}

/**
 * Persiste o estado empresarial: grava no JSON (sincrono) e espelha no Supabase
 * aguardando confirmacao. Nao informa sucesso enquanto a persistencia duravel
 * nao for confirmada (ou Supabase nao estiver configurado).
 */
async function persistState(state: EnterpriseDataState): Promise<void> {
  if (process.env.VERCEL) {
    if (!supabaseRepo.isSupabaseAvailable()) {
      throw new Error('Persistência indisponível: Supabase não configurado no ambiente Vercel.');
    }
  } else {
    saveEnterpriseState(state);
  }
  if (supabaseRepo.isSupabaseAvailable()) await supabaseSync(state);
}

/**
 * Constrói a aplicação Express com todas as rotas. Exportada separadamente de
 * `startServer` para permitir testes de integração sem subir o servidor HTTP
 * nem o Vite.
 */
export function buildApp(): express.Application {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  // ============================================================================
  // Health & Integration Diagnostics (never exposes secrets to browser)
  // ============================================================================
  app.get('/api/health', (_req: Request, res: Response) => {
    const hcStatus = hermesGateway.getStatus();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      integrations: {
        hermes: hcStatus,
      },
    });
  });

  // ============================================================================
  // Workspace Session & Actor Identity (non-admin role switching; admin requires passcode)
  // ============================================================================
  app.get('/api/auth/me', authenticate, (_req: Request, res: Response) => {
    const user = (_req as Request & { user?: SupabaseUser }).user!;
    res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        emailConfirmed: user.emailConfirmed,
        role: user.role,
        platformRole: user.appMetadata.platform_role ?? null,
        isPlatformAdmin: isPlatformAdmin(user),
        appMetadata: user.appMetadata,
      },
    });
  });

  // ============================================================================
  // Primeiro administrador da plataforma (bootstrap via Supabase Auth)
  // Chamado após o login do fundador elegível. O backend valida o JWT do
  // Supabase e executa a funcao RPC claim_initial_platform_admin() no banco,
  // que so aceita a primeira identidade confirmada com o e-mail autorizado.
  // ============================================================================
  app.post('/api/auth/bootstrap-admin', authenticate, async (req: Request, res: Response) => {
    const user = (req as Request & { user?: SupabaseUser }).user!;
    if (!user.email) {
      res.status(400).json({ error: 'Identidade sem e-mail associado.', code: 'MISSING_EMAIL' });
      return;
    }
    if (!user.emailConfirmed) {
      res.status(403).json({ error: 'Confirme o seu e-mail antes de reivindicar o acesso administrativo.', code: 'EMAIL_NOT_CONFIRMED' });
      return;
    }

    try {
      const accessToken = req.headers.authorization?.slice('Bearer '.length).trim() || '';
      const client = createSupabaseUserClient(accessToken);

      const { data, error } = await client.rpc('claim_initial_platform_admin');
      if (error) {
        res.status(403).json({ error: error.message, code: 'BOOTSTRAP_REJECTED' });
        return;
      }

      res.json({
        ok: true,
        claimed: true,
        user: {
          id: user.id,
          email: user.email,
          platformRole: 'platform_admin',
          isPlatformAdmin: true,
        },
        message: data ?? 'Primeiro administrador reivindicado com sucesso.',
      });
    } catch (err) {
      res.status(500).json({
        error: 'Erro ao concluir o bootstrap administrativo.',
        code: 'BOOTSTRAP_ERROR',
      });
    }
  });

  app.post('/api/auth/session', async (req: Request, res: Response) => {
    const { actor, invalidToken } = await resolveWorkspaceActor(req);
    if (invalidToken) {
      res.status(401).json({ error: 'Token de sessão inválido ou expirado.', code: 'INVALID_SESSION_TOKEN' });
      return;
    }
    if (!actor.authenticated) {
      res.status(401).json({ error: 'Autenticação necessária para iniciar sessão.', code: 'AUTH_REQUIRED' });
      return;
    }
    const { userId } = req.body as { userId?: string };
    const user = enterpriseState.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ error: 'Usuário corporativo não encontrado.' });
      return;
    }
    if (user.id !== actor.userId && !actor.isAdmin) {
      res.status(403).json({
        error: 'Não é possível assumir a identidade de outro usuário.',
        code: 'IDENTITY_ASSUMPTION_FORBIDDEN',
      });
      return;
    }
    const result = issueNonAdminUserSession(req.headers.authorization, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    appendAudit(result.actor.name, `Iniciou sessão operacional como ${result.actor.role}`, user.email, 'Segurança');
    res.status(201).json({ ok: true, token: result.token, expiresAt: result.expiresAt, actor: result.actor });
  });

  app.post('/api/auth/login-admin', async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios.', code: 'MISSING_CREDENTIALS' });
      return;
    }
    try {
      const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error || !data.session?.access_token) {
        res.status(401).json({ error: 'Credenciais inválidas.', code: 'INVALID_CREDENTIALS' });
        return;
      }
      const accessToken = data.session.access_token;
      // Fundador reivindica papel administrativo para escrita empresarial
      const founderEmail = (process.env.FOUNDER_EMAIL || 'nettoscorp@gmail.com').trim();
      const isFounder = email === founderEmail;
      if (isFounder) {
        const client = createSupabaseUserClient(accessToken);
        const { data: rpcData, error: rpcError } = await client.rpc('claim_initial_platform_admin');
        if (rpcError) {
          res.status(403).json({ error: rpcError.message, code: 'BOOTSTRAP_REJECTED' });
          return;
        }
      }
      res.json({
        ok: true,
        token: accessToken,
        expiresAt: data.session.expires_at ? new Date(data.session.expires_at * 1000).getTime() : Date.now() + 8 * 60 * 60 * 1000,
        user: { id: data.user.id, email: data.user.email, emailConfirmed: Boolean(data.user.email_confirmed_at) },
      });
    } catch (err) {
      res.status(500).json({ error: 'Falha ao autenticar.', code: 'LOGIN_FAILED' });
    }
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    logoutAdminToken(req.headers.authorization);
    if (actor.authenticated) {
      appendAudit(actor.name, 'Encerrou sessão operacional', actor.email, 'Segurança');
    }
    res.json({ ok: true });
  });

  // ============================================================================
  // Enterprise Business API
  // ============================================================================
  app.get('/api/enterprise/state', requirePermission('read'), (_req: Request, res: Response) => {
    res.json({ ok: true, data: enterpriseState });
  });

  app.post('/api/enterprise/projects', requirePermission('enterprise:projects:write'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    const { name, clientId, ownerName, endDate, budgetBRL, stage,
      strategicObjective, problemToSolve, expectedOutcome, priority,
      managingAgentId, teamAgentIds } = req.body as {
      name?: string;
      clientId?: string;
      ownerName?: string;
      endDate?: string;
      budgetBRL?: number;
      stage?: ProjectStage;
      strategicObjective?: string;
      problemToSolve?: string;
      expectedOutcome?: string;
      priority?: 'Baixa' | 'Media' | 'Alta' | 'Critica';
      managingAgentId?: string | null;
      teamAgentIds?: string[] | null;
    };

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Nome do projeto é obrigatório.' });
      return;
    }

    const client = enterpriseState.clients.find((c) => c.id === clientId) || enterpriseState.clients[0];
    const nextNum = 220 + enterpriseState.projects.length;
    const newProject: ProjectRecord = {
      id: `proj-${Date.now()}`,
      code: `PRJ-${nextNum}`,
      name: name.trim(),
      clientId: client.id,
      clientName: client.name,
      stage: stage || 'Descoberta',
      ownerName: ownerName?.trim() || actor.name,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: endDate || '2027-01-30',
      progress: stage === 'Entregue' ? 100 : stage === 'Revisão' ? 85 : stage === 'Em Execução' ? 35 : 10,
      budgetBRL: Number(budgetBRL) > 0 ? Number(budgetBRL) : 65000,
      spentBRL: 0,
      deliverables: [
        {
          id: `del-${Date.now()}`,
          title: 'Kickoff e validação de requisitos técnicos',
          owner: ownerName?.trim() || actor.name,
          dueDate: endDate || '2027-01-15',
          done: false,
        },
      ],
      activities: [
        {
          id: `act-${Date.now()}`,
          author: ownerName?.trim() || actor.name,
          date: new Date().toLocaleDateString('pt-BR'),
          summary: 'Projeto criado na plataforma TokenizAi.',
        },
      ],
      strategicObjective: strategicObjective || undefined,
      problemToSolve: problemToSolve || undefined,
      expectedOutcome: expectedOutcome || undefined,
      priority: priority || undefined,
      managingAgentId: managingAgentId || null,
      teamAgentIds: teamAgentIds || [],
    };

    enterpriseState.projects.unshift(newProject);
    appendAudit(actor.name, `Criou projeto ${newProject.code} (${newProject.name})`, newProject.code);
    await persistState(enterpriseState);
    res.status(201).json({ ok: true, project: newProject });
  });

  app.patch('/api/enterprise/projects/:id', requirePermission('enterprise:projects:write'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    const { id } = req.params;
    const project = enterpriseState.projects.find((p) => p.id === id);
    if (!project) {
      res.status(404).json({ error: 'Projeto não encontrado.' });
      return;
    }

    const {
      name,
      ownerName,
      endDate,
      budgetBRL,
      spentBRL,
      stage,
      deliverableId,
      deliverableDone,
      activityNote,
      strategicObjective,
      problemToSolve,
      expectedOutcome,
      priority,
      managingAgentId,
      teamAgentIds,
    } = req.body as {
      name?: string;
      ownerName?: string;
      endDate?: string;
      budgetBRL?: number;
      spentBRL?: number;
      stage?: ProjectStage;
      deliverableId?: string;
      deliverableDone?: boolean;
      activityNote?: string;
      strategicObjective?: string;
      problemToSolve?: string;
      expectedOutcome?: string;
      priority?: 'Baixa' | 'Media' | 'Alta' | 'Critica';
      managingAgentId?: string | null;
      teamAgentIds?: string[] | null;
    };

    let editedDetails = false;
    if (name && name.trim()) {
      project.name = name.trim();
      editedDetails = true;
    }
    if (ownerName && ownerName.trim()) {
      project.ownerName = ownerName.trim();
      editedDetails = true;
    }
    if (endDate && endDate.trim()) {
      project.endDate = endDate.trim();
      editedDetails = true;
    }
    if (typeof budgetBRL === 'number' && budgetBRL > 0) {
      project.budgetBRL = budgetBRL;
      editedDetails = true;
    }
    if (typeof spentBRL === 'number' && spentBRL >= 0) {
      project.spentBRL = spentBRL;
      editedDetails = true;
    }
    if (stage && stage !== project.stage) {
      project.stage = stage;
      if (stage === 'Entregue') project.progress = 100;
      else if (stage === 'Descoberta' && project.progress > 30) project.progress = 20;
      appendAudit(actor.name, `Moveu projeto ${project.code} para ${stage}`, project.code);
    } else if (editedDetails) {
      appendAudit(actor.name, `Editou ficha do projeto ${project.code}`, project.name);
    }

    if (deliverableId && typeof deliverableDone === 'boolean') {
      const del = project.deliverables.find((d) => d.id === deliverableId);
      if (del) {
        del.done = deliverableDone;
        const total = project.deliverables.length || 1;
        const doneCount = project.deliverables.filter((d) => d.done).length;
        project.progress = Math.round((doneCount / total) * 100);
      }
    }

    if (activityNote && activityNote.trim()) {
      project.activities.unshift({
        id: `act-${Date.now()}`,
        author: actor.name,
        date: new Date().toLocaleDateString('pt-BR'),
        summary: activityNote.trim(),
      });
    }

    if (strategicObjective !== undefined) {
      project.strategicObjective = strategicObjective;
      editedDetails = true;
    }
    if (problemToSolve !== undefined) {
      project.problemToSolve = problemToSolve;
      editedDetails = true;
    }
    if (expectedOutcome !== undefined) {
      project.expectedOutcome = expectedOutcome;
      editedDetails = true;
    }
    if (priority !== undefined) {
      project.priority = priority;
      editedDetails = true;
    }
    if (managingAgentId !== undefined) {
      project.managingAgentId = managingAgentId;
      editedDetails = true;
    }
    if (teamAgentIds !== undefined) {
      project.teamAgentIds = teamAgentIds ?? [];
      editedDetails = true;
    }

    await persistState(enterpriseState);
    res.json({ ok: true, project });
  });

  app.post('/api/enterprise/clients', requirePermission('enterprise:crm:write'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    const { name, segment, cnpj, primaryContact, email, phone, accountManager } = req.body as {
      name?: string;
      segment?: string;
      cnpj?: string;
      primaryContact?: string;
      email?: string;
      phone?: string;
      accountManager?: string;
    };
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Nome da empresa é obrigatório.' });
      return;
    }
    const newClient = {
      id: `cli-${Date.now()}`,
      name: name.trim(),
      segment: segment?.trim() || 'Tecnologia & Serviços',
      cnpj: cnpj?.trim() || '00.000.000/0001-00',
      primaryContact: primaryContact?.trim() || 'Contato Principal',
      email: email?.trim() || 'contato@empresa.com.br',
      phone: phone?.trim() || '(11) 99000-0000',
      accountManager: accountManager?.trim() || 'Helena Vasconcelos',
      status: 'Em Implantação' as const,
      mrrBRL: 0,
      ltvBRL: 0,
      since: new Date().toISOString().slice(0, 10),
      products: ['Onboarding TokenizAi'],
      interactions: [
        {
          id: `int-${Date.now()}`,
          date: new Date().toLocaleDateString('pt-BR'),
          channel: 'Reunião' as const,
          author: actor.name,
          note: 'Cadastro inicial criado no CRM corporativo.',
        },
      ],
    };
    enterpriseState.clients.unshift(newClient);
    appendAudit(actor.name, 'Cadastrou novo cliente', newClient.name);
    await persistState(enterpriseState);
    res.status(201).json({ ok: true, client: newClient });
  });

  app.patch('/api/enterprise/clients/:id', requirePermission('enterprise:crm:write'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    const client = enterpriseState.clients.find((c) => c.id === req.params.id);
    if (!client) {
      res.status(404).json({ error: 'Cliente não encontrado.' });
      return;
    }
    const {
      name,
      segment,
      cnpj,
      primaryContact,
      email,
      phone,
      accountManager,
      status,
      mrrBRL,
    } = req.body as {
      name?: string;
      segment?: string;
      cnpj?: string;
      primaryContact?: string;
      email?: string;
      phone?: string;
      accountManager?: string;
      status?: ClientStatus;
      mrrBRL?: number;
    };

    if (name && name.trim()) client.name = name.trim();
    if (segment && segment.trim()) client.segment = segment.trim();
    if (cnpj && cnpj.trim()) client.cnpj = cnpj.trim();
    if (primaryContact && primaryContact.trim()) client.primaryContact = primaryContact.trim();
    if (email && email.trim()) client.email = email.trim();
    if (phone && phone.trim()) client.phone = phone.trim();
    if (accountManager && accountManager.trim()) client.accountManager = accountManager.trim();
    if (status) client.status = status;
    if (typeof mrrBRL === 'number' && mrrBRL >= 0) client.mrrBRL = mrrBRL;

    appendAudit(actor.name, 'Atualizou cadastro do cliente', client.name);
    await persistState(enterpriseState);
    res.json({ ok: true, client });
  });

  app.post('/api/enterprise/clients/:id/interactions', requirePermission('enterprise:crm:write'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    const client = enterpriseState.clients.find((c) => c.id === req.params.id);
    if (!client) {
      res.status(404).json({ error: 'Cliente não encontrado.' });
      return;
    }
    const { channel, note } = req.body as {
      channel?: 'Reunião' | 'E-mail' | 'Proposta' | 'Suporte';
      note?: string;
    };
    if (!note || !note.trim()) {
      res.status(400).json({ error: 'Descrição da interação é obrigatória.' });
      return;
    }
    client.interactions.unshift({
      id: `int-${Date.now()}`,
      date: new Date().toLocaleDateString('pt-BR'),
      channel: channel || 'Reunião',
      author: actor.name,
      note: note.trim(),
    });
    appendAudit(actor.name, `Registrou interação (${channel || 'Reunião'})`, client.name);
    await persistState(enterpriseState);
    res.status(201).json({ ok: true, client });
  });

  app.patch('/api/enterprise/users/:id', requirePermission('admin:integration'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    const user = enterpriseState.users.find((u) => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const { role } = req.body as { role?: EnterpriseDataState['users'][number]['role'] };
    if (!role || !VALID_ROLES.includes(role)) {
      res.status(400).json({ error: 'Perfil de acesso inválido.' });
      return;
    }
    user.role = role;
    appendAudit(actor.name, `Alterou perfil de acesso para ${role}`, user.email, 'Segurança');
    await persistState(enterpriseState);
    res.json({ ok: true, user });
  });

  app.post('/api/enterprise/reset', requirePermission('admin:integration'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    if (req.headers['x-confirm-destructive'] !== 'RESET_ENTERPRISE_DATA') {
      res.status(400).json({ error: 'Confirmação explícita obrigatória para restaurar a base empresarial.' });
      return;
    }
    enterpriseState = structuredClone(INITIAL_ENTERPRISE_DATA);
    appendAudit(actor.name, 'Restaurou base demonstrativa empresarial padrão', 'Workspace', 'Segurança');
    await persistState(enterpriseState);
    res.json({ ok: true });
  });

  app.post('/api/enterprise/deals', requirePermission('enterprise:crm:write'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    const { title, clientId, valueBRL, stage, nextStep } = req.body as {
      title?: string;
      clientId?: string;
      valueBRL?: number;
      stage?: DealStage;
      nextStep?: string;
    };
    if (!title || !title.trim()) {
      res.status(400).json({ error: 'Título da oportunidade é obrigatório.' });
      return;
    }
    const client = enterpriseState.clients.find((c) => c.id === clientId) || enterpriseState.clients[0];
    const targetStage: DealStage = stage || 'Prospecção';
    const probMap: Record<DealStage, number> = {
      Prospecção: 20,
      Qualificação: 40,
      Proposta: 60,
      Negociação: 80,
      Ganho: 100,
      Perdido: 0,
    };

    const deal = {
      id: `deal-${Date.now()}`,
      title: title.trim(),
      clientId: client.id,
      clientName: client.name,
      stage: targetStage,
      valueBRL: Number(valueBRL) > 0 ? Number(valueBRL) : 35000,
      probability: probMap[targetStage],
      ownerName: actor.name,
      expectedClose: '2027-01-25',
      nextStep: nextStep?.trim() || 'Agendar reunião de alinhamento',
      notes: ['Oportunidade cadastrada na plataforma.'],
    };

    enterpriseState.deals.unshift(deal);
    appendAudit(actor.name, `Criou oportunidade comercial "${deal.title}"`, client.name);
    await persistState(enterpriseState);
    res.status(201).json({ ok: true, deal });
  });

  app.patch('/api/enterprise/deals/:id', requirePermission('enterprise:crm:write'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    const deal = enterpriseState.deals.find((d) => d.id === req.params.id);
    if (!deal) {
      res.status(404).json({ error: 'Oportunidade não encontrada.' });
      return;
    }
    const { title, stage, valueBRL, expectedClose, nextStep, ownerName, note } = req.body as {
      title?: string;
      stage?: DealStage;
      valueBRL?: number;
      expectedClose?: string;
      nextStep?: string;
      ownerName?: string;
      note?: string;
    };
    const probMap: Record<DealStage, number> = {
      Prospecção: 20,
      Qualificação: 40,
      Proposta: 60,
      Negociação: 80,
      Ganho: 100,
      Perdido: 0,
    };

    let editedDetails = false;
    if (title && title.trim()) {
      deal.title = title.trim();
      editedDetails = true;
    }
    if (typeof valueBRL === 'number' && valueBRL > 0) {
      deal.valueBRL = valueBRL;
      editedDetails = true;
    }
    if (expectedClose && expectedClose.trim()) {
      deal.expectedClose = expectedClose.trim();
      editedDetails = true;
    }
    if (nextStep && nextStep.trim()) {
      deal.nextStep = nextStep.trim();
      editedDetails = true;
    }
    if (ownerName && ownerName.trim()) {
      deal.ownerName = ownerName.trim();
      editedDetails = true;
    }

    if (stage && stage !== deal.stage) {
      deal.stage = stage;
      deal.probability = probMap[stage];
      appendAudit(actor.name, `Atualizou etapa comercial para ${stage}`, deal.title);
    } else if (editedDetails) {
      appendAudit(actor.name, 'Editou oportunidade comercial', deal.title);
    }

    if (note && note.trim()) {
      deal.notes.unshift(note.trim());
    }
    await persistState(enterpriseState);
    res.json({ ok: true, deal });
  });

  app.post('/api/enterprise/products', requirePermission('enterprise:finance:write'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    const { name, category, billingModel, priceBRL, marginPercent, description } = req.body as {
      name?: string;
      category?: ProductCategory;
      billingModel?: ProductRecord['billingModel'];
      priceBRL?: number;
      marginPercent?: number;
      description?: string;
    };
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Nome do produto é obrigatório.' });
      return;
    }
    const prod: ProductRecord = {
      id: `prod-${Date.now()}`,
      sku: `TKZ-${Math.floor(100 + Math.random() * 899)}`,
      name: name.trim(),
      category: category || 'Software SaaS',
      billingModel: billingModel || 'Recorrente Mensal',
      priceBRL: Number(priceBRL) > 0 ? Number(priceBRL) : 5000,
      marginPercent: Number(marginPercent) > 0 ? Number(marginPercent) : 70,
      activeClients: 0,
      status: 'Ativo',
      description: description?.trim() || 'Oferta corporativa TokenizAi.',
    };
    enterpriseState.products.unshift(prod);
    appendAudit(actor.name, `Cadastrou produto ${prod.sku}`, prod.name);
    await persistState(enterpriseState);
    res.status(201).json({ ok: true, product: prod });
  });

  app.patch('/api/enterprise/products/:id', requirePermission('enterprise:finance:write'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    const prod = enterpriseState.products.find((p) => p.id === req.params.id);
    if (!prod) {
      res.status(404).json({ error: 'Produto ou serviço não encontrado.' });
      return;
    }
    const { name, category, billingModel, priceBRL, marginPercent, status, description } = req.body as {
      name?: string;
      category?: ProductCategory;
      billingModel?: ProductRecord['billingModel'];
      priceBRL?: number;
      marginPercent?: number;
      status?: ProductRecord['status'];
      description?: string;
    };

    if (name && name.trim()) prod.name = name.trim();
    if (category) prod.category = category;
    if (billingModel) prod.billingModel = billingModel;
    if (typeof priceBRL === 'number' && priceBRL >= 0) prod.priceBRL = priceBRL;
    if (typeof marginPercent === 'number' && marginPercent >= 0 && marginPercent <= 100) prod.marginPercent = marginPercent;
    if (status) prod.status = status;
    if (typeof description === 'string' && description.trim()) prod.description = description.trim();

    appendAudit(actor.name, `Atualizou produto ${prod.sku} (${prod.status})`, prod.name);
    await persistState(enterpriseState);
    res.json({ ok: true, product: prod });
  });

  app.patch('/api/enterprise/subscriptions/:id', requirePermission('enterprise:finance:write'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    const sub = enterpriseState.subscriptions.find((s) => s.id === req.params.id);
    if (!sub) {
      res.status(404).json({ error: 'Assinatura não encontrada.' });
      return;
    }
    const { action, planName, cycle, mrrBRL, nextBillingDate } = req.body as {
      action?: 'mark_paid' | 'cancel' | 'reactivate';
      planName?: string;
      cycle?: 'Mensal' | 'Anual';
      mrrBRL?: number;
      nextBillingDate?: string;
    };

    if (planName && planName.trim()) sub.planName = planName.trim();
    if (cycle) sub.cycle = cycle;
    if (typeof mrrBRL === 'number' && mrrBRL >= 0) sub.mrrBRL = mrrBRL;
    if (nextBillingDate && nextBillingDate.trim()) sub.nextBillingDate = nextBillingDate.trim();

    if (action === 'mark_paid') {
      sub.status = 'Ativa';
      sub.overdueDays = 0;
      sub.payments.unshift({
        id: `pay-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        amountBRL: sub.mrrBRL,
        method: 'Pix',
        status: 'Pago',
      });
      appendAudit(actor.name, 'Confirmou liquidação de assinatura', sub.clientName);
    } else if (action === 'cancel') {
      sub.status = 'Cancelada';
      appendAudit(actor.name, 'Cancelou assinatura', sub.clientName);
    } else if (action === 'reactivate') {
      sub.status = 'Ativa';
      sub.overdueDays = 0;
      appendAudit(actor.name, 'Reativou assinatura', sub.clientName);
    } else if (planName || cycle || typeof mrrBRL === 'number' || nextBillingDate) {
      appendAudit(actor.name, 'Editou assinatura recorrente', `${sub.clientName} — ${sub.planName}`);
    }
    await persistState(enterpriseState);
    res.json({ ok: true, subscription: sub });
  });

  app.post('/api/enterprise/finance', requirePermission('enterprise:finance:write'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    const { description, counterparty, category, type, status, amountBRL, date } = req.body as Partial<FinanceEntry>;
    if (!description || !description.trim() || !amountBRL || Number(amountBRL) <= 0) {
      res.status(400).json({ error: 'Descrição e valor positivo são obrigatórios.' });
      return;
    }
    const entry: FinanceEntry = {
      id: `fin-${Date.now()}`,
      date: date || new Date().toISOString().slice(0, 10),
      description: description.trim(),
      counterparty: counterparty?.trim() || 'Não informado',
      category: category || 'Projetos',
      type: type || 'Receber',
      status: status || 'Agendado',
      amountBRL: Number(amountBRL),
    };
    enterpriseState.financeEntries.unshift(entry);
    appendAudit(actor.name, `Registrou lançamento ${entry.type}`, `${entry.description} (R$ ${entry.amountBRL})`);
    await persistState(enterpriseState);
    res.status(201).json({ ok: true, entry });
  });

  app.patch('/api/enterprise/finance/:id', requirePermission('enterprise:finance:write'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    const entry = enterpriseState.financeEntries.find((f) => f.id === req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Lançamento financeiro não encontrado.' });
      return;
    }
    const { description, counterparty, category, type, status, amountBRL, date } = req.body as Partial<FinanceEntry>;
    if (description && description.trim()) entry.description = description.trim();
    if (counterparty && counterparty.trim()) entry.counterparty = counterparty.trim();
    if (category) entry.category = category;
    if (type) entry.type = type;
    if (date && date.trim()) entry.date = date.trim();
    if (typeof amountBRL === 'number' && amountBRL > 0) entry.amountBRL = amountBRL;
    if (status) entry.status = status;

    appendAudit(actor.name, `Atualizou lançamento financeiro (${entry.status})`, entry.description);
    await persistState(enterpriseState);
    res.json({ ok: true, entry });
  });

  app.patch('/api/enterprise/automations/:id', requirePermission('hermes:ops:write'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    const flow = enterpriseState.automations.find((a) => a.id === req.params.id);
    if (!flow) {
      res.status(404).json({ error: 'Fluxo de automação não encontrado.' });
      return;
    }
    if (typeof req.body.active === 'boolean') {
      flow.active = req.body.active;
      appendAudit(actor.name, `${flow.active ? 'Ativou' : 'Pausou'} fluxo automatizado`, flow.name);
    }
    await persistState(enterpriseState);
    res.json({ ok: true, automation: flow });
  });

  app.post('/api/enterprise/automations', requirePermission('hermes:ops:write'), async (req: Request, res: Response) => {
    const { actor } = await resolveWorkspaceActor(req);
    const { name, trigger, action, targetAgentName } = req.body as {
      name?: string;
      trigger?: string;
      action?: string;
      targetAgentName?: string;
    };
    if (!name?.trim() || !trigger?.trim() || !action?.trim()) {
      res.status(400).json({ error: 'Nome, gatilho e ação são obrigatórios.' });
      return;
    }
    const flow = {
      id: `auto-${Date.now()}`,
      name: name.trim(),
      trigger: trigger.trim(),
      action: action.trim(),
      targetAgentName: targetAgentName?.trim() || 'Arquiteto de Implantação',
      active: true,
      runsLast30d: 0,
      lastRunAt: 'Recém-criado',
    };
    enterpriseState.automations.unshift(flow);
    appendAudit(actor.name, 'Criou fluxo automatizado entre empresa e agentes', flow.name);
    await persistState(enterpriseState);
    res.status(201).json({ ok: true, automation: flow });
  });

  // ============================================================================
  // Hermes Integration Router (Modular Backend-to-Hermes Integration)
  // ============================================================================
  app.use(createHermesRouter(appendAudit));

  return app;
}

// Instância da aplicação (usada por startServer e por testes de integração).
export const app = buildApp();

export async function initializeServerState(): Promise<void> {
  if (!serverInitialization) {
    serverInitialization = (async () => {
      // Hermes CLI existe apenas no host local; na Vercel o gateway permanece
      // explicitamente desconectado até existir uma ponte remota autenticada.
      if (!process.env.VERCEL) await hermesGateway.initialize();
      enterpriseState = await loadEnterpriseStateFromSupabase();
      supabaseRepo = new SupabaseRepository(enterpriseState);
    })().catch((error) => {
      serverInitialization = null;
      throw error;
    });
  }
  await serverInitialization;
}

async function startServer() {
  await initializeServerState();

  // Inicia o orquestrador de execução autônoma e workers de fallback
  startExecutionOrchestrator(enterpriseState);
  createFallbackWorkers();

  // Inicia o ciclo de vida completo (workers, rotinas de departamento,
  // roteador inter-departamental, recuperação automática)
  await startDevLifecycle();

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    const hc = hermesGateway.getStatus();
    console.log(`[TokenizAi] Servidor ativo na porta ${PORT} (Hermes: ${hc.connectionLabel})`);
  });
}

// Inicia o servidor apenas fora do ambiente de teste (vitest importa `app` diretamente,
// sem precisar abrir a porta HTTP).
if (!process.env.VITEST && !process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('[TokenizAi] Erro fatal ao iniciar servidor:', err);
    process.exit(1);
  });
}
