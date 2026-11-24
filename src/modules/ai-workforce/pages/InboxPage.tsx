import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox, AlertTriangle, CheckCircle2, RefreshCw, Activity } from 'lucide-react';
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
import type { PaperclipInboxItemDto, PaperclipAttentionDto } from '../../../types/platform';

interface InboxPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const InboxPage: React.FC<InboxPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inbox, setInbox] = useState<PaperclipInboxItemDto[]>([]);
  const [attention, setAttention] = useState<PaperclipAttentionDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [iRes, aRes] = await Promise.allSettled([
        hermesService.getInbox(),
        hermesService.getAttention(),
      ]);
      if (iRes.status === 'fulfilled') setInbox(iRes.value.inbox || []);
      if (aRes.status === 'fulfilled') setAttention(aRes.value.attention || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a caixa de entrada do Paperclip.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalAttention = attention?.totalCount ?? 0;
  const deskBadge = attention?.deskBadgeCount ?? 0;

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar a caixa de entrada" message={error} onRetry={load} />;
  if (inbox.length === 0 && totalAttention === 0) {
    return (
      <EmptyState
        title="Caixa de entrada vazia"
        description="Não há itens para atenção nem sinais de atividade na instância Paperclip conectada."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox / Decisões (Paperclip)"
        subtitle="Itens que exigem atenção da instância Paperclip, com navegação para o recurso relacionado. Fonte: /companies/{companyId}/inbox/mine e /attention."
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

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="nc-card rounded-2xl p-5 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Itens na inbox</div>
          <div className="mt-1.5 font-display text-3xl font-semibold font-mono tabular-nums text-ink">{inbox.length}</div>
          <div className="mt-1 text-xs text-ink-muted">itens para sua atenção</div>
        </div>
        <div className="nc-card rounded-2xl p-5 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Sinais de atenção</div>
          <div className="mt-1.5 font-display text-3xl font-semibold font-mono tabular-nums text-highlight">{totalAttention}</div>
          <div className="mt-1 text-xs text-ink-muted">{deskBadge} crachá(s) na mesa</div>
        </div>
        <div className="nc-card rounded-2xl p-5 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Fontes</div>
          <div className="mt-1.5 font-display text-3xl font-semibold font-mono tabular-nums text-accent">2</div>
          <div className="mt-1 text-xs text-ink-muted">inbox · attention</div>
        </div>
      </section>

      <CollectionToolbar>
        <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
          <SectionTitle title={`Itens para atenção (${inbox.length})`} subtitle="Fonte: endpoint /companies/{companyId}/inbox/mine da instância Paperclip." />
        </div>
      </CollectionToolbar>

      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {inbox.length > 0 ? (
          inbox.map((item) => (
            <div key={item.id} className="p-4 cursor-pointer transition-colors hover:bg-surface-blue/30" onClick={() => onNavigate(`ia-tarefa-detalhe:${item.id}`)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full border border-line-strong bg-surface-subtle flex items-center justify-center text-[10px] font-semibold shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-ink truncate">{item.title || 'Item sem título'}</div>
                    <div className="text-[11px] text-ink-muted">
                      {item.source || 'inbox'} · {item.status || '—'} · {item.assigneeAgentName || 'Não atribuído'}
                    </div>
                  </div>
                </div>
                <StatusBadge status={item.status || 'desconhecido'} size="sm" />
              </div>
              {item.description && (
                <p className="mt-1.5 text-[11px] text-ink-muted line-clamp-1">{item.description}</p>
              )}
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-xs text-ink-subtle">Nenhum item na inbox no momento.</div>
        )}
      </div>

      {attention?.countsBySourceKind && Object.entries(attention.countsBySourceKind).some(([, v]) => v > 0) && (
        <div className="mt-6 nc-card rounded-2xl p-5 space-y-3">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Feed de atenção por origem</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(attention.countsBySourceKind).map(([kind, count]) => (
              <div key={kind} className="p-3 rounded-xl border border-line bg-surface-subtle text-center">
                <div className="font-mono font-semibold text-ink">{count}</div>
                <div className="text-[10px] text-ink-subtle">{kind}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-ink-subtle">
        O inbox consolida sinais da instância Paperclip. Clique em um item para abrir a tarefa relacionada. Ações de aprovação respeitam as permissões reais da autoridade de aprovador.
      </p>
    </div>
  );
};
