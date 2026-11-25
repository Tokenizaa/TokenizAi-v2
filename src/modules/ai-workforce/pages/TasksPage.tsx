import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Pause } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import { CollectionToolbar, SectionTitle, StatusBadge, EmptyState, ErrorState, LoadingState } from '../components';
import { hermesService } from '../services/hermes';
import type { HermesTaskDto } from '../../../types/platform';

interface TasksPageProps { onNavigate: (id: string) => void; onToast: (msg: string) => void; }

export const TasksPage: React.FC<TasksPageProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<HermesTaskDto[]>([]);
  const [filters, setFilters] = useState({ q: '', status: 'all', projectId: '' });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await hermesService.listTasks();
      setTasks(result.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar tarefas do runtime Hermes.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const projectIds = useMemo(() => Array.from(new Set(tasks.flatMap((task) => task.projectId ? [task.projectId] : []))), [tasks]);
  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return tasks.filter((task) => {
      if (filters.status !== 'all' && task.status.toLowerCase() !== filters.status) return false;
      if (filters.projectId && task.projectId !== filters.projectId) return false;
      return !q || task.title.toLowerCase().includes(q) || task.id.toLowerCase().includes(q) || (task.description || '').toLowerCase().includes(q);
    });
  }, [tasks, filters]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar as tarefas" message={error} onRetry={load} />;

  const statusOptions = [
    { id: 'all', label: `Todas (${tasks.length})` },
    { id: 'todo', label: 'A fazer' },
    { id: 'in_progress', label: 'Em andamento' },
    { id: 'blocked', label: 'Bloqueada' },
    { id: 'done', label: 'Concluída' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Tarefas e delegações" subtitle="Tarefas retornadas pelo runtime Hermes, sem conversão para o modelo legado de issues."
        actions={<button type="button" onClick={load} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"><RefreshCw className="w-3.5 h-3.5" /> Atualizar</button>} />
      <CollectionToolbar>
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0 max-w-md">
            <Search className="w-4 h-4 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Buscar por título, ID ou descrição…" className="w-full pl-9 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink" />
          </div>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} aria-label="Filtrar status" className="px-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink">
            {statusOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <select value={filters.projectId} onChange={(e) => setFilters((f) => ({ ...f, projectId: e.target.value }))} aria-label="Filtrar projeto" className="px-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink">
            <option value="">Todos os projetos</option>
            {projectIds.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </div>
      </CollectionToolbar>
      <SectionTitle title={`Tarefas (${filtered.length} de ${tasks.length})`} />
      {filtered.length === 0 ? <EmptyState title="Nenhuma tarefa encontrada" description="A consulta ao Hermes foi concluída sem tarefas correspondentes aos filtros." /> : (
        <div className="divide-y divide-line rounded-xl border border-line bg-surface">
          {filtered.map((task) => <div key={task.id} role="button" tabIndex={0} onClick={() => onNavigate(`ia-tarefa-detalhe:${task.id}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onNavigate(`ia-tarefa-detalhe:${task.id}`); } }} className="p-4 cursor-pointer transition-colors hover:bg-surface-blue/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0"><div className="font-medium text-ink truncate">{task.title}</div><div className="text-[10px] text-ink-subtle truncate">{task.id} · {task.assigneeAgentName || 'Não atribuída'} · {task.projectName || 'Sem projeto'}</div></div>
              <div className="flex items-center gap-1.5"><StatusBadge status={task.status} size="sm" />{task.priority && <span className="font-mono text-[10px] border border-line-strong rounded px-1.5 py-0.5 text-ink-subtle">{task.priority}</span>}</div>
            </div>
            {task.description && <p className="mt-1.5 text-[11px] text-ink-muted line-clamp-1">{task.description}</p>}
            {task.parentId && <div className="mt-2 text-[10px] text-ink-subtle inline-flex items-center gap-1"><Pause className="w-3 h-3" /> Subtarefa de {task.parentId}</div>}
          </div>)}
        </div>
      )}
    </div>
  );
};
