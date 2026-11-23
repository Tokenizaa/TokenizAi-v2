import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
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
import type { PaperclipIssueDto, PaperclipApprovalDto } from '../../../types/platform';

interface InboxPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const InboxPage: React.FC<InboxPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<PaperclipIssueDto[]>([]);
  const [approvals, setApprovals] = useState<PaperclipApprovalDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [iRes, aRes] = await Promise.all([
        paperclipService.listIssues({ status: 'blocked', limit: 50 }),
        paperclipService.listApprovals(),
      ]);
      setIssues(iRes.issues || []);
      setApprovals(aRes.approvals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a caixa de entrada do Paperclip.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const blockedIssues = issues.filter((i) => i.status === 'blocked');

  const items = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'aprovacao' | 'tarefa';
      title: string;
      subtitle: string;
      status: string;
      onOpen: () => void;
    }> = [];
    for (const a of pendingApprovals) {
      list.push({
        id: a.id,
        type: 'aprovacao',
        title: a.title,
        subtitle: `Solicitação de aprovação · ${a.requestedByName || '—'}`,
        status: a.status,
        onOpen: () => onNavigate(`ia-aprovacao-detalhe:${a.id}`),
      });
    }
    for (const i of blockedIssues) {
      list.push({
        id: i.id,
        type: 'tarefa',
        title: i.title,
        subtitle: `Tarefa bloqueada · ${i.assigneeAgentName || 'Não atribuída'}`,
        status: i.status,
        onOpen: () => onNavigate(`ia-tarefa-detalhe:${i.id}`),
      });
    }
    return list;
  }, [pendingApprovals, blockedIssues]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar a caixa de entrada" message={error} onRetry={load} />;
  if (items.length === 0) {
    return (
      <EmptyState
        title="Caixa de entrada vazia"
        description="Não há aprovações pendentes nem tarefas bloqueadas que exijam sua atenção no momento."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox / Decisões (Paperclip)"
        subtitle="Itens que exigem atenção: aprovações pendentes e tarefas bloqueadas, com navegação para o recurso relacionado."
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
          <SectionTitle title={`Itens para atenção (${items.length})`} subtitle={`${pendingApprovals.length} aprovação(ões) · ${blockedIssues.length} tarefa(s) bloqueada(s)`} />
        </div>
      </CollectionToolbar>

      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {items.map((item) => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={item.onOpen}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.onOpen();
              }
            }}
            className="p-4 cursor-pointer transition-colors hover:bg-surface-blue/30"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full border border-line-strong bg-surface-subtle flex items-center justify-center text-[10px] font-semibold shrink-0">
                  {item.type === 'aprovacao' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-ink truncate">{item.title}</div>
                  <div className="text-[11px] text-ink-muted">{item.subtitle}</div>
                </div>
              </div>
              <StatusBadge status={item.status} size="sm" />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-subtle">
        O inbox consolida sinais da instância Paperclip. Ações de aprovação respeitam as permissões reais da autoridade de aprovador.
      </p>
    </div>
  );
};
