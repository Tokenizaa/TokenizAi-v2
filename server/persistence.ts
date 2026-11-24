import fs from 'node:fs';
import path from 'node:path';
import type { EnterpriseDataState } from '../src/types/platform.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'enterprise-state.json');

export function loadEnterpriseState(): EnterpriseDataState | null {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as EnterpriseDataState;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveEnterpriseState(state: EnterpriseDataState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export function appendAudit(
  actor: string,
  action: string,
  target: string,
  origin: 'Plataforma' | 'Hermes Adapter' | 'Segurança' = 'Plataforma',
): void {
  const state = loadEnterpriseState();
  if (!state) return;
  const now = new Date();
  const formatted = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
  state.auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: formatted,
    actor,
    action,
    target,
    origin,
  });
  saveEnterpriseState(state);
}
