import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
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
import type { HermesRoutineDto } from '../../../types/platform';

interface RoutinesPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const RoutinesPage: React.FC<RoutinesPageProps> = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routines, setRoutines] = useState<HermesRoutineDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hermesService.listRoutines();
      setRoutines(res.routines || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar as rotinas do Hermes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar as rotinas" message={error} onRetry={load} />;
  if (routines.length === 0) {
    return (
      <EmptyState
        title="Nenhuma rotina encontrada"
        description="A instância Hermes conectada não possui rotinas agendadas para esta empresa."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rotinas e automações (Hermes)"
        subtitle="Rotinas agendadas, gatilhos webhook/api e histórico de execuções diretamente no Hermes."
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

      <SectionTitle title={`Rotinas (${routines.length})`} />

      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {routines.map((routine) => (
          <div key={routine.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink">{routine.name}</div>
              {routine.description && (
                <div className="text-[11px] text-ink-muted line-clamp-1">{routine.description}</div>
              )}
              <div className="mt-1 text-[11px] text-ink-muted">
                Agente: {routine.agentName || '—'} · Projeto: {routine.projectId || '—'} ·
                Último: {routine.lastRunAt || '—'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={routine.enabled === false ? 'paused' : 'active'} size="sm" />
              <StatusBadge status={routine.lastRunStatus || 'desconhecido'} size="sm" />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-subtle">
        A execução manual e a gestão de gatilhos ainda não estão disponíveis no contrato conectado do Hermes.
      </p>
    </div>
  );
};
