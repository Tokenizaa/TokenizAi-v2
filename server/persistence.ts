import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  EnterpriseDataState,
  RunRecord,
  ActivityRecord,
  Departamento,
  AgenteEmpresarial,
  Equipe,
} from '../src/types/platform.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'enterprise-state.json');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseConfigured =
  Boolean(SUPABASE_URL) && Boolean(SUPABASE_SERVICE_ROLE_KEY);

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdmin;
}

function isSupabaseAvailable(): boolean {
  return supabaseConfigured;
}

// ------------------------------------------------------------------
// Synchronous load/save (JSON file as primary, Supabase as background sync)
// ------------------------------------------------------------------

export function loadEnterpriseState(): EnterpriseDataState | null {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as EnterpriseDataState;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      projects: parsed.projects || [],
      clients: parsed.clients || [],
      deals: parsed.deals || [],
      products: parsed.products || [],
      subscriptions: parsed.subscriptions || [],
      financeEntries: parsed.financeEntries || [],
      automations: parsed.automations || [],
      users: parsed.users || [],
      auditLogs: parsed.auditLogs || [],
      runs: parsed.runs || [],
      activities: parsed.activities || [],
      departamentos: parsed.departamentos || [],
      agentesEmpresariais: parsed.agentesEmpresariais || [],
      equipes: parsed.equipes || [],
    };
  } catch {
    return null;
  }
}

export function saveEnterpriseState(state: EnterpriseDataState): void {
  // Sempre salva no JSON (fonte de verdade local imediata)
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

  // Sincroniza com Supabase (aguarda confirmacao; falhas sao reportadas, nao silenciadas)
  if (isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdmin();
      const results = Promise.allSettled([
        state.projects?.length ? admin.from('projetos').upsert(state.projects) : null,
        state.clients?.length ? admin.from('clientes').upsert(state.clients) : null,
        state.deals?.length ? admin.from('negocios').upsert(state.deals) : null,
        state.products?.length ? admin.from('produtos').upsert(state.products) : null,
        state.subscriptions?.length ? admin.from('assinaturas').upsert(state.subscriptions) : null,
        state.financeEntries?.length ? admin.from('lancamentos_financeiros').upsert(state.financeEntries) : null,
        state.automations?.length ? admin.from('automacoes').upsert(state.automations) : null,
        state.users?.length ? admin.from('perfis_empresariais').upsert(state.users) : null,
        state.auditLogs?.length ? admin.from('auditoria').upsert(state.auditLogs) : null,
        state.runs?.length ? admin.from('runs').upsert(state.runs) : null,
        state.activities?.length ? admin.from('activities').upsert(state.activities) : null,
        state.departamentos?.length ? admin.from('departamentos').upsert(state.departamentos) : null,
        state.agentesEmpresariais?.length ? admin.from('agentes_empresariais').upsert(state.agentesEmpresariais) : null,
        state.equipes?.length ? admin.from('equipes').upsert(state.equipes) : null,
      ].filter(Boolean));
      void results.then((settled) => {
        const failures = settled.filter((r) => r.status === 'rejected');
        if (failures.length > 0) {
          const msgs = failures.map((r) => {
            const reason = (r as PromiseRejectedResult).reason;
            return reason instanceof Error ? reason.message : String(reason);
          });
          console.error('[Supabase] Falhas na persistencia duravel:', msgs.join('; '));
        }
      });
    } catch (err) {
      console.error('[Supabase] Erro ao preparar sincronizacao:', err instanceof Error ? err.message : String(err));
    }
  }
}

// ------------------------------------------------------------------
// Auditoria (sincrona, com replicacao para Supabase em segundo plano)
// ------------------------------------------------------------------

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
  const logEntry = {
    id: `log-${Date.now()}`,
    timestamp: formatted,
    actor,
    action,
    target,
    origin,
  };
  state.auditLogs.unshift(logEntry);
  saveEnterpriseState(state);

  // Replicar para Supabase (nao silencia falhas)
  if (isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdmin();
      void admin.from('auditoria').insert(logEntry).then(
        () => {},
        (err) => {
          console.error('[Supabase] Falha ao replicar auditoria:', err instanceof Error ? err.message : String(err));
        },
      );
    } catch (err) {
      console.error('[Supabase] Erro ao preparar replicacao de auditoria:', err instanceof Error ? err.message : String(err));
    }
  }
}

// ============================================================================
// Run persistence
// ============================================================================

export function listRuns(): RunRecord[] {
  const state = loadEnterpriseState();
  if (!state) return [];
  return state.runs || [];
}

export function createRun(run: Omit<RunRecord, 'id'>): RunRecord {
  const state = loadEnterpriseState();
  if (!state) {
    throw new Error('Enterprise state not initialized');
  }
  if (!state.runs) {
    state.runs = [];
  }
  const id = `run-${Date.now()}`;
  const newRun: RunRecord = { ...run, id };
  state.runs.unshift(newRun);
  saveEnterpriseState(state);
  return newRun;
}

export function updateRun(
  runId: string,
  updates: Partial<Pick<RunRecord, 'status' | 'finishedAt' | 'durationMs' | 'resultSummary' | 'errorMessage' | 'logs' | 'costCents' | 'currency'>>,
): RunRecord | null {
  const state = loadEnterpriseState();
  if (!state) return null;
  const idx = state.runs.findIndex((r) => r.id === runId);
  if (idx === -1) return null;
  state.runs[idx] = { ...state.runs[idx], ...updates };
  saveEnterpriseState(state);
  return state.runs[idx];
}

// ============================================================================
// Activity persistence
// ============================================================================

export function listActivities(limit = 50): ActivityRecord[] {
  const state = loadEnterpriseState();
  if (!state) return [];
  return (state.activities || []).slice(0, limit);
}

export function createActivity(activity: Omit<ActivityRecord, 'id'>): ActivityRecord {
  const state = loadEnterpriseState();
  if (!state) {
    throw new Error('Enterprise state not initialized');
  }
  if (!state.activities) {
    state.activities = [];
  }
  const id = `act-${Date.now()}`;
  const newActivity: ActivityRecord = { ...activity, id };
  state.activities.unshift(newActivity);
  saveEnterpriseState(state);
  return newActivity;
}

// ============================================================================
// Departamentos
// ============================================================================

export function listDepartamentos(): Departamento[] {
  const state = loadEnterpriseState();
  if (!state) return [];
  return state.departamentos || [];
}

export function createDepartamento(
  departamento: Omit<Departamento, 'id' | 'createdAt' | 'updatedAt'>,
): Departamento {
  const state = loadEnterpriseState();
  if (!state) {
    throw new Error('Enterprise state not initialized');
  }
  if (!state.departamentos) {
    state.departamentos = [];
  }
  const id = `dep-${Date.now()}`;
  const now = new Date().toISOString();
  const newDepartamento: Departamento = { ...departamento, id, createdAt: now, updatedAt: now };
  state.departamentos.push(newDepartamento);
  saveEnterpriseState(state);
  return newDepartamento;
}

export function updateDepartamento(
  id: string,
  updates: Partial<Pick<Departamento, 'nome' | 'codigo' | 'descricao' | 'departamentoPaiId'>>,
): Departamento | null {
  const state = loadEnterpriseState();
  if (!state) return null;
  const idx = state.departamentos?.findIndex((d) => d.id === id);
  if (idx === -1 || !state.departamentos) return null;
  state.departamentos[idx] = { ...state.departamentos[idx], ...updates, updatedAt: new Date().toISOString() };
  saveEnterpriseState(state);
  return state.departamentos[idx];
}

export function deleteDepartamento(id: string): boolean {
  const state = loadEnterpriseState();
  if (!state || !state.departamentos) return false;
  const idx = state.departamentos.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  state.departamentos.splice(idx, 1);
  saveEnterpriseState(state);
  return true;
}

// ============================================================================
// Agentes Empresariais
// ============================================================================

export function listAgentesEmpresariais(): AgenteEmpresarial[] {
  const state = loadEnterpriseState();
  if (!state) return [];
  return state.agentesEmpresariais || [];
}

export function createAgenteEmpresarial(
  agente: Omit<AgenteEmpresarial, 'id' | 'createdAt' | 'updatedAt'>,
): AgenteEmpresarial {
  const state = loadEnterpriseState();
  if (!state) {
    throw new Error('Enterprise state not initialized');
  }
  if (!state.agentesEmpresariais) {
    state.agentesEmpresariais = [];
  }
  const id = `agemp-${Date.now()}`;
  const now = new Date().toISOString();
  const newAgente: AgenteEmpresarial = { ...agente, id, createdAt: now, updatedAt: now };
  state.agentesEmpresariais.push(newAgente);
  saveEnterpriseState(state);
  return newAgente;
}

export function updateAgenteEmpresarial(
  id: string,
  updates: Partial<Pick<AgenteEmpresarial, 'nome' | 'slug' | 'divisao' | 'papel' | 'departamentoId' | 'hermesAgentId' | 'hermesProfileId' | 'status' | 'capabilities'>>,
): AgenteEmpresarial | null {
  const state = loadEnterpriseState();
  if (!state) return null;
  const idx = state.agentesEmpresariais?.findIndex((a) => a.id === id);
  if (idx === -1 || !state.agentesEmpresariais) return null;
  state.agentesEmpresariais[idx] = { ...state.agentesEmpresariais[idx], ...updates, updatedAt: new Date().toISOString() };
  saveEnterpriseState(state);
  return state.agentesEmpresariais[idx];
}

export function deleteAgenteEmpresarial(id: string): boolean {
  const state = loadEnterpriseState();
  if (!state || !state.agentesEmpresariais) return false;
  const idx = state.agentesEmpresariais.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  state.agentesEmpresariais.splice(idx, 1);
  saveEnterpriseState(state);
  return true;
}

// ============================================================================
// Equipes
// ============================================================================

export function listEquipes(): Equipe[] {
  const state = loadEnterpriseState();
  if (!state) return [];
  return state.equipes || [];
}

export function createEquipe(
  equipe: Omit<Equipe, 'id' | 'createdAt' | 'updatedAt'>,
): Equipe {
  const state = loadEnterpriseState();
  if (!state) {
    throw new Error('Enterprise state not initialized');
  }
  if (!state.equipes) {
    state.equipes = [];
  }
  const id = `eq-${Date.now()}`;
  const now = new Date().toISOString();
  const newEquipe: Equipe = { ...equipe, id, integrantes: equipe.integrantes || [], createdAt: now, updatedAt: now };
  state.equipes.push(newEquipe);
  saveEnterpriseState(state);
  return newEquipe;
}

export function updateEquipe(
  id: string,
  updates: Partial<Pick<Equipe, 'nome' | 'descricao' | 'departamentoId' | 'liderId' | 'integrantes'>>,
): Equipe | null {
  const state = loadEnterpriseState();
  if (!state) return null;
  const idx = state.equipes?.findIndex((e) => e.id === id);
  if (idx === -1 || !state.equipes) return null;
  state.equipes[idx] = { ...state.equipes[idx], ...updates, updatedAt: new Date().toISOString() };
  saveEnterpriseState(state);
  return state.equipes[idx];
}

export function deleteEquipe(id: string): boolean {
  const state = loadEnterpriseState();
  if (!state || !state.equipes) return false;
  const idx = state.equipes.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  state.equipes.splice(idx, 1);
  saveEnterpriseState(state);
  return true;
}

export type { RunRecord, ActivityRecord, Departamento, AgenteEmpresarial, Equipe };
