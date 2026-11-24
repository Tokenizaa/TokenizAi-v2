import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
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
import type { PaperclipApprovalDto } from '../../../types/platform';

interface ApprovalsPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

const statusTone = (st: string) => {
  const s = st.toLowerCase();
  if (s === 'approved') return 'nominal';
  if (s === 'rejected') return 'critical';
  return 'attention';
};

export const ApprovalsPage: React.FC<ApprovalsPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<PaperclipApprovalDto[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hermesService.listApprovals();
      setApprovals(res.approvals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar as aprovações do Paperclip.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = approvals.filter((a) => {
    if (statusFilter !== 'all' && a.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
    return true;
  });

  const decide = async (approvalId: string, action: 'approve' | 'reject' | 'revision', note?: string) => {
    try {
      if (action === 'approve') await hermesService.approveApproval(approvalId, note);
      else if (action === 'reject') await hermesService.rejectApproval(approvalId, note);
      else await hermesService.requestApprovalRevision(approvalId, note || '');
      onToast(`Aprovação ${action === 'revision' ? 'enviada para revisão' : action === 'approve' ? 'aprovada' : 'rejeitada'} no Paperclip.`);
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Paperclip recusou a decisão de aprovação.');
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar as aprovações" message={error} onRetry={load} />;
  if (approvals.length === 0) {
    return (
      <EmptyState
        title="Nenhuma aprovação encontrada"
        description="A central de aprovações e governança do Paperclip não possui solicitações para esta empresa."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Aprovações e governança (Paperclip)"
        subtitle="Solicitações pendentes de autorização humana e revisões de decisões operacionais."
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
          <SectionTitle title={`Aprovações (${filtered.length} de ${approvals.length})`} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrar aprovações por status"
            className="px-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink shrink-0"
          >
            <option value="all">Todos status</option>
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovadas</option>
            <option value="rejected">Rejeitadas</option>
          </select>
        </div>
      </CollectionToolbar>

      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {filtered.map((approval) => (
          <div key={approval.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink">{approval.title}</div>
              {approval.description && <div className="text-[11px] text-ink-muted line-clamp-1">{approval.description}</div>}
              <div className="mt-1 text-[11px] text-ink-muted">
                Solicitante: {approval.requestedByName || '—'} · {approval.createdAt || '—'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={approval.status} size="sm" />
              {approval.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => decide(approval.id, 'approve', 'Aprovada via cockpit TokenizAi.')}
                    className="px-2.5 py-1 rounded border border-emerald-500/30 bg-emerald-50/50 text-emerald-700 text-[10px] font-semibold hover:bg-emerald-100/80 cursor-pointer"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(approval.id, 'reject', 'Rejeitada via cockpit TokenizAi.')}
                    className="px-2.5 py-1 rounded border border-red-500/30 bg-red-50/50 text-red-700 text-[10px] font-semibold hover:bg-red-100/80 cursor-pointer"
                  >
                    Rejeitar
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-subtle">
        As decisões respeitam as permissões reais da instância Paperclip. Ações de aprovação/rejeição gravam na fonte operacional.
      </p>
    </div>
  );
};
