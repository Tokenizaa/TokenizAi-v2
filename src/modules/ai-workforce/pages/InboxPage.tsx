import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components';
import { hermesService } from '../services/hermes';
import type { HermesActivityDto } from '../../../types/platform';

interface InboxPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const InboxPage: React.FC<InboxPageProps> = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<HermesActivityDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await hermesService.listActivity(50);
      setActivity(result.activity || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar a atividade do runtime Hermes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar a atividade" message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <PageHeader title="Atividade e atenção" subtitle="O contrato atual do Hermes não oferece uma inbox dedicada. Esta página apresenta somente eventos reais retornados pelo serviço de atividade."
        actions={<button type="button" onClick={load} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"><RefreshCw className="w-3.5 h-3.5" /> Atualizar</button>} />
      <div className="nc-card rounded-2xl p-5">
        <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-accent" /><h2 className="font-display text-sm font-semibold text-ink">Eventos recentes</h2><span className="ml-auto font-mono text-xs text-ink-subtle">{activity.length}</span></div>
        {activity.length === 0 ? <div className="pt-5"><EmptyState title="Nenhuma atividade registrada" description="A consulta ao serviço de atividade do Hermes foi concluída e não retornou eventos." /></div> : (
          <div className="mt-4 divide-y divide-line">
            {activity.map((event) => <div key={event.id} className="py-4">
              <div className="flex items-center justify-between gap-3"><span className="font-medium text-sm text-ink">{event.action}</span><StatusBadge status={event.status || 'registrado'} size="sm" /></div>
              <div className="mt-1 text-xs text-ink-muted">{event.actorName} · {event.timestamp}{event.targetName ? ' · ' + event.targetName : ''}</div>
              {event.summary && <p className="mt-1 text-xs text-ink-subtle">{event.summary}</p>}
            </div>)}
          </div>
        )}
      </div>
    </div>
  );
};
