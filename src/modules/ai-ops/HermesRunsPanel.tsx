import React, { useCallback, useEffect, useState } from 'react';
import { Activity, OctagonX, RefreshCw, Terminal } from 'lucide-react';
import { SlideDrawer, StatusText } from '../../components/ui/Primitives';
import { formatCents, formatDateTimeBR, HermesApi } from '../../services/api';
import type { HermesIntegrationStatus, NavSectionId, HermesRunDto } from '../../types/platform';
import { HermesStatusPanel } from './HermesStatusPanel';

interface HermesRunsPanelProps {
  status: HermesIntegrationStatus;
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

export const HermesRunsPanel: React.FC<HermesRunsPanelProps> = ({
  status,
  onNavigate,
  onToast,
}) => {
  const [runs, setRuns] = useState<HermesRunDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<HermesRunDto | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const isConnected = status.configured && status.connected;

  const canCancel = status.availableCapabilities.some(
    (c) => c.key === 'runs:manage' && c.available,
  );

  const loadRuns = useCallback(async () => {
    if (!isConnected) {
      setRuns([]);
      return;
    }
    setLoading(true);
    try {
      const res = await HermesApi.listRuns();
      setRuns(res.runs || []);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao consultar execuções no Hermes.');
    } finally {
      setLoading(false);
    }
  }, [isConnected, onToast]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const openRunDetail = (run: HermesRunDto) => {
    setSelectedRun(run);
  };

  const handleCancelRun = async (runId: string) => {
    setCancelling(true);
    try {
      // O contrato Hermes atual não expõe endpoint de cancelamento direto por run.
      // A operação é comunicada ao usuário como indisponível neste runtime, sem
      // simular sucesso nem disparar calls para endpoints inexistentes.
      onToast(
        'Cancelamento de execução não disponível no contrato Hermes atual. A execução segue seu ciclo de vida.',
      );
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
      <HermesStatusPanel
        status={status}
        title="Execuções & Heartbeats (Hermes)"
        requiredCapabilities={['runs:read']}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-ink-subtle">
          Estados oficiais de execução (na fila, em execução, concluída, erro, cancelada, ignorada).{" "}
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
                    {formatDateTimeBR(run.startedAt || '')}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-ink whitespace-nowrap">
                    {run.agentName || run.agentId || '—'}
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
                  <td colSpan={5} className="py-10 text-center text-xs text-ink-subtle">
                    Nenhuma execução registrada neste runtime Hermes.
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
        subtitle={
          selectedRun
            ? `${selectedRun.agentName || ''} · ${formatDateTimeBR(selectedRun.startedAt || '')}`
            : undefined
        }
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
                <div className="font-mono text-ink mt-0.5">
                  {formatDateTimeBR(selectedRun.startedAt || '')}
                </div>
              </div>
              <div>
                <div className="text-ink-subtle">Término</div>
                <div className="font-mono text-ink mt-0.5">
                  {formatDateTimeBR(selectedRun.finishedAt || '')}
                </div>
              </div>
              <div>
                <div className="text-ink-subtle">Duração</div>
                <div className="font-mono text-ink mt-0.5">
                  {typeof selectedRun.durationMs === 'number'
                    ? `${selectedRun.durationMs} ms`
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-ink-subtle">Modelo</div>
                <div className="font-mono text-ink mt-0.5">
                  {selectedRun.model || '—'}
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

            {/* Logs e eventos: ausentes do contrato Hermes atual. Tratados como ausência declarada. */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-ink-subtle inline-flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                <span>Logs de Execução</span>
              </h4>
              <div className="p-4 rounded-xl bg-surface-subtle/50 border border-line text-xs text-ink-muted">
                Logs detalhados de execução não expostos pelo contrato Hermes atual.
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-ink-subtle inline-flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                <span>Eventos da Execução</span>
              </h4>
              <div className="p-4 rounded-xl bg-surface-subtle/50 border border-line text-xs text-ink-muted">
                Eventos estruturados de execução não expostos pelo contrato Hermes atual.
              </div>
            </div>
          </div>
        )}
      </SlideDrawer>
    </div>
  );
};
