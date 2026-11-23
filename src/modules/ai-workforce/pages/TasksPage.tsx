import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ListTodo, Search, RefreshCw, Filter, Play, Pause } from 'lucide-react';
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
import type { PaperclipIssueDto } from '../../../types/platform';

interface TasksPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

const statusTone = (st: string) => {
  const s = st.toLowerCase();
  if (s === 'done' || s === 'completed' || s === 'closed') return 'nominal';
  if (s === 'blocked') return 'critical';
  if (s === 'in_progress' || s === 'in-progress' || s === 'active' || s === 'running') return 'nominal';
  if (s === 'todo' || s === 'open' || s === 'pending') return 'attention';
  return 'neutral';
};

export const TasksPage: React.FC<TasksPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<PaperclipIssueDto[]>([]);
  const [filters, setFilters] = useState<{ q: string; status: string; projectId: string | null }>({
    q: '',
    status: 'all',
    projectId: null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paperclipService.listIssues({
        q: filters.q || undefined,
        status: filters.status === 'all' ? undefined : filters.status,
        projectId: filters.projectId || undefined,
      });
      setIssues(res.issues || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar as tarefas do Paperclip.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const projectIds = useMemo(() => {
    const set = new Set<string>();
    for (const i of issues) if (i.projectId) set.add(i.projectId);
    return Array.from(set);
  }, [issues]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return issues.filter((i) => {
      if (filters.status !== 'all' && i.status.toLowerCase() !== filters.status) return false;
      if (filters.projectId && i.projectId !== filters.projectId) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        (i.identifier || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q)
      );
    });
  }, [issues, filters]);

  const openIssue = (issueId: string) => onNavigate(`ia-tarefa-detalhe:${issueId}`);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar as tarefas" message={error} onRetry={load} />;
  if (filtered.length === 0) {
    return (
      <EmptyState
        title="Nenhuma tarefa encontrada"
        description="Ajuste os filtros de busca, status ou projeto, ou crie uma issue diretamente na instância Paperclip."
        action={
          <button
            type="button"
            onClick={load}
            className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Recarregar
          </button>
        }
      />
    );
  }

  const statusOptions = [
    { id: 'all', label: `Todas (${issues.length})` },
    { id: 'todo', label: 'Aberta' },
    { id: 'in_progress', label: 'Em andamento' },
    { id: 'blocked', label: 'Bloqueada' },
    { id: 'done', label: 'Concluída' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tarefas e delegações (Issues)"
        subtitle="Central oficial de issues, dependências, comentários, documentos e anexos do Paperclip."
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
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0 max-w-md">
            <Search className="w-4 h-4 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Buscar tarefa por título, identificador ou descrição…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            aria-label="Filtrar status da tarefa"
            className="px-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink shrink-0"
          >
            {statusOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <select
            value={filters.projectId ?? ''}
            onChange={(e) => setFilters({ ...filters, projectId: e.target.value || null })}
            aria-label="Filtrar por projeto"
            className="px-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink shrink-0"
          >
            <option value="">Todos projetos</option>
            {projectIds.map((pid) => (
              <option key={pid} value={pid}>
                Projeto {pid.slice(0, 6)}
              </option>
            ))}
          </select>
        </div>
      </CollectionToolbar>

      <SectionTitle title={`Tarefas operacionais (${filtered.length} de ${issues.length})`} />

      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {filtered.map((issue) => (
          <div
            key={issue.id}
            role="button"
            tabIndex={0}
            onClick={() => openIssue(issue.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openIssue(issue.id);
              }
            }}
            className="p-4 cursor-pointer transition-colors hover:bg-surface-blue/30"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-accent dark:text-cyan-300 text-[10px] truncate">
                  {issue.identifier || issue.id}
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-ink truncate">{issue.title}</div>
                  <div className="text-[10px] text-ink-subtle truncate">
                    {issue.assigneeAgentName || 'Não atribuída'} · {issue.projectName || 'Sem projeto'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusBadge status={issue.status} size="sm" />
                {issue.priority && (
                  <span className="font-mono text-[10px] border border-line-strong rounded px-1.5 py-0.5 text-ink-subtle">
                    {issue.priority}
                  </span>
                )}
              </div>
            </div>
            {issue.description && (
              <p className="mt-1.5 text-[11px] text-ink-muted line-clamp-1">{issue.description}</p>
            )}
            {(issue.blockedByIssueIds?.length || 0) > 0 && (
              <div className="mt-2 text-[10px] text-ink-subtle inline-flex items-center gap-1">
                <Pause className="w-3 h-3" /> <span>Bloqueada por {issue.blockedByIssueIds?.length ?? 0} issue(s)</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
