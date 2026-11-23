import React, { useCallback, useEffect, useState } from 'react';
import { Activity, OctagonX, RefreshCw, Terminal } from 'lucide-react';
import { SlideDrawer, StatusText } from '../../components/ui/Primitives';
import { formatCents, formatDateTimeBR, PaperclipApi } from '../../services/api';
import type {
  NavSectionId,
  PaperclipIntegrationStatus,
  PaperclipRunDto,
} from '../../types/platform';
import { PaperclipStatusPanel } from './PaperclipStatusPanel';

interface PaperclipRunsPanelProps {
  status: PaperclipIntegrationStatus;
  onNavigate: (sec: NavSectionId) => void;
  onToast: (msg: string) => void;
}

const RUN_STATUS_LABELS: Record<string, string> = {
  queued: 'Na Fila',
  running: 'Em Execução',
  succeeded: 'Concluída',
  completed: 'Concluída',
  failed: 'Com Erro',
  error: 'Com Erro',
  cancelled: 'Cancelada',
  skipped: 'Ignorada',
};

export const PaperclipRunsPanel: React.FC<PaperclipRunsPanelProps> = ({
  status,
  onNavigate,
  onToast,
}) => {
  const [runs, setRuns] = useState<PaperclipRunDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PaperclipRunDto | null>(null);
  const [runLogs, setRunLogs] = useState<string[]>([]);
  const [runEvents, setRunEvents] = useState<Array<Record<string, unknown>>>([]);
  const [cancelling, setCancelling] = useState(false);

  const isConnected =
    status.configured && status.reachable && status.authenticated && Boolean(status.companyId);

  const canCancel = status.availableCapabilities.some(
    (c) => c.key === 'runs:cancel' && c.availableInVersion !== false && c.authState !== 'forbidden',
  );

  const loadRuns = useCallback(async () => {
    if (!isConnected) {
      setRuns([]);
      return;
    }
    setLoading(true);
    try {
      const res = await PaperclipApi.listRuns({ limit: 50 });
      setRuns(res.runs || []);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao consultar execuções no Paperclip.');
    } finally {
      setLoading(false);
    }
  }, [isConnected, onToast]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Controlled polling respecting PAPERCLIP_SYNC_INTERVAL_MS
  useEffect(() => {
    if (!isConnected) return;
    const timer = window.setInterval(() => {
      loadRuns();
    }, Math.max(5000, status.syncIntervalMs || 15000));
    return () => window.clearInterval(timer);
  }, [isConnected, status.syncIntervalMs, loadRuns]);

  const openRunDetail = async (run: PaperclipRunDto) => {
    setSelectedRun(run);
    setRunLogs(run.logs || []);
    setRunEvents(run.events || []);
    try {
      const [detailRes, evRes] = await Promise.allSettled([
        PaperclipApi.getRun(run.id),
        PaperclipApi.getRunEvents(run.id),
      ]);
      if (detailRes.status === 'fulfilled') {
        setSelectedRun(detailRes.value.run);
      }
      if (evRes.status === 'fulfilled') {
        setRunLogs(evRes.value.logs || []);
        setRunEvents(evRes.value.events || []);
      }
    } catch {
      // Keep base summary
    }
  };

  const handleCancelRun = async (runId: string) => {
    setCancelling(true);
    try {
      await PaperclipApi.cancelRun(runId);
      await loadRuns();
      onToast('Cancelamento solicitado ao Paperclip.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Não foi possível cancelar a execução.');
    } finally {
      setCancelling(false);
    }
  };

  const runTone = (st: string) => {
    const s = st.toLowerCase();
    if (s === 'succeeded' || s === 'completed') return 'nominal' as const;
    if (s === 'failed' || s === 'error') return 'critical' as const;
    if (s === 'running' || s === 'queued') return 'attention' as const;
    return 'neutral' as const;
  };

  if (!isConnected) {
    return (
      <PaperclipStatusPanel
        status={status}
        title="Execuções & Heartbeats (Paperclip)"
        requiredCapabilities={['runs:read']}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-ink-subtle">
          Estados oficiais de execução (na fila, em execução, concluída, erro, cancelada, ignorada) sincronizados em intervalo de{' '}
          <span className="font-mono text-ink">{Math.round((status.syncIntervalMs || 15000) / 1000)}s</span>.
        </div>
        <button
          type="button"
          onClick={loadRuns}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-strong bg-surface text-xs font-semibold text-ink cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar execuções</span>
        </button>
      </div>

      <section className="rounded-2xl nc-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line text-[11px] font-semibold text-ink-subtle bg-surface-subtle/40">
                <th className="py-3 px-6">Início</th>
                <th className="py-3 px-4">Agente Executor</th>
                <th className="py-3 px-4">Origem / Issue</th>
                <th className="py-3 px-4">Modelo / Tokens</th>
                <th className="py-3 px-4">Status da Execução</th>
                <th className="py-3 px-4 text-right">Duração</th>
                <th className="py-3 px-6 text-right">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-sm">
              {runs.map((run) => (
                <tr
                  key={run.id}
                  onClick={() => openRunDetail(run)}
                  className="hover:bg-surface-blue/40 transition-colors cursor-pointer"
                >
                  <td className="py-3.5 px-6 font-mono text-xs text-ink-subtle whitespace-nowrap">
                    {formatDateTimeBR(run.startedAt)}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-ink whitespace-nowrap">
                    {run.agentName || run.agentId || '—'}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-ink-muted">
                    <div>{run.triggerSource || 'heartbeat'}</div>
                    {run.issueIdentifier && (
                      <div className="font-mono text-accent dark:text-cyan-300">{run.issueIdentifier}</div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-ink-subtle">
                    <div>{run.model || run.provider || '—'}</div>
                    {typeof run.totalTokens === 'number' && (
                      <div>{run.totalTokens.toLocaleString('pt-BR')} tokens</div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <StatusText
                      label={RUN_STATUS_LABELS[run.status.toLowerCase()] || run.status}
                      tone={runTone(run.status)}
                    />
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs text-ink-subtle whitespace-nowrap">
                    {typeof run.durationMs === 'number' ? `${run.durationMs} ms` : '—'}
                  </td>
                  <td className="py-3.5 px-6 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                    {formatCents(run.costCents, run.currency)}
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-ink-subtle">
                    Nenhuma execução de heartbeat registrada até o momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <SlideDrawer
        open={Boolean(selectedRun)}
        onClose={() => setSelectedRun(null)}
        wide
        title={`Execução ${selectedRun?.id || ''}`}
        subtitle={selectedRun ? `${selectedRun.agentName || ''} · ${selectedRun.triggerSource || 'heartbeat'}` : undefined}
      >
        {selectedRun && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-line">
              <StatusText
                label={RUN_STATUS_LABELS[selectedRun.status.toLowerCase()] || selectedRun.status}
                tone={runTone(selectedRun.status)}
              />
              {canCancel &&
                (selectedRun.status === 'running' || selectedRun.status === 'queued') && (
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() => handleCancelRun(selectedRun.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-500/10 cursor-pointer"
                  >
                    <OctagonX className="w-3.5 h-3.5" />
                    <span>Cancelar execução</span>
                  </button>
                )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs py-3 border-b border-line">
              <div>
                <div className="text-ink-subtle">Início</div>
                <div className="font-mono text-ink mt-0.5">{formatDateTimeBR(selectedRun.startedAt)}</div>
              </div>
              <div>
                <div className="text-ink-subtle">Término</div>
                <div className="font-mono text-ink mt-0.5">{formatDateTimeBR(selectedRun.finishedAt)}</div>
              </div>
              <div>
                <div className="text-ink-subtle">Duração</div>
                <div className="font-mono text-ink mt-0.5">
                  {typeof selectedRun.durationMs === 'number' ? `${selectedRun.durationMs} ms` : '—'}
                </div>
              </div>
              <div>
                <div className="text-ink-subtle">Modelo / Provedor</div>
                <div className="font-mono text-ink mt-0.5">
                  {selectedRun.model || '—'} {selectedRun.provider ? `(${selectedRun.provider})` : ''}
                </div>
              </div>
              <div>
                <div className="text-ink-subtle">Tokens (In / Out)</div>
                <div className="font-mono text-ink mt-0.5">
                  {selectedRun.inputTokens ?? '—'} / {selectedRun.outputTokens ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-ink-subtle">Custo Apurado</div>
                <div className="font-mono text-highlight font-semibold mt-0.5">
                  {formatCents(selectedRun.costCents, selectedRun.currency)}
                </div>
              </div>
            </div>

            {selectedRun.errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300">
                <strong>Erro:</strong> {selectedRun.errorMessage}
              </div>
            )}

            {selectedRun.resultSummary && (
              <div className="p-4 rounded-xl bg-surface-subtle/50 border border-line text-xs text-ink-muted">
                {selectedRun.resultSummary}
              </div>
            )}

            {runEvents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-ink-subtle inline-flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Eventos da Execução</span>
                </h4>
                <div className="divide-y divide-line border border-line rounded-xl max-h-48 overflow-y-auto">
                  {runEvents.map((ev, i) => (
                    <div key={i} className="px-3.5 py-2 text-xs font-mono text-ink-muted">
                      {JSON.stringify(ev)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {runLogs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-ink-subtle inline-flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Logs</span>
                </h4>
                <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-56">
                  {runLogs.join('\n')}
                </pre>
              </div>
            )}
          </div>
        )}
      </SlideDrawer>
    </div>
  );
};
