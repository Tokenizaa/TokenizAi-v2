import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Share2 } from 'lucide-react';
import { PageHeader, StatusText } from '../../../components/ui/Primitives';
import { EmptyState, ErrorState, LoadingState } from '../../ai-workforce/components';
import { hermesService } from '../../ai-workforce/services/hermes';
import type { HermesTaskDto } from '../../../types/platform';
import { useParams } from 'react-router-dom';

interface TaskDetailPageProps {
  taskId?: string;
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

const statusTone = (st: string) => {
  const s = st.toLowerCase();
  if (s === 'done' || s === 'completed') return 'nominal';
  if (s === 'blocked' || s === 'cancelled') return 'critical';
  if (s === 'in_progress' || s === 'in_review' || s === 'running') return 'attention';
  return 'neutral';
};

export const TaskDetailPage: React.FC<TaskDetailPageProps> = ({
  taskId: taskIdProp,
  onToast,
}) => {
  const { taskId: taskIdFromUrl } = useParams<{ taskId: string }>();
  const taskId = taskIdProp ?? taskIdFromUrl ?? '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<HermesTaskDto | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!taskId) {
      setError('O identificador da tarefa não foi informado.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await hermesService.listTasks();
      setTask(result.tasks.find((item) => item.id === taskId) || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar tarefas no runtime Hermes.');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (status: string) => {
    if (!task) return;
    setSaving(true);
    try {
      await hermesService.updateTask(task.id, { status });
      onToast(`Status da tarefa atualizado para ${status}.`);
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha ao atualizar a tarefa no Hermes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar a tarefa" message={error} onRetry={load} />;
  if (!task) {
    return (
      <EmptyState
        title="Tarefa não encontrada"
        description="A listagem real de tarefas do Hermes não retornou um registro com este identificador."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={task.title}
        subtitle={`${task.id} · ${task.status}`}
        actions={
          <button
            type="button"
            onClick={load}
            className="px-3 py-1.5 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Atualizar
          </button>
        }
      />

      <section className="nc-card rounded-2xl p-5 space-y-4">
        <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Dados da tarefa</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-ink-subtle">Status</div>
            <StatusText label={task.status} tone={statusTone(task.status)} />
          </div>
          <div>
            <div className="text-ink-subtle">Prioridade</div>
            <div className="font-mono text-ink">{task.priority || 'Não informada'}</div>
          </div>
          <div>
            <div className="text-ink-subtle">Responsável</div>
            <div className="font-mono text-ink">{task.assigneeAgentName || 'Não atribuído'}</div>
          </div>
          <div>
            <div className="text-ink-subtle">Projeto operacional</div>
            <div className="font-mono text-ink">{task.projectName || task.projectId || 'Não vinculado'}</div>
          </div>
          <div>
            <div className="text-ink-subtle">Tarefa superior</div>
            <div className="font-mono text-ink">{task.parentId || 'Nenhuma'}</div>
          </div>
          <div>
            <div className="text-ink-subtle">Última atualização</div>
            <div className="font-mono text-ink">{task.updatedAt || 'Não informada'}</div>
          </div>
        </div>
        {task.description && (
          <div className="border-t border-line pt-4">
            <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase mb-2">Descrição</div>
            <p className="text-sm text-ink whitespace-pre-wrap">{task.description}</p>
          </div>
        )}
      </section>

      <section className="nc-card rounded-2xl p-5 space-y-3">
        <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Atualizar status</div>
        <div className="flex flex-wrap gap-2">
          {['todo', 'in_progress', 'blocked', 'done'].map((status) => (
            <button
              key={status}
              type="button"
              disabled={saving || task.status === status}
              onClick={() => updateStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50 ${task.status === status ? 'bg-accent border-accent text-white' : 'border-line-strong bg-surface text-ink hover:bg-surface-subtle'} cursor-pointer`}
            >
              {status}
            </button>
          ))}
        </div>
      </section>

      <div className="nc-card rounded-2xl p-4 text-xs text-ink-muted">
        Comentários, anexos e interações detalhadas não são apresentados porque essas operações ainda não fazem parte do contrato público atual do runtime Hermes. Nenhum conteúdo é simulado.
      </div>
    </div>
  );
};
