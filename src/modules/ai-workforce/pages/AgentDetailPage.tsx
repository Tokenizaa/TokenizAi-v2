import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Zap, RefreshCw, MessageSquare, Play, Pause, Layers, Shield, Activity } from 'lucide-react';
import { PageHeader, SegmentedTabs, StatusText } from '../../../components/ui/Primitives';
import {
  CollectionToolbar,
  SectionTitle,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components';
import { paperclipService } from '../services/paperclip';
import type { PaperclipAgentDto, PaperclipIssueDto, PaperclipRunDto } from '../../../types/platform';
import { useParams } from 'react-router-dom';

type AgentTab =
  | 'geral'
  | 'competencias'
  | 'hierarquia'
  | 'tarefas'
  | 'execucoes'
  | 'runtime'
  | 'permissoes';

interface AgentDetailPageProps {
  agentId?: string;
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

const statusTone = (st: string) => {
  const s = st.toLowerCase();
  if (s === 'running' || s === 'active' || s === 'idle' || s === 'ready') return 'nominal';
  if (s === 'error' || s === 'failed' || s === 'terminated') return 'critical';
  return 'attention';
};

const TABS: { id: AgentTab; label: string }[] = [
  { id: 'geral', label: 'Visão geral' },
  { id: 'competencias', label: 'Competências' },
  { id: 'hierarquia', label: 'Hierarquia' },
  { id: 'tarefas', label: 'Tarefas' },
  { id: 'execucoes', label: 'Execuções' },
  { id: 'runtime', label: 'Runtime State' },
  { id: 'permissoes', label: 'Permissões & Acesso' },
];

export const AgentDetailPage: React.FC<AgentDetailPageProps> = ({
  agentId: agentIdProp,
  onNavigate,
  onToast,
}) => {
  const { agentId: agentIdFromUrl } = useParams<{ agentId: string }>();
  const agentId = agentIdProp ?? agentIdFromUrl ?? '';
  if (!agentId) {
    return null;
  }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<PaperclipAgentDto | null>(null);
  const [runtimeState, setRuntimeState] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<AgentTab>('geral');
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [editingAgent, setEditingAgent] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', role: '', budgetMonthlyCents: '' });

  useEffect(() => {
    if (agent) {
      setEditForm({
        title: agent.title || '',
        role: agent.role || '',
        budgetMonthlyCents: typeof agent.budgetMonthlyCents === 'number' ? String(agent.budgetMonthlyCents) : '',
      });
    }
  }, [agent]);

  const loadAgent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detRes, rtRes] = await Promise.allSettled([
        paperclipService.getAgent(agentId),
        paperclipService.getAgentRuntimeState(agentId),
      ]);
      if (detRes.status === 'fulfilled') setAgent(detRes.value.agent);
      if (rtRes.status === 'fulfilled') setRuntimeState(rtRes.value.runtimeState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar os detalhes do agente.');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  const handleAction = useCallback(async (action: string) => {
    setBusy((prev) => ({ ...prev, [action]: true }));
    try {
      if (action === 'wakeup') await paperclipService.wakeupAgent(agentId);
      else if (action === 'heartbeat') await paperclipService.invokeHeartbeat(agentId);
      else if (action === 'pause') await paperclipService.pauseAgent(agentId);
      else if (action === 'resume') await paperclipService.resumeAgent(agentId);
      await loadAgent();
      onToast(`Ação ${action} enviada ao Paperclip.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Paperclip recusou a operação no agente.');
    } finally {
      setBusy((prev) => ({ ...prev, [action]: false }));
    }
  }, [agentId, loadAgent, onToast]);

  const handleSaveAgent = async () => {
    const payload: Record<string, unknown> = {};
    if (editForm.title) payload.title = editForm.title;
    if (editForm.role) payload.role = editForm.role;
    if (editForm.budgetMonthlyCents !== '') {
      const n = Number(editForm.budgetMonthlyCents);
      if (Number.isFinite(n) && n >= 0) payload.budgetMonthlyCents = Math.round(n * 100);
    }
    if (Object.keys(payload).length === 0) {
      onToast('Nenhum campo para atualizar.');
      return;
    }
    setEditingAgent(false);
    try {
      await paperclipService.updateAgent(agentId, payload);
      onToast('Agente atualizado no Paperclip.');
      await loadAgent();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha ao atualizar o agente.');
      setEditingAgent(true);
    }
  };

  const relatedIssues = (agent ? [] : []) as PaperclipIssueDto[];
  const relatedRuns = (agent ? [] : []) as PaperclipRunDto[];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar o agente" message={error} onRetry={loadAgent} />;
  if (!agent) return <EmptyState title="Agente não encontrado" description="O agente solicitado não existe na instância Paperclip." />;

  const isPaused = agent.status.toLowerCase() === 'paused';
  const isBusy = (action: string) => Boolean(busy[action]);
  const consumption = () => {
    const spent = typeof agent.spentMonthlyCents === 'number' ? agent.spentMonthlyCents / 100 : 0;
    const budget = typeof agent.budgetMonthlyCents === 'number' ? agent.budgetMonthlyCents / 100 : null;
    return budget != null ? `${spent.toFixed(2)} / ${budget.toFixed(2)} USD` : `${spent.toFixed(2)} USD`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={agent.title || agent.name}
        subtitle={`${agent.role || 'Agente Paperclip'} · ID ${agent.id}`}
        actions={
          <>
            <button
              type="button"
              onClick={() => onNavigate(`ia-chat:agent:${agentId}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Abrir chat
            </button>
            <button
              type="button"
              disabled={isBusy('wakeup')}
              onClick={() => handleAction('wakeup')}
              className="px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" /> Wakeup
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="nc-card rounded-2xl p-4 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Status / Lifecycle</div>
          <div className="mt-1 flex items-center gap-2">
            <StatusText label={agent.status} tone={statusTone(agent.status)} />
            {agent.lifecycleState && (
              <span className="text-[10px] text-ink-subtle">({agent.lifecycleState})</span>
            )}
          </div>
        </div>
        <div className="nc-card rounded-2xl p-4 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Adapter</div>
          <div className="mt-1 font-mono text-ink">{agent.adapterType || '—'}</div>
        </div>
        <div className="nc-card rounded-2xl p-4 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Consumo mensal</div>
          <div className="mt-1 font-mono font-semibold text-ink">{consumption()}</div>
        </div>
        <div className="nc-card rounded-2xl p-4 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Último heartbeat</div>
          <div className="mt-1 font-mono text-ink">
            {agent.lastHeartbeatAt || agent.updatedAt || '—'}
          </div>
        </div>
      </div>

      <SegmentedTabs
        active={tab}
        onChange={setTab}
        tabs={TABS.map((t) => ({ ...t, count: t.id === 'tarefas' ? relatedIssues.length : t.id === 'execucoes' ? relatedRuns.length : undefined }))}
      />

      {tab === 'geral' && (
        <div className="space-y-4">
          <div className="nc-card rounded-2xl p-5 space-y-3">
            <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Identidade</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-ink-subtle">Nome</div>
                <div className="font-medium text-ink">{agent.title || agent.name}</div>
              </div>
              <div>
                <div className="text-ink-subtle">Cargo / Role</div>
                <div className="font-medium text-ink">{agent.role || '—'}</div>
              </div>
            </div>
          </div>
          <div className="nc-card rounded-2xl p-5 space-y-3">
            <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Orçamento e consumo</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-ink-subtle">Orçamento mensal</div>
                <div className="font-mono text-highlight">{typeof agent.budgetMonthlyCents === 'number' ? (agent.budgetMonthlyCents / 100).toFixed(2) : '—'} USD</div>
              </div>
              <div>
                <div className="text-ink-subtle">Gasto do mês</div>
                <div className="font-mono text-ink">{typeof agent.spentMonthlyCents === 'number' ? (agent.spentMonthlyCents / 100).toFixed(2) : '—'} USD</div>
              </div>
            </div>
          </div>
          <div className="nc-card rounded-2xl p-5 space-y-3">
            <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Ações rápidas</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isBusy('wakeup')}
                onClick={() => handleAction('wakeup')}
                className="px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 mr-1.5" /> Wakeup
              </button>
              <button
                type="button"
                disabled={isBusy('heartbeat')}
                onClick={() => handleAction('heartbeat')}
                className="px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Heartbeat
              </button>
              <button
                type="button"
                disabled={isBusy(isPaused ? 'resume' : 'pause')}
                onClick={() => handleAction(isPaused ? 'resume' : 'pause')}
                className="px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer disabled:opacity-50"
              >
                {isPaused ? <Play className="w-3.5 h-3.5 mr-1.5" /> : <Pause className="w-3.5 h-3.5 mr-1.5" />}
                {isPaused ? 'Retomar' : 'Pausar'}
              </button>
              {editingAgent ? (
                <>
                  <input
                    autoFocus
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="Título"
                    className="px-2 py-1.5 rounded border border-line-strong bg-white text-xs text-ink focus:border-accent focus:ring-0 outline-none"
                  />
                  <input
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    placeholder="Role"
                    className="px-2 py-1.5 rounded border border-line-strong bg-white text-xs text-ink focus:border-accent focus:ring-0 outline-none"
                  />
                  <input
                    value={editForm.budgetMonthlyCents}
                    onChange={(e) => setEditForm({ ...editForm, budgetMonthlyCents: e.target.value })}
                    placeholder="Orçamento mensal (USD)"
                    className="px-2 py-1.5 rounded border border-line-strong bg-white text-xs text-ink focus:border-accent focus:ring-0 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveAgent}
                    className="px-2.5 py-1.5 rounded-lg border border-line-strong bg-accent text-white text-xs font-semibold hover:bg-accent-hover cursor-pointer"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingAgent(false)}
                    className="px-2.5 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingAgent(true)}
                  className="px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
                >
                  Editar dados
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'competencias' && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-ink-subtle inline-flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" /> <span>Capabilities registradas no Paperclip</span>
          </div>
          {(agent.capabilities || []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(agent.capabilities as string[]).map((cap, idx) => (
                <span key={idx} className="px-3 py-1.5 rounded-lg border border-line-strong bg-surface-subtle/50 text-xs text-ink">
                  {cap}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-ink-subtle">Nenhuma competência listada neste registro.</div>
          )}
        </div>
      )}

      {tab === 'hierarquia' && (
        <div className="space-y-3 text-xs">
          <div className="p-4 rounded-xl border border-line bg-surface-subtle/40 space-y-1">
            <div className="text-ink-subtle">Reporta diretamente para (reportsTo)</div>
            <div className="font-mono font-semibold text-ink">
              {agent.reportsTo || 'Topo da cadeia / Sem superior direto'}
            </div>
          </div>
          {agent.chainOfCommand && agent.chainOfCommand.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-ink-subtle font-semibold inline-flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> <span>Cadeia de comando</span>
              </div>
              <pre className="p-3 rounded-xl border border-line bg-surface-subtle/40 font-mono text-[11px] overflow-x-auto">
                {JSON.stringify(agent.chainOfCommand, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {tab === 'tarefas' && (
        <div className="space-y-3">
          {relatedIssues.length > 0 ? (
            <div className="divide-y divide-line">
              {relatedIssues.map((i) => (
                <div key={i.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-ink">{i.title}</div>
                    <div className="text-[10px] text-ink-subtle">{i.identifier || i.id}</div>
                  </div>
                  <StatusBadge status={i.status} size="sm" />
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-xs text-ink-subtle text-center border border-line rounded-xl">
              Nenhuma tarefa atribuída a este agente.
            </div>
          )}
        </div>
      )}

      {tab === 'execucoes' && (
        <div className="divide-y divide-line border border-line rounded-xl">
          {relatedRuns.length > 0 ? (
            <div className="p-3">
              {relatedRuns.map((r) => (
                <div key={r.id} className="p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-ink-subtle">{r.startedAt || '—'}</span>
                    <StatusBadge status={r.status} size="sm" />
                  </div>
                  <div className="font-mono text-ink">{r.model || '—'} · {(r.costCents != null ? (r.costCents / 100).toFixed(4) : '—')} USD</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-xs text-ink-subtle text-center">Nenhuma execução registrada para este agente.</div>
          )}
        </div>
      )}

      {tab === 'runtime' && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-ink-subtle inline-flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> <span>Runtime State &amp; Configuração</span>
          </div>
          <pre className="p-4 rounded-xl border border-line bg-surface-subtle/40 font-mono text-[11px] overflow-x-auto max-h-80">
            {JSON.stringify({ runtimeState, runtimeConfig: agent.runtimeConfig || null }, null, 2)}
          </pre>
        </div>
      )}

      {tab === 'permissoes' && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-ink-subtle inline-flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-accent dark:text-cyan-300" /> <span>Permissões &amp; Acesso</span>
          </div>
          <pre className="p-4 rounded-xl border border-line bg-surface-subtle/40 font-mono text-[11px] overflow-x-auto max-h-80">
            {JSON.stringify({ permissions: agent.permissions || null, access: agent.access || null }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
