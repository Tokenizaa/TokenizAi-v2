import React, { useCallback, useEffect, useState } from 'react';
import { Clock, RefreshCw, Play } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import {
  CollectionToolbar,
  SectionTitle,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components';
import { paperclipService } from '../services/paperclip';
import type { PaperclipRoutineDto } from '../../../types/platform';

interface RoutinesPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const RoutinesPage: React.FC<RoutinesPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routines, setRoutines] = useState<PaperclipRoutineDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paperclipService.listRoutines();
      setRoutines(res.routines || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar as rotinas do Paperclip.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runManually = async (routineId: string) => {
    try {
      await paperclipService.runRoutine(routineId);
      onToast('Rotina executada manualmente no Paperclip.');
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha ao executar a rotina.');
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar as rotinas" message={error} onRetry={load} />;
  if (routines.length === 0) {
    return (
      <EmptyState
        title="Nenhuma rotina encontrada"
        description="A instância Paperclip conectada não possui rotinas agendadas para esta empresa."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rotinas e automações (Paperclip)"
        subtitle="Rotinas agendadas, gatilhos webhook/api e histórico de execuções diretamente no Paperclip."
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
              <button
                type="button"
                onClick={() => runManually(routine.id)}
                className="px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 mr-1.5" /> Executar
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-subtle">
        A execução manual de rotinas é uma operação de escrita sobre o Paperclip. Gatilhos e agendamentos são gerenciados diretamente na instância operacional.
      </p>
    </div>
  );
};
