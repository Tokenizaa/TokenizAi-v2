import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { PageHeader, StatusText } from '../../../components/ui/Primitives';
import { EmptyState, ErrorState, LoadingState } from '../../ai-workforce/components';
import { hermesService } from '../../ai-workforce/services/hermes';
import type { HermesApprovalDto } from '../../../types/platform';
import { useParams } from 'react-router-dom';

interface ApprovalDetailPageProps {
  approvalId?: string;
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

const statusTone = (st: string) => {
  const s = st.toLowerCase();
  if (s === 'approved') return 'nominal';
  if (s === 'rejected') return 'critical';
  return 'attention';
};

export const ApprovalDetailPage: React.FC<ApprovalDetailPageProps> = ({
  approvalId: approvalIdProp,
  onToast,
}) => {
  const { approvalId: approvalIdFromUrl } = useParams<{ approvalId: string }>();
  const approvalId = approvalIdProp ?? approvalIdFromUrl ?? '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approval, setApproval] = useState<HermesApprovalDto | null>(null);

  const load = useCallback(async () => {
    if (!approvalId) {
      setError('O identificador da aprovação não foi informado.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await hermesService.listApprovals();
      setApproval(result.approvals.find((item) => item.id === approvalId) || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar as aprovações do Hermes.');
    } finally {
      setLoading(false);
    }
  }, [approvalId]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (action: 'approve' | 'reject' | 'revision', note?: string) => {
    if (!approval) return;
    try {
      if (action === 'approve') await hermesService.approveApproval(approvalId, note);
      else if (action === 'reject') await hermesService.rejectApproval(approvalId, note);
      else await hermesService.requestApprovalRevision(approvalId, note || '');
      onToast(action === 'revision' ? 'Revisão solicitada.' : action === 'approve' ? 'Aprovação registrada.' : 'Rejeição registrada.');
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'O serviço de governança recusou a decisão.');
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar a aprovação" message={error} onRetry={load} />;
  if (!approval) {
    return (
      <EmptyState
        title="Aprovação não encontrada"
        description="A consulta real de aprovações do Hermes não retornou um registro com este identificador."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={approval.title}
        subtitle={`${approval.status} · ${approval.createdAt || 'Data não informada'}`}
        actions={
          <button
            type="button"
            onClick={load}
            className="px-3 py-1.5 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Recarregar
          </button>
        }
      />

      <div className="nc-card rounded-2xl p-5 space-y-4">
        <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Identificação</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-ink-subtle">Status</div>
            <div className="flex items-center gap-2"><StatusText label={approval.status} tone={statusTone(approval.status)} /></div>
          </div>
          <div>
            <div className="text-ink-subtle">Tipo</div>
            <div className="font-mono text-ink">{approval.type || '—'}</div>
          </div>
          <div>
            <div className="text-ink-subtle">Solicitante</div>
            <div className="font-mono text-ink">{approval.requestedByName || '—'}</div>
          </div>
          <div>
            <div className="text-ink-subtle">Tarefa relacionada</div>
            <div className="font-mono text-ink">{approval.issueId || '—'}</div>
          </div>
          {approval.decidedAt && (
            <div>
              <div className="text-ink-subtle">Decidido em</div>
              <div className="font-mono text-ink">{approval.decidedAt}</div>
            </div>
          )}
        </div>
        {approval.description && (
          <div>
            <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Descrição</div>
            <div className="text-sm text-ink whitespace-pre-wrap">{approval.description}</div>
          </div>
        )}
      </div>

      {approval.status === 'pending' && (
        <div className="space-y-3">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Decisão</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => decide('approve', 'Aprovada via cockpit TokenizAi.')}
              className="px-4 py-2 rounded-lg border border-emerald-500/30 bg-emerald-50/50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100/80 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Aprovar
            </button>
            <button
              type="button"
              onClick={() => decide('reject', 'Rejeitada via cockpit TokenizAi.')}
              className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-50/50 text-red-700 text-xs font-semibold hover:bg-red-100/80 cursor-pointer"
            >
              Rejeitar
            </button>
            <button
              type="button"
              onClick={() => decide('revision', 'Revisão solicitada via cockpit TokenizAi.')}
              className="px-4 py-2 rounded-lg border border-line-strong bg-surface text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
            >
              Solicitar revisão
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
