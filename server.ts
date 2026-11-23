import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { INITIAL_ENTERPRISE_DATA } from './src/data/enterpriseSeed.ts';
import type {
  ClientStatus,
  DealStage,
  EnterpriseDataState,
  FinanceEntry,
  ProductCategory,
  ProductRecord,
  ProjectRecord,
  ProjectStage,
} from './src/types/platform.ts';
import {
  issueNonAdminUserSession,
  logoutAdminToken,
  requirePermission,
  resolveWorkspaceActor,
  type TokenizAiRole,
} from './server/integrations/paperclip/adminAuth.ts';
import { paperclipGateway } from './server/integrations/paperclip/index.ts';
import { createPaperclipRouter } from './server/integrations/paperclip/router.ts';

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

// Server-side in-memory enterprise store (Paperclip state lives exclusively in Paperclip)
let enterpriseState: EnterpriseDataState = structuredClone(INITIAL_ENTERPRISE_DATA);

function appendAudit(actor: string, action: string, target: string, origin: 'Plataforma' | 'Paperclip Proxy' | 'Segurança' = 'Plataforma') {
  const now = new Date();
  const formatted = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  enterpriseState.auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: formatted,
    actor,
    action,
    target,
    origin,
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  // Initialize Paperclip integration (graceful awaiting_credentials if env vars unset)
  await paperclipGateway.initialize();

  // ============================================================================
  // Health & Integration Diagnostics (never exposes secrets to browser)
  // ============================================================================
  app.get('/api/health', (_req: Request, res: Response) => {
    const pcStatus = paperclipGateway.getStatus();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      integrations: {
        paperclip: pcStatus,
      },
    });
  });

  // ============================================================================
  // Workspace Session & Actor Identity (non-admin role switching; admin requires passcode)
  // ============================================================================
  app.get('/api/auth/me', (req: Request, res: Response) => {
    const { actor, invalidToken } = resolveWorkspaceActor(req);
    if (invalidToken) {
      res.status(401).json({ error: 'Token de sessão inválido ou expirado.', code: 'INVALID_SESSION_TOKEN' });
      return;
    }
    res.json({ ok: true, actor });
  });

  app.post('/api/auth/session', (req: Request, res: Response) => {
    const { userId } = req.body as { userId?: string };
    const user = enterpriseState.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ error: 'Usuário corporativo não encontrado.' });
      return;
    }
    const result = issueNonAdminUserSession({
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

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
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

  app.post('/api/enterprise/projects', requirePermission('enterprise:projects:write'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
    const { name, clientId, ownerName, endDate, budgetBRL, stage } = req.body as {
      name?: string;
      clientId?: string;
      ownerName?: string;
      endDate?: string;
      budgetBRL?: number;
      stage?: ProjectStage;
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
    };

    enterpriseState.projects.unshift(newProject);
    appendAudit(actor.name, `Criou projeto ${newProject.code} (${newProject.name})`, newProject.code);
    res.status(201).json({ ok: true, project: newProject });
  });

  app.patch('/api/enterprise/projects/:id', requirePermission('enterprise:projects:write'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
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
      paperclipProjectId,
      paperclipProjectName,
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
      paperclipProjectId?: string | null;
      paperclipProjectName?: string | null;
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
    if (paperclipProjectId !== undefined) {
      project.paperclipProjectId = paperclipProjectId || undefined;
      project.paperclipProjectName = paperclipProjectName || undefined;
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

    res.json({ ok: true, project });
  });

  app.post('/api/enterprise/clients', requirePermission('enterprise:crm:write'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
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
    res.status(201).json({ ok: true, client: newClient });
  });

  app.patch('/api/enterprise/clients/:id', requirePermission('enterprise:crm:write'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
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
    res.json({ ok: true, client });
  });

  app.post('/api/enterprise/clients/:id/interactions', requirePermission('enterprise:crm:write'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
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
    res.status(201).json({ ok: true, client });
  });

  app.patch('/api/enterprise/users/:id', requirePermission('admin:integration'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
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
    res.json({ ok: true, user });
  });

  app.post('/api/enterprise/reset', requirePermission('admin:integration'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
    if (req.headers['x-confirm-destructive'] !== 'RESET_ENTERPRISE_DATA') {
      res.status(400).json({ error: 'Confirmação explícita obrigatória para restaurar a base empresarial.' });
      return;
    }
    enterpriseState = structuredClone(INITIAL_ENTERPRISE_DATA);
    appendAudit(actor.name, 'Restaurou base demonstrativa empresarial padrão', 'Workspace', 'Segurança');
    res.json({ ok: true });
  });

  app.post('/api/enterprise/deals', requirePermission('enterprise:crm:write'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
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
    res.status(201).json({ ok: true, deal });
  });

  app.patch('/api/enterprise/deals/:id', requirePermission('enterprise:crm:write'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
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
    res.json({ ok: true, deal });
  });

  app.post('/api/enterprise/products', requirePermission('enterprise:finance:write'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
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
    res.status(201).json({ ok: true, product: prod });
  });

  app.patch('/api/enterprise/products/:id', requirePermission('enterprise:finance:write'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
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
    res.json({ ok: true, product: prod });
  });

  app.patch('/api/enterprise/subscriptions/:id', requirePermission('enterprise:finance:write'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
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
    res.json({ ok: true, subscription: sub });
  });

  app.post('/api/enterprise/finance', requirePermission('enterprise:finance:write'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
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
    res.status(201).json({ ok: true, entry });
  });

  app.patch('/api/enterprise/finance/:id', requirePermission('enterprise:finance:write'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
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
    res.json({ ok: true, entry });
  });

  app.patch('/api/enterprise/automations/:id', requirePermission('paperclip:ops:write'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
    const flow = enterpriseState.automations.find((a) => a.id === req.params.id);
    if (!flow) {
      res.status(404).json({ error: 'Fluxo de automação não encontrado.' });
      return;
    }
    if (typeof req.body.active === 'boolean') {
      flow.active = req.body.active;
      appendAudit(actor.name, `${flow.active ? 'Ativou' : 'Pausou'} fluxo automatizado`, flow.name);
    }
    res.json({ ok: true, automation: flow });
  });

  app.post('/api/enterprise/automations', requirePermission('paperclip:ops:write'), (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
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
    res.status(201).json({ ok: true, automation: flow });
  });

  // ============================================================================
  // Paperclip Integration Router (Modular Backend-to-Paperclip Isolation)
  // ============================================================================
  app.use(createPaperclipRouter(appendAudit));

  // ============================================================================
  // Vite Dev Middleware or Static Production Serving
  // ============================================================================
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
    const pc = paperclipGateway.getStatus();
    console.log(`[TokenizAi] Servidor ativo na porta ${PORT} (Paperclip: ${pc.connectionLabel})`);
  });
}

startServer().catch((err) => {
  console.error('[TokenizAi] Erro fatal ao iniciar servidor:', err);
  process.exit(1);
});
