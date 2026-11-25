import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components';
import { hermesService } from '../services/hermes';
import type { HermesActivityDto, HermesApprovalDto } from '../../../types/platform';

interface InboxPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const InboxPage: React.FC<InboxPageProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<HermesApprovalDto[]>([]);
  const [activity, setActivity] = useState<HermesActivityDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [approvalResult, activityResult] = await Promise.all([
        hermesService.listApprovals(),
        hermesService.listActivity(30),
      ]);
      setApprovals(approvalResult.approvals || []);
      setActivity(activityResult.activity || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar aprovações e atividade do runtime Hermes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingApprovals = approvals.filter((item) => item.status === 'pending');

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar a caixa de entrada" message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Caixa de entrada / Decisões"
        subtitle="Aprovações pendentes e atividade recente retornadas pelos serviços reais do runtime Hermes."
        actions={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="nc-card rounded-2xl p-5">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Aprovações pendentes</div>
          <div className="mt-1.5 font-display text-3xl font-semibold font-mono tabular-nums text-highlight">{pendingApprovals.length}</div>
        </div>
        <div className="nc-card rounded-2xl p-5">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Eventos recentes</div>
          <div className="mt-1.5 font-display text-3xl font-semibold font-mono tabular-nums text-ink">{activity.length}</div>
        </div>
      </section>

      {pendingApprovals.length === 0 && activity.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-5 h-5" />}
          title="Nenhuma decisão ou atividade pendente"
          description="Os serviços de aprovações e atividade do Hermes foram consultados e não retornaram registros."
        />
      ) : (
        <>
          <section className="nc-card rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="font-display text-sm font-semibold text-ink">Aprovações que exigem decisão</h2>
            </div>
            {pendingApprovals.length === 0 ? (
              <p className="p-5 text-xs text-ink-subtle">Nenhuma aprovação pendente.</p>
            ) : (
              <div className="divide-y divide-line">
                {pendingApprovals.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(`ia-aprovacao-detalhe:${item.id}`)}
                    className="w-full p-4 text-left hover:bg-surface-blue/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-sm text-ink">{item.title}</span>
                      <StatusBadge status={item.status} size="sm" />
                    </div>
                    <div className="mt-1 text-xs text-ink-muted">
                      Solicitante: {item.requestedByName || 'Não informado'} · {item.createdAt || 'Data não informada'}
                    </div>
                    {item.description && <p className="mt-1 text-xs text-ink-subtle line-clamp-2">{item.description}</p>}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="nc-card rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center gap-2">
              <Activity className="w-4 h-4 text-ink-subtle" />
              <h2 className="font-display text-sm font-semibold text-ink">Atividade recente</h2>
            </div>
            {activity.length === 0 ? (
              <p className="p-5 text-xs text-ink-subtle">Nenhum evento recente.</p>
            ) : (
              <div className="divide-y divide-line">
                {activity.map((event) => (
                  <div key={event.id} className="p-4">
                    <div className="font-medium text-sm text-ink">{event.action}</div>
                    <div className="mt-1 text-xs text-ink-muted">
                      {event.actorName} · {event.timestamp}
                    </div>
                    {event.summary && <p className="mt-1 text-xs text-ink-subtle">{event.summary}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
