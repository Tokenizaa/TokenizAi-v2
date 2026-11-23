import express, { type Request, type Response, type Router } from 'express';
import {
  claimAdminPasscode,
  getAdminAuthStatus,
  loginAdminPasscode,
  logoutAdminToken,
  requireAdminAuth,
  requirePermission,
  resolveWorkspaceActor,
} from './adminAuth.ts';
import { paperclipGateway, PaperclipIntegrationError } from './index.ts';

function validateResourceId(id: string | undefined, label: string): string {
  const value = typeof id === 'string' ? id.trim() : '';
  if (
    !value ||
    value.length > 128 ||
    value.includes('..') ||
    /[\\/\s\x00-\x1f]/.test(value)
  ) {
    throw new PaperclipIntegrationError({
      kind: 'validation_error',
      statusCode: 400,
      message: `Identificador inválido para ${label}.`,
    });
  }
  return value;
}

function pickFields(raw: unknown, allowed: string[]): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in src && src[key] !== undefined) {
      out[key] = src[key];
    }
  }
  return out;
}

function parseLimit(raw: unknown, fallback = 50): number | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(Math.floor(num), 200);
}

const ISSUE_ALLOWED_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'assigneeAgentId',
  'assigneeUserId',
  'projectId',
  'goalId',
  'parentId',
  'blockedByIssueIds',
  'labels',
];

const PROJECT_ALLOWED_FIELDS = [
  'name',
  'description',
  'status',
  'leadAgentId',
  'goalIds',
  'targetDate',
];

const GOAL_ALLOWED_FIELDS = [
  'title',
  'description',
  'status',
  'level',
  'progressPercent',
  'ownerAgentId',
  'parentGoalId',
];

const ROUTINE_ALLOWED_FIELDS = [
  'name',
  'title',
  'description',
  'status',
  'enabled',
  'agentId',
  'projectId',
  'cron',
  'schedule',
  'prompt',
  'triggers',
];

const TRIGGER_ALLOWED_FIELDS = [
  'type',
  'kind',
  'enabled',
  'schedule',
  'cron',
  'webhookUrl',
  'config',
  'label',
];

const AGENT_SIGNAL_ALLOWED_FIELDS = ['reason', 'source', 'payload', 'context', 'issueId', 'force'];

export function createPaperclipRouter(
  appendAudit: (
    actor: string,
    action: string,
    target: string,
    origin?: 'Plataforma' | 'Paperclip Proxy' | 'Segurança',
  ) => void,
): Router {
  const router = express.Router();

  const sendError = (res: Response, err: unknown) => {
    if (err instanceof PaperclipIntegrationError) {
      res.status(err.statusCode).json({
        ok: false,
        error: err.message,
        kind: err.kind,
        capabilityKey: err.capabilityKey || null,
      });
      return;
    }
    res.status(502).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Erro na comunicação com o Paperclip.',
      kind: 'communication_error',
    });
  };

  // ============================================================================
  // TokenizAi Admin Authentication (protects integration refresh & admin actions)
  // ============================================================================
  router.get('/api/admin/auth/status', (req: Request, res: Response) => {
    res.json({ ok: true, ...getAdminAuthStatus(req.headers.authorization) });
  });

  router.post('/api/admin/auth/claim', (req: Request, res: Response) => {
    const { password } = req.body as { password?: string };
    const result = claimAdminPasscode(password || '');
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    appendAudit(result.actor.name, 'Inicializou credencial administrativa local', 'Integração Paperclip', 'Segurança');
    res.status(201).json({ ok: true, token: result.token, expiresAt: result.expiresAt, actor: result.actor });
  });

  router.post('/api/admin/auth/login', (req: Request, res: Response) => {
    const { password } = req.body as { password?: string };
    const result = loginAdminPasscode(password || '');
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    appendAudit(result.actor.name, 'Autenticou sessão administrativa', 'Integração Paperclip', 'Segurança');
    res.json({ ok: true, token: result.token, expiresAt: result.expiresAt, actor: result.actor });
  });

  router.post('/api/admin/auth/logout', (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
    logoutAdminToken(req.headers.authorization);
    if (actor.authenticated) {
      appendAudit(actor.name, 'Encerrou sessão autenticada', 'Integração Paperclip', 'Segurança');
    }
    res.json({ ok: true });
  });

  // ============================================================================
  // Integration Status, Capability Matrix & Protected Connection Refresh
  // ============================================================================
  router.get('/api/integrations/paperclip/status', requirePermission('read'), (_req: Request, res: Response) => {
    res.json({ ok: true, status: paperclipGateway.getStatus() });
  });

  router.post('/api/integrations/paperclip/refresh', requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { actor } = resolveWorkspaceActor(req);
      const status = await paperclipGateway.refresh();
      appendAudit(
        actor.name,
        `Executou teste/atualização da conexão Paperclip (${status.connectionLabel})`,
        status.companyName || status.host || 'Paperclip',
        'Paperclip Proxy',
      );
      res.json({ ok: true, status });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/integrations/paperclip/overview', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const bundle = await paperclipGateway.getOverviewBundle();
      res.json({ ok: true, ...bundle });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Agents Domain (/api/paperclip/agents/*)
  // ============================================================================
  router.get('/api/paperclip/agents', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('agents:read');
      const agents = await paperclipGateway.agents.listAgents();
      res.json({ ok: true, agents });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/agents/:agentId', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const agentId = validateResourceId(req.params.agentId, 'agente');
      paperclipGateway.ensureCapabilityAvailable('agents:read');
      const agent = await paperclipGateway.agents.getAgent(agentId);
      res.json({ ok: true, agent });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/agents/:agentId/runtime-state', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const agentId = validateResourceId(req.params.agentId, 'agente');
      paperclipGateway.ensureCapabilityAvailable('agents:manage');
      const runtimeState = await paperclipGateway.agents.getRuntimeState(agentId);
      res.json({ ok: true, runtimeState });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/agents/:agentId/wakeup', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const agentId = validateResourceId(req.params.agentId, 'agente');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('agents:manage');
      const result = await paperclipGateway.agents.wakeup(agentId, pickFields(req.body, AGENT_SIGNAL_ALLOWED_FIELDS));
      appendAudit(actor.name, 'Acionou wakeup no Paperclip', agentId, 'Paperclip Proxy');
      res.json({ ok: true, result });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/agents/:agentId/heartbeat', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const agentId = validateResourceId(req.params.agentId, 'agente');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('agents:manage');
      const result = await paperclipGateway.agents.invokeHeartbeat(agentId, pickFields(req.body, AGENT_SIGNAL_ALLOWED_FIELDS));
      appendAudit(actor.name, 'Disparou heartbeat no Paperclip', agentId, 'Paperclip Proxy');
      res.json({ ok: true, result });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/agents/:agentId/pause', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const agentId = validateResourceId(req.params.agentId, 'agente');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('agents:manage');
      const result = await paperclipGateway.agents.pause(agentId);
      appendAudit(actor.name, 'Pausou agente no Paperclip', agentId, 'Paperclip Proxy');
      res.json({ ok: true, result });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/agents/:agentId/resume', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const agentId = validateResourceId(req.params.agentId, 'agente');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('agents:manage');
      const result = await paperclipGateway.agents.resume(agentId);
      appendAudit(actor.name, 'Retomou agente no Paperclip', agentId, 'Paperclip Proxy');
      res.json({ ok: true, result });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/agents/hire', requirePermission('admin:integration'), async (req: Request, res: Response) => {
    try {
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('agents:manage');
      const { specialistId, slug, name, division, adapter, monthlyBudgetBRL, team, directorate } = req.body as {
        specialistId?: string;
        slug?: string;
        name?: string;
        division?: string;
        adapter?: string;
        monthlyBudgetBRL?: number;
        team?: string;
        directorate?: string;
      };
      if (!slug || !slug.trim() || !name || !name.trim()) {
        res.status(400).json({ error: 'Especialista inválido para alocação no Paperclip.' });
        return;
      }
      const budgetNum = Number(monthlyBudgetBRL);
      if (monthlyBudgetBRL !== undefined && (!Number.isFinite(budgetNum) || budgetNum <= 0)) {
        res.status(400).json({ error: 'Orçamento mensal deve ser um valor positivo.' });
        return;
      }
      const agent = await paperclipGateway.agents.createAgent({
        name: slug.trim(),
        title: name.trim(),
        role: division?.trim() || 'Especialista',
        adapterType: adapter?.trim() || 'paperclip_runner',
        budgetMonthlyCents: Math.round((Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : 1000) * 100),
        metadata: {
          source: 'tokenizai-agency-library',
          specialistId: specialistId?.trim(),
          slug: slug.trim(),
          department: team?.trim() || division?.trim(),
          directorate,
        },
      });
      appendAudit(actor.name, `Alocou especialista ${name.trim()} no Paperclip`, slug.trim(), 'Paperclip Proxy');
      res.status(201).json({ ok: true, agent });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete('/api/paperclip/agents/:agentId', requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const agentId = validateResourceId(req.params.agentId, 'agente');
      const { actor } = resolveWorkspaceActor(req);
      if (req.headers['x-confirm-destructive'] !== 'TERMINATE_AGENT') {
        res.status(400).json({ error: 'Confirmação explícita obrigatória para encerramento do agente.' });
        return;
      }
      paperclipGateway.ensureCapabilityAvailable('agents:manage');
      const result = await paperclipGateway.agents.terminateAgent(agentId);
      appendAudit(actor.name, 'Encerrou agente no Paperclip', agentId, 'Paperclip Proxy');
      res.json({ ok: true, result });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Org / Teams & Directorate (/api/paperclip/org/*)
  // ============================================================================
  router.get('/api/paperclip/org', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('org:read');
      const org = await paperclipGateway.org.getOrganization();
      res.json({ ok: true, ...org });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Agent Chat (/api/paperclip/chats/*)
  // ============================================================================
  router.get('/api/paperclip/chats', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('agent_chat:read');
      const chats = await paperclipGateway.chats.listChats();
      res.json({ ok: true, chats });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/chats/:agentRef', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const agentRef = validateResourceId(req.params.agentRef, 'conversa com agente');
      paperclipGateway.ensureCapabilityAvailable('agent_chat:read');
      const chat = await paperclipGateway.chats.getChat(agentRef);
      res.json({ ok: true, ...chat });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/chats/:agentRef', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const agentRef = validateResourceId(req.params.agentRef, 'conversa com agente');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('agent_chat:write');
      const { body, issueId } = req.body as { body?: string; issueId?: string };
      if (!body || typeof body !== 'string' || !body.trim()) {
        res.status(400).json({ error: 'Mensagem não pode ser vazia.' });
        return;
      }
      if (issueId !== undefined && typeof issueId !== 'string') {
        res.status(400).json({ error: 'Identificador da issue inválido.' });
        return;
      }
      const cleanIssueId = issueId ? validateResourceId(issueId, 'issue') : undefined;
      const result = await paperclipGateway.chats.sendMessage(agentRef, { body: body.trim(), issueId: cleanIssueId });
      appendAudit(actor.name, body.trim() === '/new' ? 'Iniciou nova sessão de chat (/new)' : 'Enviou mensagem no Agent Chat', agentRef, 'Paperclip Proxy');
      res.status(201).json({ ok: true, ...result });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Issues / Tasks (/api/paperclip/issues/*)
  // ============================================================================
  router.get('/api/paperclip/issues', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('issues:read');
      const issues = await paperclipGateway.issues.listIssues({
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        assigneeAgentId: typeof req.query.assigneeAgentId === 'string' ? req.query.assigneeAgentId : undefined,
        assigneeUserId: typeof req.query.assigneeUserId === 'string' ? req.query.assigneeUserId : undefined,
        participantAgentId: typeof req.query.participantAgentId === 'string' ? req.query.participantAgentId : undefined,
        projectId: typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
        parentId: typeof req.query.parentId === 'string' ? req.query.parentId : undefined,
        labelId: typeof req.query.labelId === 'string' ? req.query.labelId : undefined,
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        limit: parseLimit(req.query.limit, 100),
        originKind: typeof req.query.originKind === 'string' ? req.query.originKind : undefined,
        originId: typeof req.query.originId === 'string' ? req.query.originId : undefined,
      });
      res.json({ ok: true, issues });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/issues', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('issues:write');
      const payload = pickFields(req.body, ISSUE_ALLOWED_FIELDS);
      if (typeof payload.title !== 'string' || !payload.title.trim()) {
        res.status(400).json({ error: 'Título da tarefa é obrigatório.' });
        return;
      }
      payload.title = payload.title.trim();
      const issue = await paperclipGateway.issues.createIssue(payload);
      appendAudit(actor.name, 'Criou tarefa no Paperclip', issue.identifier || issue.title, 'Paperclip Proxy');
      res.status(201).json({ ok: true, issue });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/issues/:issueId', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const issueId = validateResourceId(req.params.issueId, 'issue');
      paperclipGateway.ensureCapabilityAvailable('issues:read');
      const issue = await paperclipGateway.issues.getIssue(issueId);
      res.json({ ok: true, issue });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.patch('/api/paperclip/issues/:issueId', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const issueId = validateResourceId(req.params.issueId, 'issue');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('issues:write');
      const payload = pickFields(req.body, ISSUE_ALLOWED_FIELDS);
      if (Object.keys(payload).length === 0) {
        res.status(400).json({ error: 'Nenhum campo válido informado para atualização da tarefa.' });
        return;
      }
      const issue = await paperclipGateway.issues.updateIssue(issueId, payload);
      appendAudit(actor.name, 'Atualizou tarefa no Paperclip', issue.identifier || issueId, 'Paperclip Proxy');
      res.json({ ok: true, issue });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/issues/:issueId/comments', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const issueId = validateResourceId(req.params.issueId, 'issue');
      paperclipGateway.ensureCapabilityAvailable('issues:read');
      const comments = await paperclipGateway.issues.getComments(issueId);
      res.json({ ok: true, comments });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/issues/:issueId/comments', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const issueId = validateResourceId(req.params.issueId, 'issue');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('issues:write');
      const { body } = req.body as { body?: string };
      if (!body || typeof body !== 'string' || !body.trim()) {
        res.status(400).json({ error: 'Texto do comentário é obrigatório.' });
        return;
      }
      const comment = await paperclipGateway.issues.addComment(issueId, body.trim());
      appendAudit(actor.name, 'Publicou comentário em issue no Paperclip', issueId, 'Paperclip Proxy');
      res.status(201).json({ ok: true, comment });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/issues/:issueId/runs', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const issueId = validateResourceId(req.params.issueId, 'issue');
      paperclipGateway.ensureCapabilityAvailable('issues:read');
      const runs = await paperclipGateway.issues.getRuns(issueId);
      res.json({ ok: true, runs });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/issues/:issueId/documents', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const issueId = validateResourceId(req.params.issueId, 'issue');
      paperclipGateway.ensureCapabilityAvailable('issues:read');
      const documents = await paperclipGateway.issues.getDocuments(issueId);
      res.json({ ok: true, documents });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/issues/:issueId/attachments', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const issueId = validateResourceId(req.params.issueId, 'issue');
      paperclipGateway.ensureCapabilityAvailable('attachments:read');
      const attachments = await paperclipGateway.issues.getAttachments(issueId);
      res.json({ ok: true, attachments });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/issues/:issueId/attachments', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const issueId = validateResourceId(req.params.issueId, 'issue');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('attachments:write');
      const { filename, contentType, base64Content } = req.body as {
        filename?: string;
        contentType?: string;
        base64Content?: string;
      };
      if (!filename || typeof filename !== 'string' || !base64Content || typeof base64Content !== 'string') {
        res.status(400).json({ error: 'Arquivo e nome do anexo são obrigatórios.' });
        return;
      }
      const attachment = await paperclipGateway.attachments.uploadToIssue(issueId, {
        filename,
        contentType: typeof contentType === 'string' && contentType.trim() ? contentType.trim() : 'application/octet-stream',
        base64Content,
      });
      appendAudit(actor.name, `Enviou anexo (${attachment.filename}) para issue`, issueId, 'Paperclip Proxy');
      res.status(201).json({ ok: true, attachment });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/issues/:issueId/interactions', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const issueId = validateResourceId(req.params.issueId, 'issue');
      paperclipGateway.ensureCapabilityAvailable('issues:read');
      const interactions = await paperclipGateway.issues.getInteractions(issueId);
      res.json({ ok: true, interactions });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Heartbeat Runs (/api/paperclip/runs/*)
  // ============================================================================
  router.get('/api/paperclip/runs', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('runs:read');
      const runs = await paperclipGateway.runs.listRuns({
        agentId: typeof req.query.agentId === 'string' ? req.query.agentId : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        limit: parseLimit(req.query.limit, 50),
      });
      res.json({ ok: true, runs });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/runs/:runId', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const runId = validateResourceId(req.params.runId, 'execução');
      paperclipGateway.ensureCapabilityAvailable('runs:read');
      const run = await paperclipGateway.runs.getRun(runId);
      res.json({ ok: true, run });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/runs/:runId/issues', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const runId = validateResourceId(req.params.runId, 'execução');
      paperclipGateway.ensureCapabilityAvailable('runs:read');
      const issues = await paperclipGateway.runs.getRunIssues(runId);
      res.json({ ok: true, issues });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/runs/:runId/events', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const runId = validateResourceId(req.params.runId, 'execução');
      paperclipGateway.ensureCapabilityAvailable('runs:read');
      const detail = await paperclipGateway.runs.getRunEvents(runId);
      res.json({ ok: true, ...detail });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/runs/:runId/cancel', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const runId = validateResourceId(req.params.runId, 'execução');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('runs:cancel');
      const result = await paperclipGateway.runs.cancelRun(runId);
      appendAudit(actor.name, 'Cancelou execução no Paperclip', runId, 'Paperclip Proxy');
      res.json({ ok: true, result });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Operational Projects & Goals (/api/paperclip/projects/* & /api/paperclip/goals/*)
  // ============================================================================
  router.get('/api/paperclip/projects', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('projects:read');
      const projects = await paperclipGateway.projects.listProjects();
      res.json({ ok: true, projects });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/projects', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('projects:write');
      const payload = pickFields(req.body, PROJECT_ALLOWED_FIELDS);
      if (typeof payload.name !== 'string' || !payload.name.trim()) {
        res.status(400).json({ error: 'Nome do projeto Paperclip é obrigatório.' });
        return;
      }
      const project = await paperclipGateway.projects.createProject(payload);
      appendAudit(actor.name, 'Criou projeto operacional no Paperclip', project.name, 'Paperclip Proxy');
      res.status(201).json({ ok: true, project });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/projects/:projectId', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const projectId = validateResourceId(req.params.projectId, 'projeto');
      paperclipGateway.ensureCapabilityAvailable('projects:read');
      const project = await paperclipGateway.projects.getProject(projectId);
      res.json({ ok: true, project });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.patch('/api/paperclip/projects/:projectId', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const projectId = validateResourceId(req.params.projectId, 'projeto');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('projects:write');
      const payload = pickFields(req.body, PROJECT_ALLOWED_FIELDS);
      const project = await paperclipGateway.projects.updateProject(projectId, payload);
      appendAudit(actor.name, 'Atualizou projeto operacional no Paperclip', project.name, 'Paperclip Proxy');
      res.json({ ok: true, project });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/goals', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('projects:read');
      const goals = await paperclipGateway.projects.listGoals();
      res.json({ ok: true, goals });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/goals', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('projects:write');
      const payload = pickFields(req.body, GOAL_ALLOWED_FIELDS);
      if (typeof payload.title !== 'string' || !payload.title.trim()) {
        res.status(400).json({ error: 'Título da meta é obrigatório.' });
        return;
      }
      const goal = await paperclipGateway.projects.createGoal(payload);
      appendAudit(actor.name, 'Criou objetivo estratégico no Paperclip', goal.title, 'Paperclip Proxy');
      res.status(201).json({ ok: true, goal });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/goals/:goalId', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const goalId = validateResourceId(req.params.goalId, 'meta');
      paperclipGateway.ensureCapabilityAvailable('projects:read');
      const goal = await paperclipGateway.projects.getGoal(goalId);
      res.json({ ok: true, goal });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.patch('/api/paperclip/goals/:goalId', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const goalId = validateResourceId(req.params.goalId, 'meta');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('projects:write');
      const payload = pickFields(req.body, GOAL_ALLOWED_FIELDS);
      const goal = await paperclipGateway.projects.updateGoal(goalId, payload);
      appendAudit(actor.name, 'Atualizou objetivo no Paperclip', goal.title, 'Paperclip Proxy');
      res.json({ ok: true, goal });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Routines & Triggers (/api/paperclip/routines/*)
  // ============================================================================
  router.get('/api/paperclip/routines', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('routines:read');
      const routines = await paperclipGateway.routines.listRoutines();
      res.json({ ok: true, routines });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/routines', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('routines:manage');
      const payload = pickFields(req.body, ROUTINE_ALLOWED_FIELDS);
      if (typeof payload.name !== 'string' && typeof payload.title !== 'string') {
        res.status(400).json({ error: 'Nome da rotina é obrigatório.' });
        return;
      }
      const routine = await paperclipGateway.routines.createRoutine(payload);
      appendAudit(actor.name, 'Criou rotina no Paperclip', routine.name, 'Paperclip Proxy');
      res.status(201).json({ ok: true, routine });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/routines/:routineId', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const routineId = validateResourceId(req.params.routineId, 'rotina');
      paperclipGateway.ensureCapabilityAvailable('routines:read');
      const routine = await paperclipGateway.routines.getRoutine(routineId);
      res.json({ ok: true, routine });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.patch('/api/paperclip/routines/:routineId', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const routineId = validateResourceId(req.params.routineId, 'rotina');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('routines:manage');
      const payload = pickFields(req.body, ROUTINE_ALLOWED_FIELDS);
      const routine = await paperclipGateway.routines.updateRoutine(routineId, payload);
      appendAudit(actor.name, 'Atualizou rotina no Paperclip', routine.name, 'Paperclip Proxy');
      res.json({ ok: true, routine });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/routines/:routineId/runs', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const routineId = validateResourceId(req.params.routineId, 'rotina');
      paperclipGateway.ensureCapabilityAvailable('routines:read');
      const runs = await paperclipGateway.routines.getRoutineRuns(routineId);
      res.json({ ok: true, runs });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/routines/:routineId/run', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const routineId = validateResourceId(req.params.routineId, 'rotina');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('routines:manage');
      const result = await paperclipGateway.routines.runManually(routineId, pickFields(req.body, AGENT_SIGNAL_ALLOWED_FIELDS));
      appendAudit(actor.name, 'Executou rotina manual no Paperclip', routineId, 'Paperclip Proxy');
      res.json({ ok: true, result });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/routines/:routineId/triggers', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const routineId = validateResourceId(req.params.routineId, 'rotina');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('routines:manage');
      const trigger = await paperclipGateway.routines.createTrigger(routineId, pickFields(req.body, TRIGGER_ALLOWED_FIELDS));
      appendAudit(actor.name, 'Criou gatilho de rotina no Paperclip', routineId, 'Paperclip Proxy');
      res.status(201).json({ ok: true, trigger });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.patch('/api/paperclip/routines/:routineId/triggers/:triggerId', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const routineId = validateResourceId(req.params.routineId, 'rotina');
      const triggerId = validateResourceId(req.params.triggerId, 'gatilho');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('routines:manage');
      const trigger = await paperclipGateway.routines.updateTrigger(routineId, triggerId, pickFields(req.body, TRIGGER_ALLOWED_FIELDS));
      appendAudit(actor.name, 'Atualizou gatilho de rotina no Paperclip', triggerId, 'Paperclip Proxy');
      res.json({ ok: true, trigger });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Approvals & Governance (/api/paperclip/approvals/*)
  // ============================================================================
  router.get('/api/paperclip/approvals', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('approvals:read');
      const approvals = await paperclipGateway.approvals.listApprovals();
      res.json({ ok: true, approvals });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/approvals', requirePermission('paperclip:ops:write'), async (req: Request, res: Response) => {
    try {
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('approvals:manage');
      const payload = pickFields(req.body, ['type', 'title', 'description', 'reason', 'issueId', 'approverUserId', 'payload']);
      const approval = await paperclipGateway.approvals.createApproval(payload);
      appendAudit(actor.name, 'Solicitou aprovação de governança no Paperclip', approval.title, 'Paperclip Proxy');
      res.status(201).json({ ok: true, approval });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/approvals/:approvalId', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const approvalId = validateResourceId(req.params.approvalId, 'aprovação');
      paperclipGateway.ensureCapabilityAvailable('approvals:read');
      const approval = await paperclipGateway.approvals.getApproval(approvalId);
      res.json({ ok: true, approval });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/approvals/:approvalId/approve', requirePermission('approvals:decide'), async (req: Request, res: Response) => {
    try {
      const approvalId = validateResourceId(req.params.approvalId, 'aprovação');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('approvals:manage');
      const { note } = req.body as { note?: string };
      const cleanNote = typeof note === 'string' && note.trim() ? note.trim() : undefined;
      const result = await paperclipGateway.approvals.approve(approvalId, cleanNote, actor.paperclipUserId);
      appendAudit(actor.name, 'Aprovou solicitação no Paperclip', approvalId, 'Paperclip Proxy');
      res.json({ ok: true, result });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/approvals/:approvalId/reject', requirePermission('approvals:decide'), async (req: Request, res: Response) => {
    try {
      const approvalId = validateResourceId(req.params.approvalId, 'aprovação');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('approvals:manage');
      const { note } = req.body as { note?: string };
      const cleanNote = typeof note === 'string' && note.trim() ? note.trim() : undefined;
      const result = await paperclipGateway.approvals.reject(approvalId, cleanNote, actor.paperclipUserId);
      appendAudit(actor.name, 'Rejeitou solicitação no Paperclip', approvalId, 'Paperclip Proxy');
      res.json({ ok: true, result });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/paperclip/approvals/:approvalId/request-revision', requirePermission('approvals:decide'), async (req: Request, res: Response) => {
    try {
      const approvalId = validateResourceId(req.params.approvalId, 'aprovação');
      const { actor } = resolveWorkspaceActor(req);
      paperclipGateway.ensureCapabilityAvailable('approvals:manage');
      const { note } = req.body as { note?: string };
      if (!note || typeof note !== 'string' || !note.trim()) {
        res.status(400).json({ error: 'Informe uma justificativa para solicitar revisão.' });
        return;
      }
      const result = await paperclipGateway.approvals.requestRevision(approvalId, note.trim(), actor.paperclipUserId);
      appendAudit(actor.name, 'Solicitou revisão no Paperclip', approvalId, 'Paperclip Proxy');
      res.json({ ok: true, result });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Costs, Activity, Audit & Attachments
  // ============================================================================
  router.get('/api/paperclip/costs/summary', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('costs:read');
      const summary = await paperclipGateway.costs.getSummary({
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
      });
      res.json({ ok: true, summary });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/costs/by-agent', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('costs:read');
      const data = await paperclipGateway.costs.getByAgent({
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
      });
      res.json({ ok: true, data });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/costs/by-project', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('costs:read');
      const data = await paperclipGateway.costs.getByProject({
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
      });
      res.json({ ok: true, data });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/costs/data-quality', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('costs:read');
      const data = await paperclipGateway.costs.getDataQuality();
      res.json({ ok: true, data });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/dashboard', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('activity:read');
      const dashboard = await paperclipGateway.costs.getDashboard();
      res.json({ ok: true, dashboard });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/activity', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('activity:read');
      const limit = parseLimit(req.query.limit, 50) ?? 50;
      const activity = await paperclipGateway.activity.listActivity(limit);
      res.json({ ok: true, activity });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/activity/agent-actions', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      paperclipGateway.ensureCapabilityAvailable('activity:read');
      const limit = parseLimit(req.query.limit, 50) ?? 50;
      const actions = await paperclipGateway.activity.listAgentActionsAudit(limit);
      res.json({ ok: true, actions });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/paperclip/attachments/:attachmentId/content', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const attachmentId = validateResourceId(req.params.attachmentId, 'anexo');
      paperclipGateway.ensureCapabilityAvailable('attachments:read');
      const file = await paperclipGateway.attachments.getContent(attachmentId);
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (file.contentDisposition) {
        res.setHeader('Content-Disposition', file.contentDisposition);
      }
      res.send(file.buffer);
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

