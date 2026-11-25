import React from 'react';
import { PageHeader } from '../../../components/ui/Primitives';
import { EmptyState } from '../../ai-workforce/components';
import { useParams } from 'react-router-dom';

interface ApprovalDetailPageProps {
  approvalId?: string;
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const ApprovalDetailPage: React.FC<ApprovalDetailPageProps> = ({
  approvalId: approvalIdProp,
  onNavigate,
}) => {
  const { approvalId: approvalIdFromUrl } = useParams<{ approvalId: string }>();
  const approvalId = approvalIdProp ?? approvalIdFromUrl ?? '';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Detalhe de aprovação"
        subtitle={approvalId ? `Identificador: ${approvalId}` : 'Nenhum identificador informado'}
      />
      <EmptyState
        title="Detalhes de aprovação ainda não integrados"
        description="O contrato atual do runtime Hermes não oferece leitura persistente de aprovações por identificador. Ações de decisão não são apresentadas até que o domínio de governança da TokenizAi tenha uma API persistente e autorizada."
        action={
          <button
            type="button"
            onClick={() => onNavigate('ia-aprovacoes')}
            className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Voltar para governança
          </button>
        }
      />
    </div>
  );
};
