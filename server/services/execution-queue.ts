import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const QUEUE_FILE = path.join(DATA_DIR, 'execution-queue.json');

export type QueueItemStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';

export interface ExecutionQueueItem {
  id: string;
  title: string;
  description: string;
  status: QueueItemStatus;
  priority: 'baixa' | 'media' | 'alta' | 'critica';
  assigneeAgentId?: string | null;
  assigneeAgentName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  triggerSource: 'manual' | 'scheduled' | 'autonomous' | 'dependency';
  dependencies: string[];
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorMessage?: string | null;
  resultSummary?: string | null;
  logs: string[];
  costCents?: number | null;
  currency?: string;
  retryCount: number;
  maxRetries: number;
  acceptanceCriteria?: string[];
  evidence?: Array<{
    type: string;
    description: string;
    value: string;
    timestamp: string;
  }>;
}

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readQueue(): ExecutionQueueItem[] {
  ensureDir();
  try {
    if (!fs.existsSync(QUEUE_FILE)) return [];
    const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as ExecutionQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: ExecutionQueueItem[]): void {
  ensureDir();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(items, null, 2), 'utf8');
}

export function listQueueItems(): ExecutionQueueItem[] {
  return readQueue();
}

export function listPendingQueueItems(): ExecutionQueueItem[] {
  return readQueue().filter((i) => i.status === 'pending');
}

export function listRunningQueueItems(): ExecutionQueueItem[] {
  return readQueue().filter((i) => i.status === 'running');
}

export function listCompletedQueueItems(): ExecutionQueueItem[] {
  return readQueue().filter((i) => i.status === 'completed');
}

export function listFailedQueueItems(): ExecutionQueueItem[] {
  return readQueue().filter((i) => i.status === 'failed');
}

export function listBlockedQueueItems(): ExecutionQueueItem[] {
  return readQueue().filter((i) => i.status === 'blocked');
}

export function getQueueItem(id: string): ExecutionQueueItem | null {
  const items = readQueue();
  const item = items.find((i) => i.id === id);
  return item ?? null;
}

export function createQueueItem(
  input: Omit<ExecutionQueueItem, 'id' | 'status' | 'createdAt' | 'logs' | 'retryCount'>,
): ExecutionQueueItem {
  const id = `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: ExecutionQueueItem = {
    id,
    status: 'pending',
    createdAt: new Date().toISOString(),
    logs: [],
    retryCount: 0,
    ...input,
    dependencies: input.dependencies ?? [],
    maxRetries: input.maxRetries ?? 3,
    evidence: input.evidence ?? [],
    acceptanceCriteria: input.acceptanceCriteria ?? [],
  };
  const items = readQueue();
  items.unshift(item);
  writeQueue(items);
  return item;
}

export function updateQueueItem(
  id: string,
  patch: Partial<ExecutionQueueItem>,
): ExecutionQueueItem | null {
  const items = readQueue();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch };
  writeQueue(items);
  return items[idx];
}

export function markRunning(id: string): ExecutionQueueItem | null {
  return updateQueueItem(id, {
    status: 'running',
    startedAt: new Date().toISOString(),
  });
}

export function markCompleted(
  id: string,
  resultSummary?: string | null,
  evidence?: ExecutionQueueItem['evidence'],
): ExecutionQueueItem | null {
  return updateQueueItem(id, {
    status: 'completed',
    finishedAt: new Date().toISOString(),
    resultSummary: resultSummary ?? null,
    evidence: evidence ?? undefined,
  });
}

export function markFailed(id: string, errorMessage: string): ExecutionQueueItem | null {
  const item = getQueueItem(id);
  if (!item) return null;
  const nextRetry = item.retryCount + 1;
  if (nextRetry <= item.maxRetries) {
    return updateQueueItem(id, {
      status: 'pending',
      retryCount: nextRetry,
      errorMessage,
      logs: [
        ...(item.logs ?? []),
        `Falha (tentativa ${nextRetry}/${item.maxRetries}): ${errorMessage}`,
      ],
    });
  }
  return updateQueueItem(id, {
    status: 'failed',
    finishedAt: new Date().toISOString(),
    errorMessage,
  });
}

export function addLog(id: string, message: string): ExecutionQueueItem | null {
  const item = getQueueItem(id);
  if (!item) return null;
  return updateQueueItem(id, {
    logs: [...(item.logs ?? []), `${new Date().toISOString()} - ${message}`],
  });
}

export function addEvidence(
  id: string,
  evidence: { type: string; description: string; value: string },
): ExecutionQueueItem | null {
  const item = getQueueItem(id);
  if (!item) return null;
  const entry = {
    type: evidence.type,
    description: evidence.description,
    value: evidence.value,
    timestamp: new Date().toISOString(),
  };
  return updateQueueItem(id, {
    evidence: [...(item.evidence ?? []), entry],
  });
}
