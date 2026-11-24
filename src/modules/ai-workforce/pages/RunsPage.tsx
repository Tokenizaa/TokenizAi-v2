import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Clock, RefreshCw, Play } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import {
  CollectionToolbar,
  SectionTitle,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components';
import { hermesService } from '../services/hermes';
import type { HermesRunDto } from '../../../types/platform';

interface RunsPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

const statusTone = (st: string) => {
  const s = st.toLowerCase();
  if (s === 'passed' || s === 'completed' || s === 'done') return 'nominal';
  if (s === 'failed' || s === 'error' || s === 'cancelled') return 'critical';
  if (s === 'running' || s === 'pending') return 'attention';
  return 'neutral';
};

export const RunsPage: React.FC<RunsPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<HermesRunDto[]>([]);
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, string | number | undefined> = {};
      if (agentFilter !== 'all') filters.agentId = agentFilter;
      if (statusFilter !== 'all') filters.status = statusFilter;
      const res = await hermesService.listRuns(filters);
      setRuns(res.runs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar as execuções do Paperclip.');
    } finally {
      setLoading(false);
    }
  }, [agentFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const agentIds = Array.from(new Set(runs.map((r) => r.agentId).filter(Boolean))) as string[];
  const statuses = Array.from(new Set(runs.map((r) => r.status).filter(Boolean)));

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar as execuções" message={error} onRetry={load} />;

  const filtered = runs.filter((r) => {
    if (agentFilter !== 'all' && r.agentId !== agentFilter) return false;
    if (statusFilter !== 'all' && r.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Execuções &amp; heartbeats (Paperclip)"
        subtitle="Monitoramento de execuções, logs, eventos, tokens, modelos e cancelamentos suportados."
        actions={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Recarregar
          </button>
        }
      />

      <CollectionToolbar>
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            aria-label="Filtrar por agente"
            className="px-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink shrink-0"
          >
            <option value="all">Todos os agentes</option>
            {agentIds.map((aid) => (
              <option key={aid} value={aid}>
                Agente {aid.slice(0, 6)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrar por status"
            className="px-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink shrink-0"
          >
            <option value="all">Todos os status</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            className="px-3 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
          >
            Aplicar
          </button>
        </div>
      </CollectionToolbar>

      <SectionTitle title={`Execuções recentes (${filtered.length} de ${runs.length})`} />

      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {filtered.map((run) => (
          <div key={run.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink">{run.agentName || 'Agente'} · {run.model || '—'}</div>
              <div className="text-[11px] text-ink-muted">
                Issue: {run.issueIdentifier || '—'} · Provider: {run.provider || '—'}
              </div>
              <div className="mt-1 text-[11px] text-ink-muted">
                {run.startedAt || '—'} → {run.finishedAt || '—'} ·
                {run.durationMs != null ? run.durationMs + ' ms' : '—'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={run.status} size="sm" />
              <span className="font-mono text-[11px] text-ink-muted">
                {run.costCents != null ? (run.costCents / 100).toFixed(4) : '0'} USD
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-xs text-ink-subtle">
            Nenhuma execução registrada para os filtros selecionados.
          </div>
        )}
      </div>

      <p className="text-xs text-ink-subtle">
        Os dados de execução vêm do histórico de runs do Paperclip. Cancelamento de execução ativa está disponível quando suportado pela instância.
      </p>
    </div>
  );
};
