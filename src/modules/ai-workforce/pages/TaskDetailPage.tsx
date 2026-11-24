import React, { useCallback, useEffect, useState } from 'react';
import { ListTodo, MessageSquare, Activity, Paperclip, RefreshCw, Share2 } from 'lucide-react';
import { PageHeader, SegmentedTabs, StatusText } from '../../../components/ui/Primitives';
import {
  SectionTitle,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components';
import { hermesService } from '../services/hermes';
import type { HermesIssueDto, HermesChatMessageDto, HermesRunDto, HermesAttachmentDto } from '../../../types/platform';
import { useParams } from 'react-router-dom';

type TaskTab = 'detalhes' | 'comentarios' | 'execucoes' | 'anexos' | 'interacoes';

interface TaskDetailPageProps {
  issueId?: string;
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

const statusTone = (st: string) => {
  const s = st.toLowerCase();
  if (s === 'done' || s === 'completed' || s === 'closed') return 'nominal';
  if (s === 'blocked') return 'critical';
  if (s === 'in_progress' || s === 'in-progress' || s === 'active' || s === 'running') return 'nominal';
  return 'attention';
};

export const TaskDetailPage: React.FC<TaskDetailPageProps> = ({
  issueId: issueIdProp,
  onNavigate,
  onToast,
}) => {
  const { issueId: issueIdFromUrl } = useParams<{ issueId: string }>();
  const issueId = issueIdProp ?? issueIdFromUrl ?? '';
  if (!issueId) {
    return null;
  }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issue, setIssue] = useState<HermesIssueDto | null>(null);
  const [comments, setComments] = useState<HermesChatMessageDto[]>([]);
  const [runs, setRuns] = useState<HermesRunDto[]>([]);
  const [attachments, setAttachments] = useState<HermesAttachmentDto[]>([]);
  const [tab, setTab] = useState<TaskTab>('detalhes');
  const [newComment, setNewComment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [iRes, cRes, rRes, aRes] = await Promise.allSettled([
        hermesService.getIssue(issueId),
        hermesService.getIssueComments(issueId),
        hermesService.getIssueRuns(issueId),
        hermesService.getIssueAttachments(issueId),
      ]);
      if (iRes.status === 'fulfilled') setIssue(iRes.value.issue);
      if (cRes.status === 'fulfilled') setComments(cRes.value.comments || []);
      if (rRes.status === 'fulfilled') setRuns(rRes.value.runs || []);
      if (aRes.status === 'fulfilled') setAttachments(aRes.value.attachments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar os detalhes da tarefa.');
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    load();
  }, [load]);

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await hermesService.addIssueComment(issueId, newComment.trim());
      setNewComment('');
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha ao publicar o comentário.');
    }
  };

  const updateStatus = async (status: string) => {
    try {
      await hermesService.updateIssue(issueId, { status });
      onToast(`Status da tarefa atualizado para ${status}.`);
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha ao atualizar o status.');
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar a tarefa" message={error} onRetry={load} />;
  if (!issue) return <EmptyState title="Tarefa não encontrada" description="A issue solicitada não existe na instância Paperclip." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title={issue.title}
        subtitle={`${issue.identifier || issue.id} · ${issue.status}`}
        actions={
          <>
            <button
              type="button"
              onClick={load}
              className="px-3 py-1.5 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Recarregar
            </button>
            <button
              type="button"
              onClick={() => updateStatus(issue.status === 'done' ? 'todo' : 'done')}
              className="px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
              {issue.status === 'done' ? 'Reabrir' : 'Concluir'}
            </button>
          </>
        }
      />

      <SegmentedTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'detalhes', label: 'Detalhes' },
          { id: 'comentarios', label: 'Comentários', count: comments.length },
          { id: 'execucoes', label: 'Execuções', count: runs.length },
          { id: 'anexos', label: 'Anexos', count: attachments.length },
          { id: 'interacoes', label: 'Interações' },
        ]}
      />

      {tab === 'detalhes' && (
        <div className="space-y-4">
          <div className="nc-card rounded-2xl p-5 space-y-3">
            <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Identificação</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-ink-subtle">Identificador</div>
                <div className="font-mono text-ink">{issue.identifier || issue.id}</div>
              </div>
              <div>
                <div className="text-ink-subtle">Status</div>
                <div className="flex items-center gap-2">
                  <StatusText label={issue.status} tone={statusTone(issue.status)} />
                </div>
              </div>
              <div>
                <div className="text-ink-subtle">Prioridade</div>
                <div className="font-mono text-ink">{issue.priority || '—'}</div>
              </div>
              <div>
                <div className="text-ink-subtle">Projeto</div>
                <div className="font-mono text-ink">{issue.projectName || 'Não vinculado'}</div>
              </div>
              <div>
                <div className="text-ink-subtle">Responsável</div>
                <div className="font-mono text-ink">{issue.assigneeAgentName || 'Não atribuído'}</div>
              </div>
              <div>
                <div className="text-ink-subtle">Meta</div>
                <div className="font-mono text-ink">{issue.goalId || '—'}</div>
              </div>
            </div>
          </div>
          {issue.description && (
            <div className="nc-card rounded-2xl p-5 space-y-2">
              <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Descrição</div>
              <div className="text-sm text-ink whitespace-pre-wrap line-clamp-3">{issue.description}</div>
            </div>
          )}
          <div className="nc-card rounded-2xl p-5 space-y-3">
            <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Alterar status</div>
            <div className="flex flex-wrap gap-2">
              {['todo', 'in_progress', 'blocked', 'done'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    issue.status === s
                      ? 'bg-accent border-accent text-white'
                      : 'border-line-strong bg-surface text-ink hover:bg-surface-subtle'
                  } cursor-pointer`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'comentarios' && (
        <div className="space-y-4">
          <div className="nc-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Comentários da tarefa</div>
              <button
                type="button"
                onClick={() => setTab('comentarios')}
                className="text-[10px] text-ink-subtle underline cursor-pointer"
              >
                Atualizar
              </button>
            </div>
            <div className="divide-y divide-line">
              {comments.map((c) => (
                <div key={c.id} className="pt-3 pb-2 text-sm space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-ink">{c.authorName}</span>
                    <span className="text-[10px] text-ink-subtle">{c.authorType || '—'}</span>
                    <span className="text-[10px] text-ink-muted">{c.createdAt}</span>
                  </div>
                  <div className="text-ink text-sm whitespace-pre-wrap">{c.body}</div>
                </div>
              ))}
              {comments.length === 0 && (
                <div className="py-4 text-center text-xs text-ink-subtle">Nenhum comentário nesta tarefa.</div>
              )}
            </div>
            <form onSubmit={addComment} className="pt-3 border-t border-line">
              <div className="flex gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escreva um comentário…"
                  rows={2}
                  className="flex-1 resize-none p-2.5 rounded-xl border border-line-strong bg-white text-xs text-ink focus:border-accent focus:ring-0 outline-none"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-4 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Publicar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tab === 'execucoes' && (
        <div className="space-y-4">
          <div className="nc-card rounded-2xl p-5 space-y-2">
            <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Execuções relacionadas</div>
            {runs.length > 0 ? (
              <div className="divide-y divide-line">
                {runs.map((r) => (
                  <div key={r.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium text-ink">{r.agentName || 'Agente'} · {r.model || '—'}</div>
                      <div className="text-[10px] text-ink-muted">{r.status}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-ink">{r.costCents != null ? (r.costCents / 100).toFixed(4) : '0'} USD</div>
                      <div className="text-[10px] text-ink-muted">{r.startedAt || '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-ink-subtle">Nenhuma execução relacionada.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'anexos' && (
        <div className="space-y-4">
          <div className="nc-card rounded-2xl p-5 space-y-2">
            <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Anexos da tarefa</div>
            {attachments.length > 0 ? (
              <div className="divide-y divide-line">
                {attachments.map((a) => (
                  <div key={a.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-ink truncate">{a.filename}</div>
                      <div className="text-[10px] text-ink-muted">{a.contentType || '—'} · {a.sizeBytes != null ? a.sizeBytes + ' bytes' : '—'}</div>
                    </div>
                    <a
                      href={a.url || ''}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-accent dark:text-cyan-300 underline hover:text-accent-ink cursor-pointer"
                    >
                      Abrir
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-ink-subtle">Nenhum anexo nesta tarefa.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'interacoes' && (
        <EmptyState
          title="Interações estruturadas"
          description="As interações da tarefa (quando disponíveis na versão instalada do Paperclip) são exibidas aqui."
        />
      )}
    </div>
  );
};
