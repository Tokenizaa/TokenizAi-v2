import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import { EmptyState } from '../components';

interface ApprovalsPageProps { onNavigate: (id: string) => void; onToast: (msg: string) => void; }

export const ApprovalsPage: React.FC<ApprovalsPageProps> = () => (
  <div className="space-y-5">
    <PageHeader title="Aprovações e governança" subtitle="Decisões que exigem autorização humana no fluxo operacional." />
    <EmptyState
      icon={<ShieldCheck className="w-5 h-5" />}
      title="Gestão de aprovações não integrada"
      description="O contrato Hermes atualmente conectado não disponibiliza uma API verificável para listar e decidir aprovações. A interface anterior chamava operações não presentes no serviço ativo. Por segurança, os comandos de aprovar, rejeitar e solicitar revisão permanecem indisponíveis até a integração real."
    />
  </div>
);
