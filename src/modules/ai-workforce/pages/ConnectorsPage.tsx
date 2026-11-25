import React from 'react';
import { Plug } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import { EmptyState } from '../components';

interface ConnectorsPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const ConnectorsPage: React.FC<ConnectorsPageProps> = () => (
  <div className="space-y-5">
    <PageHeader
      title="Conectores e integrações"
      subtitle="Integrações disponíveis para os agentes, com gerenciamento condicionado aos recursos expostos pelas APIs oficiais."
    />
    <EmptyState
      title="Gerenciamento de conectores indisponível pela API atual"
      description="O contrato atual do runtime Hermes não expõe operações de listagem, configuração ou gerenciamento de conectores. A TokenizAi não simula conectores nem solicita credenciais diretamente no navegador. A integração desta área deverá ser implementada quando houver um contrato de backend seguro."
    />
    <div className="nc-card rounded-2xl p-5 flex items-start gap-3">
      <Plug className="w-5 h-5 text-ink-subtle mt-0.5" />
      <div className="text-xs text-ink-muted">
        Credenciais e segredos de integração devem permanecer no backend ou em um cofre seguro. Nenhuma conexão é apresentada como ativa sem confirmação do serviço responsável.
      </div>
    </div>
  </div>
);
