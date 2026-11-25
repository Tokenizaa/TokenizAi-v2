import React from 'react';
import { Target } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import { EmptyState } from '../components';

interface GoalsPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const GoalsPage: React.FC<GoalsPageProps> = () => (
  <div className="space-y-5">
    <PageHeader
      title="Metas e objetivos"
      subtitle="Objetivos operacionais e seu vínculo com projetos e agentes da organização."
    />
    <EmptyState
      icon={<Target className="w-5 h-5" />}
      title="Metas ainda não disponíveis pela integração"
      description="O contrato atual do runtime Hermes não oferece uma operação de listagem ou gerenciamento de metas. Esta página não apresenta uma lista vazia artificial. O domínio de objetivos empresariais deve ser disponibilizado pela API da TokenizAi quando for implementado."
    />
  </div>
);
