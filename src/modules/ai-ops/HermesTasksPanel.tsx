import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  FileText,
  GitBranch,
  Layers,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Workflow,
} from 'lucide-react';
import { SegmentedTabs, SlideDrawer, StatusText } from '../../components/ui/Primitives';
import {
  formatCents,
  formatDateTimeBR,
  HermesApi,
  PlatformApi,
} from '../../services/api';
import type {
  HermesIntegrationStatus,
  NavSectionId,
  HermesBotDto,
  HermesTaskDto,
  HermesProjectDto,
} from '../../types/platform';
import { HermesStatusPanel } from './HermesStatusPanel';

interface HermesTasksPanelProps {
  status: HermesIntegrationStatus;
  agents: HermesBotDto[];
  projects: HermesProjectDto[];
  initialTaskId?: string | null;
  onNavigate: (sec: NavSectionId) => void;
  onRefreshAll: () => Promise<void>;
  onToast: (msg: string) => void;
}

const STATUS_OPTIONS = [
  { id: 'all', label: 'Todos status' },
  { id: 'todo', label: 'Na Fila (todo)' },
  { id: 'in_progress', label: 'Em Execução' },
  { id: 'in_review', label: 'Em Revisão' },
  { id: 'blocked', label: 'Bloqueadas' },
  { id: 'done', label: 'Concluídas' },
  { id: 'cancelled', label: 'Canceladas' },
];

export const HermesTasksPanel: React.FC<HermesTasksPanelProps> = ({
  status,
  agents,
  projects,
  initialTaskId,
  onNavigate,
  onRefreshAll,
  onToast,
}) => {
  const [viewMode, setViewMode] = useState<'cartoes' | 'kanban' | 'lista' | 'hierarquia'>('cartoes');
  const [tasks, setTasks] = useState<HermesTaskDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTaskId || null);
  const [drawerTab, setDrawerTab] = useState<'detalhes' | 'comentarios' | 'execucoes'>('detalhes');
  const [taskDetail, setTaskDetail] = useState<HermesTaskDto | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status: 'todo' as string,
    priority: 'medium' as string,
    assigneeAgentId: '',
    projectId: '',
    parentId: '',
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isConnected = status.configured && status.connected;

  const loadTasks = useCallback(async () => {
    if (!isConnected) {
      setTasks([]);
      return;
    }
    setLoading(true);
    try {
      const res = await HermesApi.listTasks();
      const all = res.tasks || [];
      setTasks(
        all.filter((t) => {
          if (statusFilter !== 'all' && t.status !== statusFilter) return false;
          if (agentFilter !== 'all' && t.assigneeAgentId !== agentFilter) return false;
          if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
          if (queryText.trim()) {
            const q = queryText.trim().toLowerCase();
            return t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
          }
          return true;
        }),
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao consultar tarefas no Hermes.');
    } finally {
      setLoading(false);
    }
  }, [isConnected, statusFilter, agentFilter, projectFilter, queryText, onToast]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (initialTaskId) {
      setSelectedTaskId(initialTaskId);
    }
  }, [initialTaskId]);

  const issueStatusTone = (st: string) => {
    const s = st.toLowerCase();
    if (s === 'done' || s === 'completed') return 'nominal' as const;
    if (s === 'blocked' || s === 'cancelled') return 'critical' as const;
    if (s === 'in_progress' || s === 'in_review') return 'attention' as const;
    return 'neutral' as const;
  };

  const handlePatchTask = async (taskId: string, patch: Record<string, unknown>) => {
    try {
      await HermesApi.updateTask(taskId, patch);
      await loadTasks();
      if (selectedTaskId === taskId) {
        setTaskDetail((prev) => (prev?.id === taskId ? { ...prev, ...patch } : prev));
      }
      await onRefreshAll();
      onToast('Tarefa atualizada no Hermes.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Hermes recusou a atualização da tarefa.');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    try {
      await HermesApi.createTask({
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        status: newTask.status,
        priority: newTask.priority,
        assigneeAgentId: newTask.assigneeAgentId || undefined,
        projectId: newTask.projectId || undefined,
        parentId: newTask.parentId || undefined,
      });
      setCreateOpen(false);
      setNewTask({ title: '', description: '', status: 'todo', priority: 'medium', assigneeAgentId: '', projectId: '', parentId: '' });
      await loadTasks();
      await onRefreshAll();
      onToast('Tarefa criada na fila oficial do Hermes.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao criar tarefa no Hermes.');
    }
  };

  const hierarchyRoots = useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    return tasks.filter((t) => !t.parentId || !byId.has(t.parentId));
  }, [tasks]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, HermesTaskDto[]>();
    for (const t of tasks) {
      if (t.parentId) {
        const list = map.get(t.parentId) || [];
        list.push(t);
        map.set(t.parentId, list);
      }
    }
    return map;
  }, [tasks]);

  if (!isConnected) {
    return (
      <HermesStatusPanel
        status={status}
        title="Tarefas & Delegações (Hermes)"
        requiredCapabilities={['tasks:read', 'tasks:write']}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Filter & View Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Buscar por título ou identificador..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrar por status"
            className="px-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>

          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            aria-label="Filtrar por agente"
            className="px-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
          >
            <option value="all">Todos agentes</option>
            {agents.map((ag) => (
              <option key={ag.id} value={ag.id}>{ag.name}</option>
            ))}
          </select>

          {projects.length > 0 && (
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              aria-label="Filtrar por projeto"
              className="px-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
            >
              <option value="all">Todos projetos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <SegmentedTabs
            active={viewMode}
            onChange={setViewMode}
            tabs={[
              { id: 'cartoes', label: 'Cartões', count: tasks.length },
              { id: 'kanban', label: 'Kanban' },
              { id: 'lista', label: 'Lista' },
              { id: 'hierarquia', label: 'Hierarquia' },
            ]}
          />
          <button
            type="button"
            onClick={loadTasks}
            disabled={loading}
            className="p-2 rounded-lg border border-line-strong bg-surface text-ink-muted hover:text-ink cursor-pointer"
            title="Atualizar tarefas"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="nc-primary-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Task</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {tasks.length === 0 && !loading ? (
        <div className="nc-card rounded-2xl p-10 text-center space-y-2">
          <Workflow className="w-6 h-6 text-accent dark:text-cyan-300 mx-auto" />
          <div className="font-display text-base font-semibold text-ink">
            Nenhuma tarefa encontrada no Hermes para os filtros atuais
          </div>
          <p className="text-xs text-ink-subtle">
            Crie uma nova delegação oficial ou ajuste os filtros acima.
          </p>
        </div>
      ) : viewMode === 'cartoes' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map((t) => (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedTaskId(t.id);
                setDrawerTab('detalhes');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedTaskId(t.id);
                }
              }}
              className={`nc-card rounded-2xl p-5 text-left cursor-pointer flex flex-col justify-between gap-4 ${
                selectedTaskId === t.id ? 'nc-card-active' : ''
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-accent dark:text-cyan-300">
                    {t.id.slice(0, 8)}
                    {t.priority ? ` · ${t.priority}` : ''}
                  </span>
                  <StatusText label={t.status} tone={issueStatusTone(t.status)} />
                </div>

                <div>
                  <h3 className="font-display text-base font-semibold text-ink leading-snug">
                    {t.title}
                  </h3>
                  {t.projectName && (
                    <p className="text-xs text-ink-subtle mt-1 truncate">{t.projectName}</p>
                  )}
                  {t.description && (
                    <p className="text-xs text-ink-muted line-clamp-2">{t.description}</p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-medium text-ink truncate">
                    {t.assigneeAgentName || 'Sem agente atribuído'}
                  </div>
                  <div className="font-mono text-[11px] text-ink-subtle">
                    Atualizada {formatDateTimeBR(t.updatedAt || t.createdAt || '')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { key: 'todo', title: 'Na Fila / Backlog', match: ['backlog', 'todo'] },
            { key: 'in_progress', title: 'Em Execução / Revisão', match: ['in_progress', 'in_review'] },
            { key: 'blocked', title: 'Bloqueadas', match: ['blocked'] },
            { key: 'done', title: 'Concluídas', match: ['done', 'completed'] },
          ].map((col) => {
            const colTasks = tasks.filter((t) => col.match.includes(t.status.toLowerCase()));
            return (
              <div key={col.key} className="nc-card rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <span className="font-display text-xs font-semibold text-ink">{col.title}</span>
                  <span className="font-mono text-xs text-highlight font-semibold">{colTasks.length}</span>
                </div>
                <div className="space-y-2.5">
                  {colTasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTaskId(t.id)}
                      className="w-full p-3 rounded-xl bg-surface-subtle/50 hover:bg-surface-blue/50 border border-line text-left space-y-1.5 cursor-pointer"
                    >
                      <div className="font-mono text-[11px] text-accent dark:text-cyan-300">
                        {t.id.slice(0, 8)}
                      </div>
                      <div className="text-xs font-semibold text-ink line-clamp-2">{t.title}</div>
                      <div className="text-[11px] text-ink-subtle truncate">
                        {t.assigneeAgentName || 'Sem agente'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'hierarquia' ? (
        <div className="nc-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs text-ink-subtle pb-3 border-b border-line">
            <GitBranch className="w-4 h-4 text-accent dark:text-cyan-300" />
            <span>Árvore de sub-tarefas (parentId)</span>
          </div>
          <div className="space-y-3">
            {hierarchyRoots.map((root) => {
              const kids = childrenMap.get(root.id) || [];
              return (
                <div key={root.id} className="rounded-xl border border-line p-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId(root.id)}
                    className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <div>
                      <span className="font-mono text-xs text-accent dark:text-cyan-300 mr-2">
                        {root.id.slice(0, 8)}
                      </span>
                      <span className="text-sm font-semibold text-ink">{root.title}</span>
                    </div>
                    <StatusText label={root.status} tone={issueStatusTone(root.status)} />
                  </button>
                  {kids.length > 0 && (
                    <div className="pl-5 border-l border-line space-y-2 pt-2">
                      {kids.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => setSelectedTaskId(child.id)}
                          className="w-full flex items-center justify-between gap-3 text-left p-2 rounded-lg hover:bg-surface-blue/40 cursor-pointer"
                        >
                          <div className="text-xs text-ink">
                            <span className="font-mono text-ink-subtle mr-1.5">
                              {child.id.slice(0, 8)}
                            </span>
                            {child.title}
                          </div>
                          <StatusText label={child.status} tone={issueStatusTone(child.status)} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <section className="rounded-2xl nc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-[11px] font-semibold text-ink-subtle bg-surface-subtle/40">
                  <th className="py-3 px-6">Identificador</th>
                  <th className="py-3 px-4">Título</th>
                  <th className="py-3 px-4">Agente</th>
                  <th className="py-3 px-4">Prioridade</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-6 text-right">Atualizada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {tasks.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    className="hover:bg-surface-blue/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-6 font-mono text-xs text-accent dark:text-cyan-300 whitespace-nowrap">
                      {t.id.slice(0, 8)}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-ink">{t.title}</td>
                    <td className="py-3.5 px-4 text-xs text-ink-muted">
                      {t.assigneeAgentName || 'Não atribuído'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-highlight">{t.priority || '—'}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusText label={t.status} tone={issueStatusTone(t.status)} />
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-xs text-ink-subtle whitespace-nowrap">
                      {formatDateTimeBR(t.updatedAt || t.createdAt || '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TASK DETAIL DRAWER */}
      <SlideDrawer
        open={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
        wide
        title={taskDetail?.title || 'Detalhes da Tarefa'}
        subtitle={
          taskDetail
            ? `${taskDetail.id.slice(0, 8)} · ${taskDetail.projectName || 'Projeto' || '—'}`
            : undefined
        }
      >
        {taskDetail && (
          <div className="space-y-5">
            <SegmentedTabs
              active={drawerTab}
              onChange={setDrawerTab}
              tabs={[
                { id: 'detalhes', label: 'Detalhes & Delegação' },
                { id: 'comentarios', label: 'Comentários', count: 0 },
                { id: 'execucoes', label: 'Execuções', count: 0 },
              ]}
            />

            {drawerTab === 'detalhes' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-ink-subtle mb-1">Status oficial</label>
                    <select
                      value={taskDetail.status}
                      onChange={(e) =>
                        handlePatchTask(taskDetail.id, { status: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-xs font-semibold text-ink"
                    >
                      <option value="backlog">backlog</option>
                      <option value="todo">todo</option>
                      <option value="in_progress">in_progress</option>
                      <option value="in_review">in_review</option>
                      <option value="blocked">blocked</option>
                      <option value="done">done</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-ink-subtle mb-1">Prioridade</label>
                    <select
                      value={taskDetail.priority || 'medium'}
                      onChange={(e) =>
                        handlePatchTask(taskDetail.id, { priority: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-xs font-semibold text-ink"
                    >
                      <option value="urgent">urgent</option>
                      <option value="high">high</option>
                      <option value="medium">medium</option>
                      <option value="low">low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-ink-subtle mb-1">
                      Atribuir / Delegar para Agente
                    </label>
                    <select
                      value={taskDetail.assigneeAgentId || ''}
                      onChange={(e) =>
                        handlePatchTask(taskDetail.id, {
                          assigneeAgentId: e.target.value || null,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-xs font-semibold text-ink"
                    >
                      <option value="">Sem agente atribuído</option>
                      {agents.map((ag) => (
                        <option key={ag.id} value={ag.id}>
                          {ag.name} ({ag.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {taskDetail.description && (
                  <div className="p-4 rounded-xl bg-surface-subtle/50 border border-line text-sm text-ink-muted whitespace-pre-wrap">
                    {taskDetail.description}
                  </div>
                )}

                {taskDetail.parentId && (
                  <div className="p-3 rounded-xl bg-surface-subtle/40 border border-line text-xs flex items-center justify-between gap-2">
                    <span className="text-ink-subtle">Sub-tarefa vinculada a:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(taskDetail.parentId!)}
                      className="font-mono font-semibold text-accent dark:text-cyan-300 hover:underline cursor-pointer"
                    >
                      {tasks.find((i) => i.id === taskDetail.parentId)?.title || taskDetail.parentId}
                    </button>
                  </div>
                )}

                {(childrenMap.get(taskDetail.id) || []).length > 0 && (
                  <div className="p-3.5 rounded-xl border border-line space-y-2">
                    <div className="text-xs font-semibold text-ink-subtle">
                      Sub-tarefas vinculadas ({(childrenMap.get(taskDetail.id) || []).length})
                    </div>
                    <div className="space-y-1.5">
                      {(childrenMap.get(taskDetail.id) || []).map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => setSelectedTaskId(child.id)}
                          className="w-full flex items-center justify-between gap-3 text-left p-2 rounded-lg hover:bg-surface-blue/40 cursor-pointer"
                        >
                          <div className="text-xs text-ink">
                            <span className="font-mono text-accent dark:text-cyan-300 mr-1.5">
                              {child.id.slice(0, 8)}
                            </span>
                            {child.title}
                          </div>
                          <StatusText label={child.status} tone={issueStatusTone(child.status)} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SlideDrawer>

      {/* CREATE TASK DRAWER */}
      <SlideDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Criar Tarefa no Hermes"
        subtitle="A delegação oficial utiliza a fila real de tarefas do Hermes"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Título</label>
            <input
              type="text"
              required
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="Ex.: Revisar métricas de SLA da semana"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">
                Agente responsável
              </label>
              <select
                value={newTask.assigneeAgentId}
                onChange={(e) =>
                  setNewTask({ ...newTask, assigneeAgentId: e.target.value })
                }
                className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-xs text-ink"
              >
                <option value="">Sem atribuição imediata</option>
                {agents.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.name} ({ag.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">
                Prioridade
              </label>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-xs text-ink"
              >
                <option value="urgent">urgent</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </div>
          </div>

          {projects.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">
                Projeto
              </label>
              <select
                value={newTask.projectId}
                onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-xs text-ink"
              >
                <option value="">Nenhum</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {tasks.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">
                Tarefa pai (opcional, para sub-tarefa)
              </label>
              <select
                value={newTask.parentId}
                onChange={(e) => setNewTask({ ...newTask, parentId: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-xs text-ink"
              >
                <option value="">Nenhuma (tarefa raiz)</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Descrição</label>
            <textarea
              rows={3}
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-lg border border-line-strong text-xs text-ink-muted cursor-pointer"
            >
              Cancelar
            </button>
            <button type="submit" disabled={!newTask.title.trim()} className="nc-primary-btn px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer">
              Criar no Hermes
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
};
