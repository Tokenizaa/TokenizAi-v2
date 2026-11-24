import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { SegmentedTabs, SlideDrawer, StatusText } from '../../components/ui/Primitives';
import { formatCents, formatDateTimeBR, PaperclipApi } from '../../services/api';
import type {
  HermesIntegrationStatus,
  NavSectionId,
  PaperclipActivityDto,
  PaperclipAgentDto,
  PaperclipApprovalDto,
  PaperclipCostSummaryDto,
  PaperclipIntegrationStatus,
  PaperclipRoutineDto,
} from '../../types/platform';
import { HermesStatusPanel } from './HermesStatusPanel';

/* ============================================================================
 * 1. ROUTINES & TRIGGERS (schedule, webhook, api)
 * ========================================================================== */
export const PaperclipRoutinesPanel: React.FC<{
  status: HermesIntegrationStatus;
  agents: PaperclipAgentDto[];
  onNavigate: (sec: NavSectionId) => void;
  onToast: (msg: string) => void;
}> = ({ status, agents, onNavigate, onToast }) => {
  const [routines, setRoutines] = useState<PaperclipRoutineDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<PaperclipRoutineDto | null>(null);
  const [routineRuns, setRoutineRuns] = useState<Array<Record<string, unknown>>>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoutine, setNewRoutine] = useState({
    name: '',
    description: '',
    assigneeAgentId: '',
    triggerType: 'schedule',
    cronExpression: '0 9 * * 1-5',
  });

  const isConnected =
    status.configured && status.connected;

  const loadRoutines = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    try {
      const res = await PaperclipApi.listRoutines();
      setRoutines(res.routines || []);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao consultar rotinas do Paperclip.');
    } finally {
      setLoading(false);
    }
  }, [isConnected, onToast]);

  useEffect(() => {
    loadRoutines();
  }, [loadRoutines]);

  const openRoutineDetail = async (r: PaperclipRoutineDto) => {
    setSelectedRoutine(r);
    try {
      const res = await PaperclipApi.getRoutineRuns(r.id);
      setRoutineRuns(res.runs || []);
    } catch {
      setRoutineRuns([]);
    }
  };

  const handleRunManual = async (routineId: string) => {
    try {
      await PaperclipApi.runRoutine(routineId);
      await loadRoutines();
      onToast('Execução manual disparada no Paperclip.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha ao executar rotina.');
    }
  };

  const handleToggleTrigger = async (routineId: string, triggerId: string, enabled: boolean) => {
    try {
      await PaperclipApi.updateRoutineTrigger(routineId, triggerId, { enabled });
      await loadRoutines();
      onToast(enabled ? 'Gatilho habilitado.' : 'Gatilho desabilitado.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar gatilho.');
    }
  };

  const handleCreateRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoutine.name.trim()) return;
    try {
      const created = await PaperclipApi.createRoutine({
        name: newRoutine.name.trim(),
        description: newRoutine.description.trim() || undefined,
        assigneeAgentId: newRoutine.assigneeAgentId || undefined,
      });
      if (created.routine?.id) {
        await PaperclipApi.createRoutineTrigger(created.routine.id, {
          kind: newRoutine.triggerType,
          type: newRoutine.triggerType,
          cronExpression: newRoutine.triggerType === 'schedule' ? newRoutine.cronExpression : undefined,
        }).catch(() => {});
      }
      setCreateOpen(false);
      setNewRoutine({
        name: '',
        description: '',
        assigneeAgentId: '',
        triggerType: 'schedule',
        cronExpression: '0 9 * * 1-5',
      });
      await loadRoutines();
      onToast('Rotina criada no Paperclip.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao criar rotina no Paperclip.');
    }
  };

  if (!isConnected) {
    return (
      <HermesStatusPanel
        status={status}
        title="Automações & Rotinas (Paperclip)"
        requiredCapabilities={['routines:read', 'routines:manage']}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-ink-subtle">
          Gatilhos nativos suportados: <span className="font-mono">schedule</span>, <span className="font-mono">webhook</span> e <span className="font-mono">api</span>.
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRoutines}
            disabled={loading}
            className="p-2 rounded-lg border border-line-strong text-ink-muted hover:text-ink cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="nc-primary-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Rotina</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {routines.map((r) => (
          <div
            key={r.id}
            role="button"
            tabIndex={0}
            onClick={() => openRoutineDetail(r)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openRoutineDetail(r);
              }
            }}
            className="nc-card rounded-2xl p-5 flex flex-col justify-between gap-4 cursor-pointer"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-accent dark:text-cyan-300">
                  {r.triggers.length} gatilho(s)
                </span>
                <StatusText
                  label={r.enabled ? 'Ativa' : 'Pausada'}
                  tone={r.enabled ? 'nominal' : 'neutral'}
                />
              </div>
              <h3 className="font-display text-sm font-semibold text-ink">{r.name}</h3>
              {r.description && <p className="text-xs text-ink-muted line-clamp-2">{r.description}</p>}
              {r.triggers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {r.triggers.map((tr) => (
                    <span key={tr.id} className="font-mono text-[11px] px-2 py-0.5 rounded border border-line bg-surface-subtle/60 text-ink-muted">
                      {tr.type} {tr.schedule || tr.cron ? `(${tr.schedule || tr.cron})` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-line flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-[11px] text-ink-subtle truncate">
                {r.agentName || 'Sem agente fixo'} · {formatDateTimeBR(r.lastRunAt)}
              </span>
              <button
                type="button"
                onClick={() => handleRunManual(r.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
              >
                <Play className="w-3 h-3" />
                <span>Executar</span>
              </button>
            </div>
          </div>
        ))}
        {routines.length === 0 && (
          <div className="col-span-full nc-card rounded-2xl p-8 text-center text-xs text-ink-subtle">
            Nenhuma rotina cadastrada nesta empresa Paperclip.
          </div>
        )}
      </div>

      <SlideDrawer
        open={Boolean(selectedRoutine)}
        onClose={() => setSelectedRoutine(null)}
        wide
        title={selectedRoutine?.name || ''}
        subtitle={selectedRoutine?.description}
      >
        {selectedRoutine && (
          <div className="space-y-5">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-ink-subtle">Gatilhos configurados</h4>
              <div className="divide-y divide-line border border-line rounded-xl">
                {selectedRoutine.triggers.map((tr) => (
                  <div key={tr.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-mono font-semibold text-ink">{tr.type}</div>
                      <div className="text-ink-subtle font-mono">
                        {tr.schedule || tr.cron || tr.webhookUrl || 'API trigger'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleTrigger(selectedRoutine.id, tr.id, !tr.enabled)}
                      className="px-3 py-1.5 rounded-lg border border-line-strong font-semibold text-ink hover:bg-surface-blue cursor-pointer"
                    >
                      {tr.enabled ? 'Desabilitar' : 'Habilitar'}
                    </button>
                  </div>
                ))}
                {selectedRoutine.triggers.length === 0 && (
                  <div className="p-4 text-xs text-ink-subtle text-center">Nenhum gatilho cadastrado.</div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-ink-subtle inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Histórico de execuções da rotina</span>
              </h4>
              <div className="divide-y divide-line border border-line rounded-xl">
                {routineRuns.map((rr, i) => (
                  <div key={String(rr.id || i)} className="p-3 text-xs flex items-center justify-between">
                    <span className="font-mono text-ink-muted">{formatDateTimeBR(String(rr.startedAt || rr.createdAt || ''))}</span>
                    <StatusText label={String(rr.status || 'unknown')} tone="attention" />
                  </div>
                ))}
                {routineRuns.length === 0 && (
                  <div className="p-4 text-xs text-ink-subtle text-center">Sem execuções registradas.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </SlideDrawer>

      <SlideDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nova Rotina no Paperclip"
        subtitle="Cria rotina operacional com gatilho schedule, webhook ou api"
      >
        <form onSubmit={handleCreateRoutine} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Nome da rotina</label>
            <input
              type="text"
              required
              value={newRoutine.name}
              onChange={(e) => setNewRoutine({ ...newRoutine, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Agente executor</label>
            <select
              value={newRoutine.assigneeAgentId}
              onChange={(e) => setNewRoutine({ ...newRoutine, assigneeAgentId: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-xs text-ink"
            >
              <option value="">Selecionar agente</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Tipo de gatilho</label>
              <select
                value={newRoutine.triggerType}
                onChange={(e) => setNewRoutine({ ...newRoutine, triggerType: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-xs text-ink"
              >
                <option value="schedule">schedule</option>
                <option value="webhook">webhook</option>
                <option value="api">api</option>
              </select>
            </div>
            {newRoutine.triggerType === 'schedule' && (
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Cron</label>
                <input
                  type="text"
                  value={newRoutine.cronExpression}
                  onChange={(e) => setNewRoutine({ ...newRoutine, cronExpression: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-xs font-mono text-ink"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Descrição</label>
            <textarea
              rows={3}
              value={newRoutine.description}
              onChange={(e) => setNewRoutine({ ...newRoutine, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
            />
          </div>
          <div className="pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-lg border border-line-strong text-xs text-ink-muted cursor-pointer"
            >
              Cancelar
            </button>
            <button type="submit" className="nc-primary-btn px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer">
              Criar rotina
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
};

/* ============================================================================
 * 2. APPROVALS & GOVERNANCE (Human authority preserved)
 * ========================================================================== */
export const PaperclipApprovalsPanel: React.FC<{
  status: HermesIntegrationStatus;
  onNavigate: (sec: NavSectionId) => void;
  onToast: (msg: string) => void;
}> = ({ status, onNavigate, onToast }) => {
  const [approvals, setApprovals] = useState<PaperclipApprovalDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const isConnected =
    status.configured && status.connected;

  const loadApprovals = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    try {
      const res = await PaperclipApi.listApprovals();
      setApprovals(res.approvals || []);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao consultar aprovações no Paperclip.');
    } finally {
      setLoading(false);
    }
  }, [isConnected, onToast]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleDecision = async (id: string, action: 'approve' | 'reject' | 'revision') => {
    const note = (noteById[id] || '').trim();
    if (action === 'revision' && !note) {
      onToast('Informe uma justificativa para solicitar revisão.');
      return;
    }
    try {
      if (action === 'approve') await PaperclipApi.approveApproval(id, note || undefined);
      else if (action === 'reject') await PaperclipApi.rejectApproval(id, note || undefined);
      else await PaperclipApi.requestApprovalRevision(id, note);

      await loadApprovals();
      onToast('Decisão humana registrada no Paperclip.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao registrar decisão no Paperclip.');
    }
  };

  if (!isConnected) {
    return (
      <HermesStatusPanel
        status={status}
        title="Central de Aprovações & Governança (Paperclip)"
        requiredCapabilities={['approvals:read', 'approvals:manage']}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-ink-subtle">
          Aprovações críticas exigem decisão humana explícita e respeitam destinatários definidos no Paperclip.
        </div>
        <button
          type="button"
          onClick={loadApprovals}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      <div className="space-y-3">
        {approvals.map((ap) => {
          const isPending = ap.status === 'pending' || ap.status === 'revision_requested';
          return (
            <div key={ap.id} className="nc-card rounded-2xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-accent dark:text-cyan-300" />
                  <h3 className="font-display text-sm font-semibold text-ink">{ap.title}</h3>
                </div>
                <StatusText
                  label={ap.status}
                  tone={ap.status === 'approved' ? 'nominal' : ap.status === 'rejected' ? 'critical' : 'attention'}
                />
              </div>

              {ap.description && <p className="text-xs text-ink-muted">{ap.description}</p>}

              <div className="text-[11px] font-mono text-ink-subtle flex flex-wrap gap-4">
                <span>Solicitante: {ap.requestedByName || ap.requestedByAgentId || 'Agente'}</span>
                <span>Criada: {formatDateTimeBR(ap.createdAt)}</span>
              </div>

              {isPending && (
                <div className="pt-3 border-t border-line flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <input
                    type="text"
                    value={noteById[ap.id] || ''}
                    onChange={(e) => setNoteById({ ...noteById, [ap.id]: e.target.value })}
                    placeholder="Observação / justificativa da decisão..."
                    className="flex-1 px-3 py-2 rounded-lg border border-line-strong bg-canvas text-xs text-ink"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDecision(ap.id, 'approve')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-xs font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Aprovar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(ap.id, 'revision')}
                      className="px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
                    >
                      Pedir revisão
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(ap.id, 'reject')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-500/40 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-500/10 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Rejeitar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {approvals.length === 0 && (
          <div className="nc-card rounded-2xl p-8 text-center text-xs text-ink-subtle">
            Nenhuma solicitação de aprovação registrada nesta instância.
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. COSTS, ACTIVITY & AUDIT
 * ========================================================================== */
export const PaperclipCostsAuditPanel: React.FC<{
  status: HermesIntegrationStatus;
  onNavigate: (sec: NavSectionId) => void;
  onToast: (msg: string) => void;
}> = ({ status, onNavigate, onToast }) => {
  const [subTab, setSubTab] = useState<'custos' | 'atividade' | 'auditoria'>('custos');
  const [costs, setCosts] = useState<PaperclipCostSummaryDto | null>(null);
  const [activity, setActivity] = useState<PaperclipActivityDto[]>([]);
  const [auditActions, setAuditActions] = useState<PaperclipActivityDto[]>([]);
  const [loading, setLoading] = useState(false);

  const isConnected =
    status.configured && status.connected;

  const loadAll = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    try {
      const [cRes, aRes, auRes] = await Promise.allSettled([
        PaperclipApi.getCostsSummary(),
        PaperclipApi.listActivity(50),
        PaperclipApi.listAgentActionsAudit(50),
      ]);
      if (cRes.status === 'fulfilled') setCosts(cRes.value.summary);
      if (aRes.status === 'fulfilled') setActivity(aRes.value.activity || []);
      if (auRes.status === 'fulfilled') setAuditActions(auRes.value.actions || []);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao carregar custos e auditoria.');
    } finally {
      setLoading(false);
    }
  }, [isConnected, onToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (!isConnected) {
    return (
      <HermesStatusPanel
        status={status}
        title="Custos, Atividade & Auditoria (Paperclip)"
        requiredCapabilities={['costs:read', 'activity:read']}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          active={subTab}
          onChange={setSubTab}
          tabs={[
            { id: 'custos', label: 'Custos & Orçamentos' },
            { id: 'atividade', label: 'Atividade da Empresa', count: activity.length },
            { id: 'auditoria', label: 'Auditoria de Ações', count: auditActions.length },
          ]}
        />
        <button
          type="button"
          onClick={loadAll}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {subTab === 'custos' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="nc-card rounded-2xl p-5">
              <div className="text-xs text-ink-subtle inline-flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
                <span>Gasto Apurado ({costs?.currency || 'USD'})</span>
              </div>
              <div className="mt-1.5 font-display text-2xl font-semibold font-mono text-ink tabular-nums">
                {formatCents(costs?.totalCostCents, costs?.currency)}
              </div>
              <div className="text-[11px] text-ink-subtle mt-1">
                Unidade oficial preservada sem conversão fictícia
              </div>
            </div>

            <div className="nc-card rounded-2xl p-5">
              <div className="text-xs text-ink-subtle">Orçamento Mensal Configurado</div>
              <div className="mt-1.5 font-display text-2xl font-semibold font-mono text-highlight tabular-nums">
                {formatCents(costs?.budgetMonthlyCents, costs?.currency)}
              </div>
            </div>

            <div className="nc-card rounded-2xl p-5">
              <div className="text-xs text-ink-subtle">Qualidade da Apuração</div>
              <div className="mt-1.5 font-display text-2xl font-semibold font-mono text-ink tabular-nums">
                {typeof costs?.dataQuality?.coveragePercent === 'number'
                  ? `${costs.dataQuality.coveragePercent}% cobertura`
                  : 'Verificando'}
              </div>
              <div className="text-xs text-ink-muted mt-1">
                Execuções sem custo apurado: {costs?.dataQuality?.unpricedRunsCount ?? 0}
              </div>
            </div>
          </div>

          {costs?.byAgent && costs.byAgent.length > 0 && (
            <section className="rounded-2xl nc-card overflow-hidden">
              <div className="px-6 py-4 border-b border-line bg-surface-subtle/35 text-sm font-semibold text-ink">
                Consumo por Agente
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold text-ink-subtle">
                      <th className="py-2.5 px-6">Agente</th>
                      <th className="py-2.5 px-4">Modelo</th>
                      <th className="py-2.5 px-4 text-right">Tokens</th>
                      <th className="py-2.5 px-4 text-right">Gasto</th>
                      <th className="py-2.5 px-6 text-right">Teto Mensal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-sm">
                    {costs.byAgent.map((row) => (
                      <tr key={row.agentId}>
                        <td className="py-3 px-6 font-medium text-ink">{row.agentName}</td>
                        <td className="py-3 px-4 font-mono text-xs text-ink-subtle">{row.model || '—'}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                          {typeof row.tokens === 'number' ? row.tokens.toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                          {formatCents(row.costCents, costs.currency)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono text-xs text-ink-subtle tabular-nums">
                          {formatCents(row.budgetMonthlyCents, costs.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {subTab === 'atividade' && (
        <section className="rounded-2xl nc-card overflow-hidden">
          <div className="divide-y divide-line">
            {activity.map((ev) => (
              <div key={ev.id} className="px-6 py-3.5 flex items-center justify-between gap-4 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{ev.action}</div>
                  <div className="text-ink-muted truncate">
                    {ev.actorName} {ev.targetName ? `· ${ev.targetName}` : ''} {ev.summary ? `— ${ev.summary}` : ''}
                  </div>
                </div>
                <span className="font-mono text-ink-subtle shrink-0">{formatDateTimeBR(ev.timestamp)}</span>
              </div>
            ))}
            {activity.length === 0 && (
              <div className="p-8 text-center text-xs text-ink-subtle">Nenhum evento recente registrado.</div>
            )}
          </div>
        </section>
      )}

      {subTab === 'auditoria' && (
        <section className="rounded-2xl nc-card overflow-hidden">
          <div className="divide-y divide-line">
            {auditActions.map((ev) => (
              <div key={ev.id} className="px-6 py-3.5 flex items-center justify-between gap-4 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{ev.action}</div>
                  <div className="text-ink-muted truncate">
                    {ev.actorName} {ev.targetName ? `· ${ev.targetName}` : ''}
                  </div>
                </div>
                <span className="font-mono text-ink-subtle shrink-0">{formatDateTimeBR(ev.timestamp)}</span>
              </div>
            ))}
            {auditActions.length === 0 && (
              <div className="p-8 text-center text-xs text-ink-subtle">
                Nenhuma ação auditada retornada por audit/agent-actions.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
