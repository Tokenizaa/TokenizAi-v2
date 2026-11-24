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
import {
  getCachedDomain,
  invalidateDomainCache,
  getCacheStats,
  fetchHermesJson,
  DOMAIN_TTL,
  HERMES_CLI,
  runCommandSafe,
} from './domainCache.ts';
import {
  parseProfileList,
  parseKanbanJson,
  parseCronList,
  parseSkillsList,
} from './domainParsers.ts';
import { appendAudit, createRun, listRuns, updateRun, createActivity, listActivities } from '../../persistence.ts';
import type { RunRecord } from '../../../src/types/platform.ts';

function validateResourceId(id: string | undefined, label: string): string {
  const value = typeof id === 'string' ? id.trim() : '';
  if (
    !value ||
    value.length > 128 ||
    value.includes('..') ||
    /[\\/\\\s\x00-\x1f]/.test(value)
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

  router.get('/api/hermes/cache/stats', requirePermission('read'), (_req: Request, res: Response) => {
    res.json({ ok: true, cache: getCacheStats() });
  });

  router.post('/api/hermes/cache/invalidate', requireAdminAuth, (req: Request, res: Response) => {
    const { key } = req.body as { key?: string };
    invalidateDomainCache(key);
    res.json({ ok: true, invalidated: key || 'all' });
  });

  router.post('/api/hermes/refresh', requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { actor } = resolveWorkspaceActor(req);
      const status = await hermesGateway.refresh();
      invalidateDomainCache('overview');
      invalidateDomainCache('agents');
      appendAuditFn(actor.name, `Atualizou conexão Hermes (${status.connectionLabel})`, 'Hermes', 'Hermes Adapter');
      res.json({ ok: true, status });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Overview Bundle (frontend loadAll) - cache por domínio + stale-while-revalidate
  // ============================================================================
  router.get('/api/hermes/overview', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      // Cada domínio buscado sequencialmente (Hermes CLI não suporta concorrência)
      // Mas permanece assíncrono: não bloqueia o event loop do Node.js
      const agents = await getCachedDomain(
        'overview:agents',
        () => fetchHermesJson(`${HERMES_CLI} profile list`, parseProfileList, 8000),
        DOMAIN_TTL.agents,
        []
      );

      const tasks = await getCachedDomain(
        'overview:tasks',
        () => fetchHermesJson(`${HERMES_CLI} kanban list --json`, parseKanbanJson, 8000),
        DOMAIN_TTL.tasks,
        []
      );

      const routines = await getCachedDomain(
        'overview:routines',
        () => fetchHermesJson(`${HERMES_CLI} cron list`, parseCronList, 5000),
        DOMAIN_TTL.routines,
        []
      );

      const skills = await getCachedDomain(
        'overview:skills',
        () => fetchHermesJson(`${HERMES_CLI} skills list --enabled-only`, parseSkillsList, 10000),
        DOMAIN_TTL.skills,
        []
      );

      const runs = listRuns();

      const approvals = tasks.filter((t) => t.title.toLowerCase().includes('aprov'));

      const chats = agents.map((b) => ({
        id: `chat-${b.id}`,
        agentId: b.id,
        agentName: b.name,
        agentRole: b.role,
        title: `Conversa com ${b.name}`,
        unreadCount: 0,
        canSend: true,
      }));

      const tree = agents.map((b) => ({
        id: b.id,
        name: b.name,
        title: b.title,
        role: b.role,
        status: b.status,
        children: [],
      }));

      const costs = calculateCostsSummary(runs);

      const activities = listActivities(50);

      const status = hermesGateway.getStatus();

      const bundle = {
        status,
        bots: agents,
        tasks,
        runs,
        routines,
        approvals,
        costs,
        activity: activities,
        skills,
        chats,
      };

      res.json({ ok: true, ...bundle });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Runs (histórico real de execuções)
  // ============================================================================
  router.get('/api/hermes/runs', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const runs = listRuns();
      res.json({ ok: true, runs });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/hermes/runs', requirePermission('hermes:ops:write'), async (req: Request, res: Response) => {
    try {
      const { actor } = resolveWorkspaceActor(req);
      const { agentId, agentName, taskId, triggerSource, costCents, currency } = req.body as {
        agentId?: string;
        agentName?: string;
        taskId?: string;
        triggerSource?: string;
        costCents?: number;
        currency?: string;
      };
      const run = createRun({
        agentId,
        agentName,
        taskId,
        status: 'queued',
        triggerSource: triggerSource || 'manual',
        startedAt: new Date().toISOString(),
        costCents,
        currency,
      });
      appendAuditFn(actor.name, `Criou run de execução ${run.id}`, run.id, 'Hermes Adapter');
      res.status(201).json({ ok: true, run });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Admin Auth
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
  // Agents (Bots Hermes) - cache por domínio
  // ============================================================================
  router.get('/api/hermes/agents', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const agents = await getCachedDomain(
        'agents',
        () => fetchHermesJson(`${HERMES_CLI} profile list`, parseProfileList, 8000),
        DOMAIN_TTL.agents,
        []
      );
      res.json({ ok: true, agents });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/api/hermes/agents/:agentId', requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const agentId = validateResourceId(req.params.agentId, 'agente');
      const { stdout } = await runCommandSafe(
        `${HERMES_CLI} -p ${agentId} chat --oneshot -q "Quem você é?"`,
        { timeoutMs: 10000 }
      );
      const description = stdout?.slice(0, 200) || 'Sem descrição';
      res.json({ ok: true, agent: { id: agentId, name: agentId, status: 'connected', description } });
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
      await runCommandSafe(
        `${HERMES_CLI} profile create ${slug.trim()} --no-skills`,
        { timeoutMs: 10000 }
      );
      invalidateDomainCache('agents');
      invalidateDomainCache('overview');
      appendAuditFn(actor.name, `Criou Bot Hermes ${name.trim()} (${slug.trim()})`, slug.trim(), 'Hermes Adapter');
      createActivity({
        actorName: actor.name,
        action: 'agent.hire',
        targetType: 'agent',
        targetId: slug.trim(),
        targetName: name.trim(),
        summary: `Division: ${division?.trim() || 'Especialista'}`,
        timestamp: new Date().toISOString(),
      });
      res.status(201).json({
        ok: true,
        agent: { id: slug.trim(), name: name.trim(), role: division?.trim() || 'Especialista', status: 'created', profileName: slug.trim() },
      });
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
      createActivity({
        actorName: actor.name,
        action: 'agent.update',
        targetType: 'agent',
        targetId: agentId,
        summary: `Role: ${role || 'unchanged'}`,
        timestamp: new Date().toISOString(),
      });
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
      await runCommandSafe(`${HERMES_CLI} profile delete ${agentId} --yes`, { timeoutMs: 10000 });
      invalidateDomainCache('agents');
      invalidateDomainCache('overview');
      appendAuditFn(actor.name, 'Encerrou Bot Hermes', agentId, 'Hermes Adapter');
      createActivity({
        actorName: actor.name,
        action: 'agent.delete',
        targetType: 'agent',
        targetId: agentId,
        timestamp: new Date().toISOString(),
      });
      res.json({ ok: true, result: { terminated: true } });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Chats - cache por domínio (agents)
  // ============================================================================
  router.get('/api/hermes/chats', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const agents = await getCachedDomain(
        'agents',
        () => fetchHermesJson(`${HERMES_CLI} profile list`, parseProfileList, 8000),
        DOMAIN_TTL.agents,
        []
      );
      const chats = agents.map((b) => ({
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
      const escapedBody = body.replace(/"/g, '\\"');
      const { stdout } = await runCommandSafe(
        `${HERMES_CLI} -p ${agentRef} chat --oneshot -q "${escapedBody}"`,
        { timeoutMs: 30000 }
      );
      appendAuditFn(actor.name, `Enviou mensagem no chat Hermes (${agentRef})`, agentRef, 'Hermes Adapter');
      createActivity({
        actorName: actor.name,
        action: 'chat.message',
        targetType: 'chat',
        targetId: agentRef,
        targetName: agentRef,
        summary: body.trim().slice(0, 100),
        timestamp: new Date().toISOString(),
      });

      // Criar run de execução associado ao chat
      const chatRun = createRun({
        agentId: agentRef,
        agentName: agentRef,
        status: 'completed',
        triggerSource: 'chat',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        resultSummary: stdout?.slice(0, 500) || 'Execução via chat',
        logs: [stdout || 'Sem resposta'],
      });

      res.status(201).json({
        ok: true,
        message: {
          id: `msg-${Date.now()}`,
          authorType: 'agent',
          authorName: agentRef,
          body: stdout || `Erro ao executar comando Hermes`,
          createdAt: new Date().toISOString(),
        },
        run: chatRun,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Tasks (Kanban Hermes) - cache por domínio
  // ============================================================================
  router.get('/api/hermes/tasks', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const tasks = await getCachedDomain(
        'tasks',
        () => fetchHermesJson(`${HERMES_CLI} kanban list --json`, parseKanbanJson, 8000),
        DOMAIN_TTL.tasks,
        []
      );
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
      const escapedTitle = title.trim().replace(/"/g, '\\"');
      const escapedDesc = desc.replace(/"/g, '\\"');
      await runCommandSafe(
        `${HERMES_CLI} kanban create "${escapedTitle}" --body "${escapedDesc}" --priority 3`,
        { timeoutMs: 10000 }
      );
      invalidateDomainCache('tasks');
      invalidateDomainCache('overview');
      appendAuditFn(actor.name, 'Criou tarefa no kanban Hermes', title.trim(), 'Hermes Adapter');
      createActivity({
        actorName: actor.name,
        action: 'task.create',
        targetType: 'task',
        targetId: `task-${Date.now()}`,
        targetName: title.trim(),
        summary: desc || undefined,
        timestamp: new Date().toISOString(),
      });

      // Criar run de execução associado à tarefa
      const taskRun = createRun({
        taskId: `task-${Date.now()}`,
        status: 'queued',
        triggerSource: 'task_create',
        startedAt: new Date().toISOString(),
      });

      res.status(201).json({
        ok: true,
        task: { id: `task-${Date.now()}`, title, description: desc, status: 'todo', createdAt: new Date().toISOString() },
        run: taskRun,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.patch('/api/hermes/tasks/:taskId', requirePermission('hermes:ops:write'), async (req: Request, res: Response) => {
    try {
      const taskId = validateResourceId(req.params.taskId, 'tarefa');
      const { actor } = resolveWorkspaceActor(req);
      const payload = pickFields(req.body, TASK_ALLOWED_FIELDS);
      invalidateDomainCache('tasks');
      invalidateDomainCache('overview');
      appendAuditFn(actor.name, `Atualizou tarefa Hermes ${taskId}`, taskId, 'Hermes Adapter');
      createActivity({
        actorName: actor.name,
        action: 'task.update',
        targetType: 'task',
        targetId: taskId,
        summary: `Status: ${payload.status || 'unchanged'}`,
        timestamp: new Date().toISOString(),
      });
      res.json({ ok: true, task: { id: taskId, ...payload, updatedAt: new Date().toISOString() } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({ ok: false, error: msg, kind: 'communication_error' });
    }
  });

  // ============================================================================
  // Routines (Cron Hermes) - cache por domínio
  // ============================================================================
  router.get('/api/hermes/routines', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const routines = await getCachedDomain(
        'routines',
        () => fetchHermesJson(`${HERMES_CLI} cron list`, parseCronList, 5000),
        DOMAIN_TTL.routines,
        []
      );
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
      await runCommandSafe(
        `${HERMES_CLI} cron create --name "${name}" --schedule "${cron}" --deliver local "Rotina Hermes: ${name}"`,
        { timeoutMs: 10000 }
      );
      invalidateDomainCache('routines');
      invalidateDomainCache('overview');
      appendAuditFn(actor.name, 'Criou rotina Hermes', name, 'Hermes Adapter');
      createActivity({
        actorName: actor.name,
        action: 'routine.create',
        targetType: 'routine',
        targetId: `routine-${Date.now()}`,
        targetName: name,
        summary: `Cron: ${cron}`,
        timestamp: new Date().toISOString(),
      });
      res.status(201).json({ ok: true, routine: { id: `routine-${Date.now()}`, name, cron, enabled: true, createdAt: new Date().toISOString() } });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Approvals (filtrados do kanban)
  // ============================================================================
  router.get('/api/hermes/approvals', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const tasks = await getCachedDomain(
        'tasks',
        () => fetchHermesJson(`${HERMES_CLI} kanban list --json`, parseKanbanJson, 8000),
        DOMAIN_TTL.tasks,
        []
      );
      const approvals = tasks.filter((t) => t.title.toLowerCase().includes('aprov'));
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
      createActivity({
        actorName: actor.name,
        action: 'approval.request',
        targetType: 'approval',
        targetId: `approval-${Date.now()}`,
        targetName: title.trim(),
        summary: description || undefined,
        timestamp: new Date().toISOString(),
      });
      res.status(201).json({ ok: true, approval: { id: `approval-${Date.now()}`, title: title.trim(), description, reason, status: 'pending', createdAt: new Date().toISOString() } });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Costs (custos reais agregados dos runs)
  // ============================================================================
  router.get('/api/hermes/costs/summary', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const runs = listRuns();
      const byAgentMap = new Map<string, { agentId: string; agentName: string; costCents: number; runsCount: number }>();
      let totalCostCents = 0;
      let currency = 'BRL';

      for (const run of runs) {
        if (run.costCents && run.costCents > 0) {
          totalCostCents += run.costCents;
          currency = run.currency || currency;
          const key = run.agentId || 'unknown';
          const existing = byAgentMap.get(key);
          if (existing) {
            existing.costCents += run.costCents;
            existing.runsCount += 1;
          } else {
            byAgentMap.set(key, {
              agentId: run.agentId || key,
              agentName: run.agentName || 'Desconhecido',
              costCents: run.costCents,
              runsCount: 1,
            });
          }
        }
      }

      const byAgent = Array.from(byAgentMap.values()).sort((a, b) => b.costCents - a.costCents);

      res.json({
        ok: true,
        summary: {
          totalCostCents,
          currency,
          budgetMonthlyCents: null,
          byAgent,
        },
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Activity (atividade e auditoria operacional)
  // ============================================================================
  router.get('/api/hermes/activity', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const limit = parseLimit(_req.query.limit, 50);
      const activities = listActivities(limit);
      res.json({ ok: true, activity: activities });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/api/hermes/activity', requirePermission('hermes:ops:write'), async (req: Request, res: Response) => {
    try {
      const { actor } = resolveWorkspaceActor(req);
      const { action, targetType, targetId, targetName, summary } = req.body as {
        action?: string;
        targetType?: string;
        targetId?: string;
        targetName?: string;
        summary?: string;
      };
      if (!action || !action.trim()) {
        res.status(400).json({ error: 'Ação é obrigatória.' });
        return;
      }
      const activity = createActivity({
        actorName: actor.name,
        action: action.trim(),
        targetType,
        targetId,
        targetName,
        summary,
        timestamp: new Date().toISOString(),
      });
      res.status(201).json({ ok: true, activity });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Org - cache por domínio (agents)
  // ============================================================================
  router.get('/api/hermes/org', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const agents = await getCachedDomain(
        'org',
        () => fetchHermesJson(`${HERMES_CLI} profile list`, parseProfileList, 8000),
        DOMAIN_TTL.org,
        []
      );
      const tree = agents.map((b) => ({
        id: b.id,
        name: b.name,
        title: b.title,
        role: b.role,
        status: b.status,
        children: [],
      }));
      res.json({ ok: true, tree, agents });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ============================================================================
  // Skills - cache por domínio
  // ============================================================================
  router.get('/api/hermes/skills', requirePermission('read'), async (_req: Request, res: Response) => {
    try {
      const skills = await getCachedDomain(
        'skills',
        () => fetchHermesJson(`${HERMES_CLI} skills list --enabled-only`, parseSkillsList, 10000),
        DOMAIN_TTL.skills,
        []
      );
      res.json({ ok: true, skills });
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

function calculateCostsSummary(runs: RunRecord[]): {
  totalCostCents: number;
  currency: string;
  budgetMonthlyCents: number | null;
  byAgent: Array<{ agentId: string; agentName: string; costCents: number; runsCount: number }>;
} {
  const byAgentMap = new Map<string, { agentId: string; agentName: string; costCents: number; runsCount: number }>();
  let totalCostCents = 0;
  let currency = 'BRL';

  for (const run of runs) {
    if (run.costCents && run.costCents > 0) {
      totalCostCents += run.costCents;
      currency = run.currency || currency;
      const key = run.agentId || 'unknown';
      const existing = byAgentMap.get(key);
      if (existing) {
        existing.costCents += run.costCents;
        existing.runsCount += 1;
      } else {
        byAgentMap.set(key, {
          agentId: run.agentId || key,
          agentName: run.agentName || 'Desconhecido',
          costCents: run.costCents,
          runsCount: 1,
        });
      }
    }
  }

  const byAgent = Array.from(byAgentMap.values()).sort((a, b) => b.costCents - a.costCents);

  return { totalCostCents, currency, budgetMonthlyCents: null, byAgent };
}
