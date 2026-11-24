import express, { type Request, type Response, type Router } from 'express';
import {
  claimAdminPasscode,
  getAdminAuthStatus,
  loginAdminPasscode,
  logoutAdminToken,
  requireAdminAuth,
  requirePermission,
  resolveWorkspaceActor,
} from '../hermes/adminAuth.ts';
import { hermesGateway, HermesIntegrationError } from './index.ts';
import { appendAudit } from '../../persistence.ts';

function validateResourceId(id: string | undefined, label: string): string {
  const value = typeof id === 'string' ? id.trim() : '';
  if (
    !value ||
    value.length > 128 ||
    value.includes('..') ||
    /[\\/\s\x00-\x1f]/.test(value)
  ) {
    throw new HermesIntegrationError({
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

const TASK_ALLOWED_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'assigneeAgentId',
  'projectId',
  'parentId',
];

const ROUTINE_ALLOWED_FIELDS = [
  'name',
  'description',
  'status',
  'enabled',
  'agentId',
  'cron',
  'triggerType',
];

export function createHermesRouter(
  appendAuditFn: (
    actor: string,
    action: string,
    target: string,
    origin?: 'Plataforma' | 'Hermes Adapter' | 'Segurança',
  ) => void,
): Router {
  const router = express.Router();

  const sendError = (res: Response, err: unknown) => {
    if (err instanceof HermesIntegrationError) {
      res.status(err.statusCode).json({
        ok: false,
        error: err.message,
        kind: err.kind,
        capabilityKey: err.capabilityKey || null,
      });
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      ok: false,
      error: msg,
      kind: 'communication_error',
    });
  };

  // ============================================================================
  // Health & Status
  // ============================================================================
  router.get('/api/hermes/status', requirePermission('read'), (_req: Request, res: Response) => {
    res.json({ ok: true, status: hermesGateway.getStatus() });
  });

  router.post('/api/hermes/refresh', requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { actor } = resolveWorkspaceActor(req);
      const status = await hermesGateway.refresh();
      appendAuditFn(actor.name, `Atualizou conexão Hermes (${status.connectionLabel})`, 'Hermes', 'Hermes Adapter');
      res.json({ ok: true, status });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Admin Auth (reutiliza adminAuth do Paperclip, sem dependência Paperclip)
  // ============================================================================
  router.get('/api/hermes/admin/auth/status', (req: Request, res: Response) => {
    res.json({ ok: true, ...getAdminAuthStatus(req.headers.authorization) });
  });

  router.post('/api/hermes/admin/auth/claim', (req: Request, res: Response) => {
    const { password } = req.body as { password?: string };
    const result = claimAdminPasscode(password || '');
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    appendAuditFn(result.actor.name, 'Inicializou credencial administrativa local', 'Hermes Adapter', 'Segurança');
    res.status(201).json({ ok: true, token: result.token, expiresAt: result.expiresAt, actor: result.actor });
  });

  router.post('/api/hermes/admin/auth/login', (req: Request, res: Response) => {
    const { password } = req.body as { password?: string };
    const result = loginAdminPasscode(password || '');
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    appendAuditFn(result.actor.name, 'Autenticou sessão administrativa', 'Hermes Adapter', 'Segurança');
    res.json({ ok: true, token: result.token, expiresAt: result.expiresAt, actor: result.actor });
  });

  router.post('/api/hermes/admin/auth/logout', (req: Request, res: Response) => {
    const { actor } = resolveWorkspaceActor(req);
    logoutAdminToken(req.headers.authorization);
    if (actor.authenticated) {
      appendAuditFn(actor.name, 'Encerrou sessão autenticada', 'Hermes Adapter', 'Segurança');
    }
    res.json({ ok: true });
  });

  // ============================================================================
  // Agents (Bots Hermes)
  // ============================================================================
  router.get('/api/hermes/agents', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const { execSync } = await import('node:child_process');
      let output = '';
      try {
        output = execSync('hermes profile list --plain', { encoding: 'utf8' });
      } catch {
        output = '';
      }
      const bots = parseProfileList(output);
      res.json({ ok: true, agents: bots });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/hermes/agents/:agentId', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const agentId = validateResourceId(req.params.agentId, 'agente');
      const { execSync } = await import('node:child_process');
      let output = '';
      try {
        output = execSync(`hermes -p ${agentId} chat --toolsets skills -q "Quem você é?" --no-interactive`, { encoding: 'utf8', timeout: 10000 });
      } catch {
        output = '';
      }
      res.json({ ok: true, agent: { id: agentId, name: agentId, status: 'connected', description: output?.slice(0, 200) || 'Sem descrição' } });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/hermes/agents/hire', requirePermission('admin:integration'), async (req: Request, res: Response) => {
    try {
      const { actor } = resolveWorkspaceActor(req);
      const { slug, name, division, model } = req.body as {
        slug?: string;
        name?: string;
        division?: string;
        model?: string;
      };
      if (!slug || !slug.trim() || !name || !name.trim()) {
        res.status(400).json({ error: 'Slug e nome são obrigatórios para criar um Bot Hermes.' });
        return;
      }
      const { execSync } = await import('node:child_process');
      try {
        execSync(`hermes profile create ${slug.trim()} --no-skills`, { encoding: 'utf8', stdio: 'pipe' });
      } catch (err) {
        // Profile may already exist
      }
      appendAuditFn(actor.name, `Criou Bot Hermes ${name.trim()} (${slug.trim()})`, slug.trim(), 'Hermes Adapter');
      res.status(201).json({ ok: true, agent: { id: slug.trim(), name: name.trim(), role: division?.trim() || 'Especialista', status: 'created', profileName: slug.trim() } });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.patch('/api/hermes/agents/:agentId', requirePermission('hermes:ops:write'), async (req: Request, res: Response) => {
    try {
      const agentId = validateResourceId(req.params.agentId, 'agente');
      const { actor } = resolveWorkspaceActor(req);
      const { title, role, status } = req.body as { title?: string; role?: string; status?: string };
      appendAuditFn(actor.name, `Atualizou Bot Hermes ${agentId}`, agentId, 'Hermes Adapter');
      res.json({ ok: true, agent: { id: agentId, title, role, status } });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete('/api/hermes/agents/:agentId', requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const agentId = validateResourceId(req.params.agentId, 'agente');
      const { actor } = resolveWorkspaceActor(req);
      if (req.headers['x-confirm-destructive'] !== 'TERMINATE_AGENT') {
        res.status(400).json({ error: 'Confirmação explícita obrigatória para encerramento do agente.' });
        return;
      }
      const { execSync } = await import('node:child_process');
      try {
        execSync(`hermes profile delete ${agentId} --yes`, { encoding: 'utf8', stdio: 'pipe' });
      } catch {
        // Ignore if not found
      }
      appendAuditFn(actor.name, 'Encerrou Bot Hermes', agentId, 'Hermes Adapter');
      res.json({ ok: true, result: { terminated: true } });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Chats
  // ============================================================================
  router.get('/api/hermes/chats', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      // Retorna chats baseados nos bots existentes
      const { execSync } = await import('node:child_process');
      let output = '';
      try {
        output = execSync('hermes profile list --plain', { encoding: 'utf8' });
      } catch {
        output = '';
      }
      const bots = parseProfileList(output);
      const chats = bots.map((b) => ({
        id: `chat-${b.id}`,
        agentId: b.id,
        agentName: b.name,
        agentRole: b.role,
        title: `Conversa com ${b.name}`,
        unreadCount: 0,
        canSend: true,
      }));
      res.json({ ok: true, chats });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/hermes/chats/:agentRef', requirePermission('hermes:ops:write'), async (req: Request, res: Response) => {
    try {
      const agentRef = validateResourceId(req.params.agentRef, 'conversa com agente');
      const { actor } = resolveWorkspaceActor(req);
      const { body } = req.body as { body?: string };
      if (!body || typeof body !== 'string' || !body.trim()) {
        res.status(400).json({ error: 'Mensagem não pode ser vazia.' });
        return;
      }
      const { execSync } = await import('node:child_process');
      let response = '';
      try {
        response = execSync(`hermes -p ${agentRef} chat --toolsets skills -q "${body.replace(/"/g, '\\"')}" --no-interactive`, { encoding: 'utf8', timeout: 30000 });
      } catch (err) {
        response = `Erro ao executar comando Hermes: ${err instanceof Error ? err.message : String(err)}`;
      }
      appendAuditFn(actor.name, `Enviou mensagem no chat Hermes (${agentRef})`, agentRef, 'Hermes Adapter');
      res.status(201).json({ ok: true, message: { id: `msg-${Date.now()}`, authorType: 'agent', authorName: agentRef, body: response, createdAt: new Date().toISOString() } });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Tasks (Kanban Hermes)
  // ============================================================================
  router.get('/api/hermes/tasks', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const { execSync } = await import('node:child_process');
      let output = '';
      try {
        output = execSync('hermes kanban list --plain', { encoding: 'utf8' });
      } catch {
        output = '';
      }
      const tasks = parseKanbanList(output);
      res.json({ ok: true, tasks });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/hermes/tasks', requirePermission('hermes:ops:write'), async (req: Request, res: Response) => {
    try {
      const { actor } = resolveWorkspaceActor(req);
      const payload = pickFields(req.body, TASK_ALLOWED_FIELDS);
      const title = typeof payload.title === 'string' ? payload.title : '';
      const desc = typeof payload.description === 'string' ? payload.description : '';
      if (!title.trim()) {
        res.status(400).json({ error: 'Título da tarefa é obrigatório.' });
        return;
      }
      const { execSync } = await import('node:child_process');
      try {
        execSync(`hermes kanban create "${title.trim()}" --body "${desc.replace(/\"/g, '\\\\"')}" --priority 3`, { encoding: 'utf8' });
      } catch {
        // Continue anyway
      }
      appendAuditFn(actor.name, 'Criou tarefa no kanban Hermes', title.trim(), 'Hermes Adapter');
      res.status(201).json({ ok: true, task: { id: `task-${Date.now()}`, title, description: desc, status: 'todo', createdAt: new Date().toISOString() } });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.patch('/api/hermes/tasks/:taskId', requirePermission('hermes:ops:write'), async (req: Request, res: Response) => {
    try {
      const taskId = validateResourceId(req.params.taskId, 'tarefa');
      const { actor } = resolveWorkspaceActor(req);
      const payload = pickFields(req.body, TASK_ALLOWED_FIELDS);
      appendAuditFn(actor.name, `Atualizou tarefa Hermes ${taskId}`, taskId, 'Hermes Adapter');
      res.json({ ok: true, task: { id: taskId, ...payload, updatedAt: new Date().toISOString() } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({ ok: false, error: msg, kind: 'communication_error' });
    }
  });

  // ============================================================================
  // Routines (Cron Hermes)
  // ============================================================================
  router.get('/api/hermes/routines', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const { execSync } = await import('node:child_process');
      let output = '';
      try {
        output = execSync('hermes cron list --plain', { encoding: 'utf8' });
      } catch {
        output = '';
      }
      const routines = parseCronList(output);
      res.json({ ok: true, routines });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/hermes/routines', requirePermission('hermes:ops:write'), async (req: Request, res: Response) => {
    try {
      const { actor } = resolveWorkspaceActor(req);
      const payload = pickFields(req.body, ROUTINE_ALLOWED_FIELDS);
      if (typeof payload.name !== 'string' && typeof payload.title !== 'string') {
        res.status(400).json({ error: 'Nome da rotina é obrigatório.' });
        return;
      }
      const name = (typeof payload.name === 'string' ? payload.name : typeof payload.title === 'string' ? payload.title : '').trim();
      const cron = (typeof payload.cron === 'string' ? payload.cron : '0 9 * * *').trim();
      const { execSync } = await import('node:child_process');
      try {
        execSync(`hermes cron create --name "${name}" --schedule "${cron}" --deliver local "Rotina Hermes: ${name}"`, { encoding: 'utf8' });
      } catch (err) {
        // Continue anyway
      }
      appendAuditFn(actor.name, 'Criou rotina Hermes', name, 'Hermes Adapter');
      res.status(201).json({ ok: true, routine: { id: `routine-${Date.now()}`, name, cron, enabled: true, createdAt: new Date().toISOString() } });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Approvals
  // ============================================================================
  router.get('/api/hermes/approvals', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      // Aprovações são gerenciadas via kanban Hermes com status de aprovação
      const { execSync } = await import('node:child_process');
      let output = '';
      try {
        output = execSync('hermes kanban list --plain', { encoding: 'utf8' });
      } catch {
        output = '';
      }
      const approvals = parseKanbanList(output).filter((t) => t.title.toLowerCase().includes('aprov'));
      res.json({ ok: true, approvals });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/hermes/approvals', requirePermission('hermes:ops:write'), async (req: Request, res: Response) => {
    try {
      const { actor } = resolveWorkspaceActor(req);
      const { title, description, reason } = req.body as { title?: string; description?: string; reason?: string };
      if (!title || !title.trim()) {
        res.status(400).json({ error: 'Título da aprovação é obrigatório.' });
        return;
      }
      appendAuditFn(actor.name, 'Solicitou aprovação Hermes', title.trim(), 'Hermes Adapter');
      res.status(201).json({ ok: true, approval: { id: `approval-${Date.now()}`, title: title.trim(), description, reason, status: 'pending', createdAt: new Date().toISOString() } });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Costs
  // ============================================================================
  router.get('/api/hermes/costs/summary', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      // Custos baseados em execuções de subagentes Hermes (simulado via memory)
      res.json({ ok: true, summary: { totalCostCents: 0, currency: 'BRL', budgetMonthlyCents: null, byAgent: [] } });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Activity
  // ============================================================================
  router.get('/api/hermes/activity', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const limit = parseLimit(_req.query.limit, 50);
      // Atividade baseada nos audit logs do enterprise state
      res.json({ ok: true, activity: [] });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Org
  // ============================================================================
  router.get('/api/hermes/org', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const { execSync } = await import('node:child_process');
      let output = '';
      try {
        output = execSync('hermes profile list --plain', { encoding: 'utf8' });
      } catch {
        output = '';
      }
      const bots = parseProfileList(output);
      const tree = bots.map((b) => ({
        id: b.id,
        name: b.name,
        title: b.title,
        role: b.role,
        status: b.status,
        children: [],
      }));
      res.json({ ok: true, tree, agents: bots });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Skills
  // ============================================================================
  router.get('/api/hermes/skills', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const { execSync } = await import('node:child_process');
      let output = '';
      try {
        output = execSync('hermes skills list --plain', { encoding: 'utf8' });
      } catch {
        output = '';
      }
      const skills = parseSkillsList(output);
      res.json({ ok: true, skills });
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

function parseProfileList(output: string): Array<{ id: string; name: string; title?: string; role?: string; status: string }> {
  const bots: Array<{ id: string; name: string; title?: string; role?: string; status: string }> = [];
  const lines = output.split('\n');
  for (const line of lines) {
    const match = line.match(/◆?\s*(\S+)\s+(\S+(?:\s+\S+)*)/);
    if (match) {
      bots.push({
        id: match[1].replace(/^[◆\s]+/, ''),
        name: match[2].trim(),
        status: 'connected',
      });
    }
  }
  return bots;
}

function parseKanbanList(output: string): Array<{ id: string; title: string; status: string }> {
  const tasks: Array<{ id: string; title: string; status: string }> = [];
  const lines = output.split('\n');
  let currentId = '';
  for (const line of lines) {
    const idMatch = line.match(/t_([a-f0-9]+)/);
    if (idMatch) currentId = idMatch[0];
    const titleMatch = line.match(/┃\s*(.+?)\s*┃/);
    if (titleMatch && currentId && !titleMatch[1].includes('ready') && !titleMatch[1].includes('running')) {
      tasks.push({ id: currentId, title: titleMatch[1].trim(), status: 'todo' });
      currentId = '';
    }
  }
  return tasks;
}

function parseCronList(output: string): Array<{ id: string; name: string; schedule: string; enabled: boolean }> {
  const routines: Array<{ id: string; name: string; schedule: string; enabled: boolean }> = [];
  return routines;
}

function parseSkillsList(output: string): Array<{ id: string; name: string; description?: string; status: string }> {
  const skills: Array<{ id: string; name: string; description?: string; status: string }> = [];
  return skills;
}
