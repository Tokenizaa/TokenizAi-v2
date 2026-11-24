import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import {
  CollectionToolbar,
  SectionTitle,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components';
import { hermesService } from '../services/hermes';
import type { HermesActivityDto } from '../../../types/platform';

interface ActivityPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const ActivityPage: React.FC<ActivityPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<HermesActivityDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hermesService.listActivity(100);
      setActivity(res.activity || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a atividade do Paperclip.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar a atividade" message={error} onRetry={load} />;
  if (activity.length === 0) {
    return (
      <EmptyState
        title="Sem atividade registrada"
        description="A trilha de auditoria do Paperclip não possui eventos recentes para esta empresa."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Atividade e auditoria (Paperclip)"
        subtitle="Timeline de eventos, ações de agentes e alterações operacionais com identificação do responsável."
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
        <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
          <SectionTitle title={`Eventos recentes (${activity.length})`} subtitle="Fonte: endpoint /activity da instância Paperclip." />
        </div>
      </CollectionToolbar>

      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {activity.map((event) => (
          <div key={event.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink">{event.action}</div>
              <div className="text-[11px] text-ink-muted">
                {event.actorName} ({event.actorType || 'sistema'}) ·
                {event.targetType ? event.targetType + ':' : ''}{event.targetId || ''}
              </div>
              <div className="mt-1 text-[11px] text-ink-muted">
                {event.timestamp} · {event.summary || ''}
              </div>
            </div>
            <div className="text-[11px] font-mono text-ink-muted text-right">
              {event.issueId ? `Issue: ${event.issueId}` : '—'}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-subtle">
        A atividade e auditoria refletem os eventos operacionais do Paperclip. Elas não incluem dados financeiros ou empresariais da TokenizAi.
      </p>
    </div>
  );
};
