import React from 'react';
import { FileText } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import { EmptyState } from '../components';

interface ArtifactsPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const ArtifactsPage: React.FC<ArtifactsPageProps> = () => (
  <div className="space-y-5">
    <PageHeader
      title="Artefatos e anexos"
      subtitle="Arquivos e entregáveis produzidos ou utilizados nos fluxos empresariais e de agentes."
    />
    <EmptyState
      icon={<FileText className="w-5 h-5" />}
      title="Biblioteca de artefatos ainda não integrada"
      description="O contrato atual do runtime Hermes não expõe uma operação de listagem de artefatos nem uma URL de conteúdo verificável. A página não simula arquivos ou links. A biblioteca deverá ser conectada ao armazenamento empresarial da TokenizAi."
    />
  </div>
);
