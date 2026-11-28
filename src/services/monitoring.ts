/**
 * @file src/services/monitoring.ts
 * Cliente para os endpoints de monitoramento operacional do backend.
 *
 * Consome /api/monitoring/overview, /api/monitoring/queue-health e
 * /api/monitoring/queue para exibir o estado da operação autônoma.
 */

const API_BASE = import.meta.env.VITE_API_BASE || '';

function authHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export interface QueueOverview {
  running: boolean;
  pending: number;
  runningCount: number;
  completed: number;
  failed: number;
  blocked: number;
}

export interface OperationalOverview {
  system: {
    status: string;
    hermes: { configured: boolean; connected: boolean; label: string };
    uptimeMs: number;
  };
  queue: QueueOverview;
  agents: {
    total: number;
    active: number;
    blocked: number;
  };
  activity: { last24h: number; total: number };
  alerts: Array<{
    severity: string;
    message: string;
    timestamp: string;
  }>;
}

export interface QueueHealth {
  ok: boolean;
  healthy: boolean;
  issues: string[];
}

export interface DepartmentWorkerInfo {
  name: string;
  intervalMs: number;
  lastRun: string | null;
  runCount: number;
  errorCount: number;
  lastError?: string | null;
  isRunning: boolean;
}

export interface DepartmentWorkersResponse {
  ok: boolean;
  workers: DepartmentWorkerInfo[];
  total: number;
}

export interface QueueItemInput {
  title: string;
  description?: string;
  priority?: 'baixa' | 'media' | 'alta' | 'critica';
  assigneeAgentId?: string | null;
  assigneeAgentName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  triggerSource?: 'manual' | 'scheduled' | 'autonomous' | 'dependency';
  dependencies?: string[];
}

export async function getOperationalOverview(
  token?: string,
): Promise<OperationalOverview> {
  const res = await fetch(`${API_BASE}/api/monitoring/overview`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Monitoring overview: ${res.status}`);
  return res.json();
}

export async function getQueueHealth(token?: string): Promise<QueueHealth> {
  const res = await fetch(`${API_BASE}/api/monitoring/queue-health`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Queue health: ${res.status}`);
  return res.json();
}

export async function createQueueItem(
  input: QueueItemInput,
  token?: string,
): Promise<{ ok: boolean; item: { id: string; status: string } }> {
  const res = await fetch(`${API_BASE}/api/monitoring/queue`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Create queue item: ${res.status}`);
  return res.json();
}

export async function getHealth(token?: string): Promise<{
  status: string;
  hermes: { connected: boolean };
}> {
  const res = await fetch(`${API_BASE}/api/health`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Health: ${res.status}`);
  return res.json();
}

export async function getDepartmentWorkers(token?: string): Promise<DepartmentWorkersResponse> {
  const res = await fetch(`${API_BASE}/api/monitoring/workers`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Department workers: ${res.status}`);
  return res.json();
}

export const monitoringService = {
  getOperationalOverview,
  getQueueHealth,
  createQueueItem,
  getHealth,
  getDepartmentWorkers,
};
