import React, { useCallback, useEffect, useState } from 'react';
import { Target, RefreshCw } from 'lucide-react';
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
import type { PaperclipGoalDto } from '../../../types/platform';

interface GoalsPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const GoalsPage: React.FC<GoalsPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<PaperclipGoalDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hermesService.listGoals();
      setGoals(res.goals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar as metas do Paperclip.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar as metas" message={error} onRetry={load} />;
  if (goals.length === 0) {
    return (
      <EmptyState
        title="Nenhuma meta operacional"
        description="A instância Paperclip conectada não possui metas (goals) cadastradas para esta empresa."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Metas e objetivos (Paperclip)"
        subtitle="Acompanhamento de metas operacionais, progresso e relações com projetos do Paperclip."
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
          <SectionTitle title={`Metas (${goals.length})`} />
        </div>
      </CollectionToolbar>

      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {goals.map((g) => (
          <div key={g.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink">{g.title}</div>
              {g.description && <div className="text-[11px] text-ink-muted line-clamp-1">{g.description}</div>}
              <div className="mt-1 text-[11px] text-ink-muted">
                Nível: {g.level || '—'} · Proprietário: {g.ownerAgentId || 'não definido'} · Status: {g.status || '—'}
              </div>
            </div>
            <div className="text-right">
              {typeof g.progressPercent === 'number' ? (
                <div className="font-mono font-semibold text-highlight tabular-nums">{g.progressPercent}%</div>
              ) : (
                <div className="font-mono text-ink-muted">—</div>
              )}
              <div className="text-[10px] text-ink-subtle">progresso</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-subtle">
        Metas pertencem ao escopo operacional do Paperclip. Para vincular a um projeto empresarial da TokenizAi, use o identificador correspondente.
      </p>
    </div>
  );
};
