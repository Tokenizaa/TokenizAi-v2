export type WorkerStatus = 'idle' | 'running' | 'stopped';

export interface Worker {
  name: string;
  status: WorkerStatus;
  lastRunAt?: string | null;
  runCount: number;
  errorCount: number;
  lastError?: string | null;
}

const workers: Map<string, Worker> = new Map();
const intervals: Map<string, NodeJS.Timeout> = new Map();

export function registerWorker(
  name: string,
  fn: () => Promise<void>,
  intervalMs: number,
): void {
  workers.set(name, { name, status: 'idle', runCount: 0, errorCount: 0 });
  const interval = setInterval(async () => {
    const w = workers.get(name);
    if (!w || w.status === 'stopped') return;
    w.status = 'running';
    w.lastRunAt = new Date().toISOString();
    try {
      await fn();
      w.status = 'idle';
      w.runCount += 1;
    } catch (err) {
      w.status = 'idle';
      w.errorCount += 1;
      w.lastError = err instanceof Error ? err.message : String(err);
    }
    workers.set(name, w);
  }, intervalMs);
  intervals.set(name, interval);
}

export function stopWorker(name: string): void {
  const interval = intervals.get(name);
  if (interval) clearInterval(interval);
  intervals.delete(name);
  const w = workers.get(name);
  if (w) {
    w.status = 'stopped';
    workers.set(name, w);
  }
}

export function stopAllWorkers(): void {
  for (const name of intervals.keys()) stopWorker(name);
}

export function listWorkers(): Worker[] {
  return Array.from(workers.values());
}

export function getWorker(name: string): Worker | null {
  return workers.get(name) ?? null;
}

export function createFallbackWorkers(): void {
  if (workers.size > 0) return;
  registerWorker('ocr', async () => {
    // Sem provedor de OCR configurado. Mantém heartbeat de operacionalidade.
  }, 60000);
  registerWorker('messaging', async () => {
    // Sem provedor de mensagens configurado. Mantém heartbeat de operacionalidade.
  }, 60000);
  registerWorker('marketing', async () => {
    // Sem token Meta/Instagram configurado. Mantém heartbeat de operacionalidade.
  }, 300000);
  registerWorker('scraping', async () => {
    // Sem target de scraping configurado. Mantém heartbeat de operacionalidade.
  }, 300000);
}
