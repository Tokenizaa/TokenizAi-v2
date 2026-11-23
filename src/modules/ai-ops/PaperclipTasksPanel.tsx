import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  FileText,
  GitBranch,
  Layers,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Workflow,
} from 'lucide-react';
import { SegmentedTabs, SlideDrawer, StatusText } from '../../components/ui/Primitives';
import { formatCents, formatDateTimeBR, PaperclipApi } from '../../services/api';
import type {
  NavSectionId,
  PaperclipAgentDto,
  PaperclipAttachmentDto,
  PaperclipCommentDto,
  PaperclipGoalDto,
  PaperclipIntegrationStatus,
  PaperclipIssueDto,
  PaperclipProjectDto,
  PaperclipRunDto,
} from '../../types/platform';
import { PaperclipStatusPanel } from './PaperclipStatusPanel';

interface PaperclipTasksPanelProps {
  status: PaperclipIntegrationStatus;
  agents: PaperclipAgentDto[];
  projects: PaperclipProjectDto[];
  goals: PaperclipGoalDto[];
  initialIssueId?: string | null;
  onNavigate: (sec: NavSectionId) => void;
  onRefreshAll: () => Promise<void>;
  onToast: (msg: string) => void;
}

const STATUS_OPTIONS = [
  { id: 'all', label: 'Todos status' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'Na Fila (todo)' },
  { id: 'in_progress', label: 'Em Execução' },
  { id: 'in_review', label: 'Em Revisão' },
  { id: 'blocked', label: 'Bloqueadas' },
  { id: 'done', label: 'Concluídas' },
  { id: 'cancelled', label: 'Canceladas' },
];

export const PaperclipTasksPanel: React.FC<PaperclipTasksPanelProps> = ({
  status,
  agents,
  projects,
  goals,
  initialIssueId,
  onNavigate,
  onRefreshAll,
  onToast,
}) => {
  const [viewMode, setViewMode] = useState<'cartoes' | 'kanban' | 'lista' | 'hierarquia'>('cartoes');
  const [issues, setIssues] = useState<PaperclipIssueDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(initialIssueId || null);
  const [drawerTab, setDrawerTab] = useState<'detalhes' | 'comentarios' | 'execucoes' | 'documentos' | 'interacoes'>('detalhes');
  const [issueDetail, setIssueDetail] = useState<PaperclipIssueDto | null>(null);
  const [comments, setComments] = useState<PaperclipCommentDto[]>([]);
  const [issueRuns, setIssueRuns] = useState<PaperclipRunDto[]>([]);
  const [documents, setDocuments] = useState<Array<Record<string, unknown>>>([]);
  const [attachments, setAttachments] = useState<PaperclipAttachmentDto[]>([]);
  const [interactions, setInteractions] = useState<Array<Record<string, unknown>>>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newIssue, setNewIssue] = useState({
    title: '',
    description: '',
    assigneeAgentId: '',
    projectId: '',
    goalId: '',
    parentId: '',
    priority: 'medium',
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isConnected =
    status.configured && status.reachable && status.authenticated && Boolean(status.companyId);

  const loadIssues = useCallback(async () => {
    if (!isConnected) {
      setIssues([]);
      return;
    }
    setLoading(true);
    try {
      const res = await PaperclipApi.listIssues({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        assigneeAgentId: agentFilter !== 'all' ? agentFilter : undefined,
        projectId: projectFilter !== 'all' ? projectFilter : undefined,
        q: queryText.trim() || undefined,
        limit: 100,
      });
      setIssues(res.issues || []);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao consultar issues no Paperclip.');
    } finally {
      setLoading(false);
    }
  }, [isConnected, statusFilter, agentFilter, projectFilter, queryText, onToast]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  useEffect(() => {
    if (initialIssueId) {
      setSelectedIssueId(initialIssueId);
    }
  }, [initialIssueId]);

  const loadIssueExtras = useCallback(
    async (issueId: string) => {
      if (!isConnected) return;
      const [detRes, cmtRes, runsRes, docsRes, attRes, intRes] = await Promise.allSettled([
        PaperclipApi.getIssue(issueId),
        PaperclipApi.getIssueComments(issueId),
        PaperclipApi.getIssueRuns(issueId),
        PaperclipApi.getIssueDocuments(issueId),
        PaperclipApi.getIssueAttachments(issueId),
        PaperclipApi.getIssueInteractions(issueId),
      ]);

      if (detRes.status === 'fulfilled') setIssueDetail(detRes.value.issue);
      if (cmtRes.status === 'fulfilled') setComments(cmtRes.value.comments || []);
      if (runsRes.status === 'fulfilled') setIssueRuns(runsRes.value.runs || []);
      if (docsRes.status === 'fulfilled') setDocuments(docsRes.value.documents || []);
      if (attRes.status === 'fulfilled') setAttachments(attRes.value.attachments || []);
      if (intRes.status === 'fulfilled') setInteractions(intRes.value.interactions || []);
    },
    [isConnected],
  );

  useEffect(() => {
    if (selectedIssueId) {
      loadIssueExtras(selectedIssueId);
    } else {
      setIssueDetail(null);
    }
  }, [selectedIssueId, loadIssueExtras]);

  const issueStatusTone = (st: string) => {
    const s = st.toLowerCase();
    if (s === 'done' || s === 'completed') return 'nominal' as const;
    if (s === 'blocked' || s === 'cancelled') return 'critical' as const;
    if (s === 'in_progress' || s === 'in_review') return 'attention' as const;
    return 'neutral' as const;
  };

  const handlePatchIssue = async (issueId: string, patch: Record<string, unknown>) => {
    setBusyId(issueId);
    try {
      await PaperclipApi.updateIssue(issueId, patch);
      await loadIssues();
      if (selectedIssueId === issueId) {
        await loadIssueExtras(issueId);
      }
      await onRefreshAll();
      onToast('Tarefa atualizada no Paperclip.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Paperclip recusou a atualização da tarefa.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssue.title.trim()) return;
    setBusyId('create');
    try {
      await PaperclipApi.createIssue({
        title: newIssue.title.trim(),
        description: newIssue.description.trim() || undefined,
        assigneeAgentId: newIssue.assigneeAgentId || undefined,
        projectId: newIssue.projectId || undefined,
        goalId: newIssue.goalId || undefined,
        parentId: newIssue.parentId || undefined,
        priority: newIssue.priority,
      });
      setCreateOpen(false);
      setNewIssue({
        title: '',
        description: '',
        assigneeAgentId: '',
        projectId: '',
        goalId: '',
        parentId: '',
        priority: 'medium',
      });
      await loadIssues();
      await onRefreshAll();
      onToast('Tarefa criada na fila oficial do Paperclip.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao criar tarefa no Paperclip.');
    } finally {
      setBusyId(null);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssueId || !commentDraft.trim()) return;
    setBusyId('comment');
    try {
      await PaperclipApi.addIssueComment(selectedIssueId, commentDraft.trim());
      setCommentDraft('');
      await loadIssueExtras(selectedIssueId);
      onToast('Comentário enviado para a issue.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao publicar comentário.');
    } finally {
      setBusyId(null);
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedIssueId) return;
    if (file.size > 4 * 1024 * 1024) {
      onToast('Arquivo excede o limite de 4 MB.');
      return;
    }
    setBusyId('upload');
    try {
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const raw = String(reader.result || '');
          const idx = raw.indexOf(',');
          resolve(idx >= 0 ? raw.slice(idx + 1) : raw);
        };
        reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
        reader.readAsDataURL(file);
      });
      await PaperclipApi.uploadIssueAttachment(selectedIssueId, {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        base64Content,
      });
      await loadIssueExtras(selectedIssueId);
      onToast(`Anexo "${file.name}" enviado.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao enviar anexo.');
    } finally {
      setBusyId(null);
    }
  };

  const hierarchyRoots = useMemo(() => {
    const byId = new Map(issues.map((i) => [i.id, i]));
    return issues.filter((i) => !i.parentId || !byId.has(i.parentId));
  }, [issues]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, PaperclipIssueDto[]>();
    for (const iss of issues) {
      if (iss.parentId) {
        const list = map.get(iss.parentId) || [];
        list.push(iss);
        map.set(iss.parentId, list);
      }
    }
    return map;
  }, [issues]);

  if (!isConnected) {
    return (
      <PaperclipStatusPanel
        status={status}
        title="Tasks & Delegações (Issues Paperclip)"
        requiredCapabilities={['issues:read', 'issues:write']}
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
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
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
              <option key={ag.id} value={ag.id}>
                {ag.name}
              </option>
            ))}
          </select>

          {projects.length > 0 && (
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              aria-label="Filtrar por projeto Paperclip"
              className="px-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
            >
              <option value="all">Todos projetos Paperclip</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <SegmentedTabs
            active={viewMode}
            onChange={setViewMode}
            tabs={[
              { id: 'cartoes', label: 'Cartões', count: issues.length },
              { id: 'kanban', label: 'Kanban' },
              { id: 'lista', label: 'Lista' },
              { id: 'hierarquia', label: 'Hierarquia' },
            ]}
          />
          <button
            type="button"
            onClick={loadIssues}
            disabled={loading}
            className="p-2 rounded-lg border border-line-strong bg-surface text-ink-muted hover:text-ink cursor-pointer"
            title="Atualizar issues"
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
      {issues.length === 0 && !loading ? (
        <div className="nc-card rounded-2xl p-10 text-center space-y-2">
          <Workflow className="w-6 h-6 text-accent dark:text-cyan-300 mx-auto" />
          <div className="font-display text-base font-semibold text-ink">
            Nenhuma issue encontrada no Paperclip para os filtros atuais
          </div>
          <p className="text-xs text-ink-subtle">
            Crie uma nova delegação oficial ou ajuste os filtros acima.
          </p>
        </div>
      ) : viewMode === 'cartoes' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {issues.map((iss) => (
            <div
              key={iss.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedIssueId(iss.id);
                setDrawerTab('detalhes');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedIssueId(iss.id);
                }
              }}
              className={`nc-card rounded-2xl p-5 text-left cursor-pointer flex flex-col justify-between gap-4 ${
                selectedIssueId === iss.id ? 'nc-card-active' : ''
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-accent dark:text-cyan-300">
                    {iss.identifier || iss.id.slice(0, 8)}
                    {iss.priority ? ` · ${iss.priority}` : ''}
                  </span>
                  <StatusText label={iss.status} tone={issueStatusTone(iss.status)} />
                </div>

                <div>
                  <h3 className="font-display text-base font-semibold text-ink leading-snug">
                    {iss.title}
                  </h3>
                  {iss.projectName && (
                    <p className="text-xs text-ink-subtle mt-1 truncate">{iss.projectName}</p>
                  )}
                </div>

                {iss.unresolvedBlockerCount && iss.unresolvedBlockerCount > 0 ? (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{iss.unresolvedBlockerCount} bloqueio(s) pendente(s)</span>
                  </div>
                ) : (
                  iss.description && (
                    <p className="text-xs text-ink-muted line-clamp-2">{iss.description}</p>
                  )
                )}
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-medium text-ink truncate">
                    {iss.assigneeAgentName || 'Sem agente atribuído'}
                  </div>
                  <div className="font-mono text-[11px] text-ink-subtle">
                    Atualizada {formatDateTimeBR(iss.updatedAt || iss.createdAt)}
                  </div>
                </div>
                {iss.activeRun && (
                  <span className="font-mono text-[11px] font-semibold text-highlight shrink-0">
                    Execução ativa
                  </span>
                )}
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
            const colIssues = issues.filter((i) => col.match.includes(i.status.toLowerCase()));
            return (
              <div key={col.key} className="nc-card rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <span className="font-display text-xs font-semibold text-ink">{col.title}</span>
                  <span className="font-mono text-xs text-highlight font-semibold">{colIssues.length}</span>
                </div>
                <div className="space-y-2.5">
                  {colIssues.map((iss) => (
                    <button
                      key={iss.id}
                      type="button"
                      onClick={() => setSelectedIssueId(iss.id)}
                      className="w-full p-3 rounded-xl bg-surface-subtle/50 hover:bg-surface-blue/50 border border-line text-left space-y-1.5 cursor-pointer"
                    >
                      <div className="font-mono text-[11px] text-accent dark:text-cyan-300">
                        {iss.identifier || iss.id.slice(0, 8)}
                      </div>
                      <div className="text-xs font-semibold text-ink line-clamp-2">{iss.title}</div>
                      <div className="text-[11px] text-ink-subtle truncate">
                        {iss.assigneeAgentName || 'Sem agente'}
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
            <span>Árvore de sub-issues (parentId) e dependências bloqueadoras (blockedByIssueIds)</span>
          </div>
          <div className="space-y-3">
            {hierarchyRoots.map((root) => {
              const kids = childrenMap.get(root.id) || [];
              return (
                <div key={root.id} className="rounded-xl border border-line p-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => setSelectedIssueId(root.id)}
                    className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <div>
                      <span className="font-mono text-xs text-accent dark:text-cyan-300 mr-2">
                        {root.identifier || root.id.slice(0, 8)}
                      </span>
                      <span className="text-sm font-semibold text-ink">{root.title}</span>
                    </div>
                    <StatusText label={root.status} tone={issueStatusTone(root.status)} />
                  </button>
                  {root.blockedByIssueIds && root.blockedByIssueIds.length > 0 && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-300">
                      Bloqueada por: {root.blockedByIssueIds.join(', ')}
                    </div>
                  )}
                  {kids.length > 0 && (
                    <div className="pl-5 border-l border-line space-y-2 pt-2">
                      {kids.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => setSelectedIssueId(child.id)}
                          className="w-full flex items-center justify-between gap-3 text-left p-2 rounded-lg hover:bg-surface-blue/40 cursor-pointer"
                        >
                          <div className="text-xs text-ink">
                            <span className="font-mono text-ink-subtle mr-1.5">
                              {child.identifier || child.id.slice(0, 8)}
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
                {issues.map((iss) => (
                  <tr
                    key={iss.id}
                    onClick={() => setSelectedIssueId(iss.id)}
                    className="hover:bg-surface-blue/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-6 font-mono text-xs text-accent dark:text-cyan-300 whitespace-nowrap">
                      {iss.identifier || iss.id.slice(0, 8)}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-ink">{iss.title}</td>
                    <td className="py-3.5 px-4 text-xs text-ink-muted">
                      {iss.assigneeAgentName || 'Não atribuído'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-highlight">{iss.priority || '—'}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusText label={iss.status} tone={issueStatusTone(iss.status)} />
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-xs text-ink-subtle whitespace-nowrap">
                      {formatDateTimeBR(iss.updatedAt || iss.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ISSUE DETAIL DRAWER */}
      <SlideDrawer
        open={Boolean(selectedIssueId)}
        onClose={() => setSelectedIssueId(null)}
        wide
        title={issueDetail?.title || 'Detalhes da Issue'}
        subtitle={issueDetail ? `${issueDetail.identifier || issueDetail.id} · ${issueDetail.projectName || 'Paperclip'}` : undefined}
      >
        {issueDetail && (
          <div className="space-y-5">
            <SegmentedTabs
              active={drawerTab}
              onChange={setDrawerTab}
              tabs={[
                { id: 'detalhes', label: 'Detalhes & Delegação' },
                { id: 'comentarios', label: 'Comentários', count: comments.length },
                { id: 'execucoes', label: 'Execuções', count: issueRuns.length },
                { id: 'documentos', label: 'Docs & Anexos', count: documents.length + attachments.length },
                { id: 'interacoes', label: 'Interações', count: interactions.length },
              ]}
            />

            {drawerTab === 'detalhes' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-ink-subtle mb-1">Status oficial</label>
                    <select
                      value={issueDetail.status}
                      disabled={busyId === issueDetail.id}
                      onChange={(e) => handlePatchIssue(issueDetail.id, { status: e.target.value })}
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
                      value={issueDetail.priority || 'medium'}
                      disabled={busyId === issueDetail.id}
                      onChange={(e) => handlePatchIssue(issueDetail.id, { priority: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-xs font-semibold text-ink"
                    >
                      <option value="urgent">urgent</option>
                      <option value="high">high</option>
                      <option value="medium">medium</option>
                      <option value="low">low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-ink-subtle mb-1">Atribuir / Delegar para Agente</label>
                    <select
                      value={issueDetail.assigneeAgentId || ''}
                      disabled={busyId === issueDetail.id}
                      onChange={(e) =>
                        handlePatchIssue(issueDetail.id, { assigneeAgentId: e.target.value || null })
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

                {issueDetail.description && (
                  <div className="p-4 rounded-xl bg-surface-subtle/50 border border-line text-sm text-ink-muted whitespace-pre-wrap">
                    {issueDetail.description}
                  </div>
                )}

                {issueDetail.parentId && (
                  <div className="p-3 rounded-xl bg-surface-subtle/40 border border-line text-xs flex items-center justify-between gap-2">
                    <span className="text-ink-subtle">Sub-issue vinculada a:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedIssueId(issueDetail.parentId!)}
                      className="font-mono font-semibold text-accent dark:text-cyan-300 hover:underline cursor-pointer"
                    >
                      {issues.find((i) => i.id === issueDetail.parentId)?.identifier || issueDetail.parentId}
                    </button>
                  </div>
                )}

                {(childrenMap.get(issueDetail.id) || []).length > 0 && (
                  <div className="p-3.5 rounded-xl border border-line space-y-2">
                    <div className="text-xs font-semibold text-ink-subtle">
                      Sub-issues vinculadas ({(childrenMap.get(issueDetail.id) || []).length})
                    </div>
                    <div className="space-y-1.5">
                      {(childrenMap.get(issueDetail.id) || []).map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => setSelectedIssueId(child.id)}
                          className="w-full flex items-center justify-between gap-2 text-left text-xs p-2 rounded-lg hover:bg-surface-blue/40 cursor-pointer"
                        >
                          <span className="truncate text-ink">
                            <span className="font-mono text-accent dark:text-cyan-300 mr-1.5">
                              {child.identifier || child.id.slice(0, 8)}
                            </span>
                            {child.title}
                          </span>
                          <StatusText label={child.status} tone={issueStatusTone(child.status)} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {issueDetail.blockedByIssueIds && issueDetail.blockedByIssueIds.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-ink">
                    <strong>Bloqueada pelas issues:</strong> {issueDetail.blockedByIssueIds.join(', ')}
                  </div>
                )}
              </div>
            )}

            {drawerTab === 'comentarios' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-surface-subtle/50 border border-line text-[11px] text-ink-subtle">
                  Nota operacional: mencionar <span className="font-mono">@agente</span> em comentários não garante despertar automático; utilize a atribuição oficial ou <span className="font-mono">Wakeup</span> para delegar.
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {comments.map((c) => (
                    <div key={c.id} className="p-3.5 rounded-xl border border-line bg-surface-subtle/35 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-ink">{c.authorName}</span>
                        <span className="font-mono text-ink-subtle">{formatDateTimeBR(c.createdAt)}</span>
                      </div>
                      <p className="text-xs text-ink-muted whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <div className="text-xs text-ink-subtle text-center py-4">Nenhum comentário registrado.</div>
                  )}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder="Adicionar comentário nesta issue..."
                    className="flex-1 px-3 py-2 rounded-lg border border-line-strong bg-canvas text-xs text-ink"
                  />
                  <button
                    type="submit"
                    disabled={busyId === 'comment' || !commentDraft.trim()}
                    className="nc-primary-btn px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar</span>
                  </button>
                </form>
              </div>
            )}

            {drawerTab === 'execucoes' && (
              <div className="divide-y divide-line border border-line rounded-xl">
                {issueRuns.map((r, idx) => (
                  <div key={r.id || idx} className="p-3.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-ink">{r.id}</span>
                      <StatusText
                        label={r.status}
                        tone={
                          r.status === 'succeeded' || r.status === 'completed'
                            ? 'nominal'
                            : r.status === 'failed' || r.status === 'error'
                              ? 'critical'
                              : 'attention'
                        }
                      />
                    </div>
                    {r.resultSummary && <div className="text-ink-muted">{r.resultSummary}</div>}
                    {r.errorMessage && (
                      <div className="text-red-700 dark:text-red-300">{r.errorMessage}</div>
                    )}
                    <div className="flex flex-wrap gap-3 font-mono text-[11px] text-ink-subtle">
                      {r.startedAt && <span>Início: {formatDateTimeBR(r.startedAt)}</span>}
                      {r.model && <span>Modelo: {r.model}</span>}
                      {typeof r.durationMs === 'number' && (
                        <span>{(r.durationMs / 1000).toFixed(1)}s</span>
                      )}
                      {typeof r.costCents === 'number' && (
                        <span>{formatCents(r.costCents, r.currency)}</span>
                      )}
                    </div>
                  </div>
                ))}
                {issueRuns.length === 0 && (
                  <div className="p-4 text-xs text-ink-subtle text-center">Nenhuma execução vinculada a esta issue.</div>
                )}
              </div>
            )}

            {drawerTab === 'documentos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-ink-subtle inline-flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Documentos & Anexos</span>
                  </h4>
                  <div>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleUploadAttachment} />
                    <button
                      type="button"
                      disabled={busyId === 'upload'}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>Anexar arquivo</span>
                    </button>
                  </div>
                </div>

                {attachments.length > 0 && (
                  <div className="space-y-2">
                    {attachments.map((att) => (
                      <a
                        key={att.id}
                        href={PaperclipApi.getAttachmentContentUrl(att.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl border border-line hover:bg-surface-blue/40 text-xs"
                      >
                        <span className="font-medium text-accent dark:text-cyan-300">{att.filename}</span>
                        <span className="font-mono text-ink-subtle">{att.contentType || 'arquivo'}</span>
                      </a>
                    ))}
                  </div>
                )}

                {documents.length > 0 && (
                  <div className="space-y-2">
                    {documents.map((doc, idx) => (
                      <div key={String(doc.id || idx)} className="p-3 rounded-xl border border-line text-xs">
                        <div className="font-semibold text-ink">{String(doc.title || doc.name || 'Documento')}</div>
                        {Boolean(doc.summary) && <div className="text-ink-muted mt-1">{String(doc.summary)}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {attachments.length === 0 && documents.length === 0 && (
                  <div className="p-4 text-xs text-ink-subtle text-center border border-line rounded-xl">
                    Nenhum documento ou anexo disponível nesta issue.
                  </div>
                )}
              </div>
            )}

            {drawerTab === 'interacoes' && (
              <div className="space-y-3">
                <div className="text-xs text-ink-subtle flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>
                    Interações estruturadas (suggest_tasks, ask_user_questions, request_confirmation, request_checkbox_confirmation, request_item_verdicts)
                  </span>
                </div>
                {interactions.map((inter, idx) => (
                  <div key={String(inter.id || idx)} className="p-4 rounded-xl border border-line bg-surface-subtle/40 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-highlight">
                        {String(inter.kind || inter.type || 'interação')}
                      </span>
                      <span className="font-mono text-ink-subtle">{String(inter.status || '')}</span>
                    </div>
                    <div className="text-ink whitespace-pre-wrap">
                      {String(inter.prompt || inter.question || inter.title || JSON.stringify(inter))}
                    </div>
                  </div>
                ))}
                {interactions.length === 0 && (
                  <div className="p-4 text-xs text-ink-subtle text-center border border-line rounded-xl">
                    Nenhuma interação estruturada registrada nesta issue.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SlideDrawer>

      {/* CREATE ISSUE DRAWER */}
      <SlideDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Criar Issue no Paperclip"
        subtitle="A delegação oficial utiliza a fila real de issues da instância conectada"
      >
        <form onSubmit={handleCreateIssue} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Título</label>
            <input
              type="text"
              required
              value={newIssue.title}
              onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
              placeholder="Ex.: Revisar métricas de SLA da semana"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Agente responsável</label>
              <select
                value={newIssue.assigneeAgentId}
                onChange={(e) => setNewIssue({ ...newIssue, assigneeAgentId: e.target.value })}
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
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Prioridade</label>
              <select
                value={newIssue.priority}
                onChange={(e) => setNewIssue({ ...newIssue, priority: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-xs text-ink"
              >
                <option value="urgent">urgent</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </div>
          </div>

          {(projects.length > 0 || goals.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {projects.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">Projeto Paperclip</label>
                  <select
                    value={newIssue.projectId}
                    onChange={(e) => setNewIssue({ ...newIssue, projectId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-xs text-ink"
                  >
                    <option value="">Nenhum</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {goals.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">Meta (Goal)</label>
                  <select
                    value={newIssue.goalId}
                    onChange={(e) => setNewIssue({ ...newIssue, goalId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-xs text-ink"
                  >
                    <option value="">Nenhuma</option>
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {issues.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">
                Issue pai (opcional, para sub-issue)
              </label>
              <select
                value={newIssue.parentId}
                onChange={(e) => setNewIssue({ ...newIssue, parentId: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-xs text-ink"
              >
                <option value="">Nenhuma (issue raiz)</option>
                {issues.map((iss) => (
                  <option key={iss.id} value={iss.id}>
                    {iss.identifier ? `${iss.identifier} — ` : ''}
                    {iss.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Descrição</label>
            <textarea
              rows={3}
              value={newIssue.description}
              onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
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
            <button
              type="submit"
              disabled={busyId === 'create'}
              className="nc-primary-btn px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Criar no Paperclip
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
};
