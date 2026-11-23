import React, { useCallback, useEffect, useState } from 'react';
import { Plug, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import {
  CollectionToolbar,
  SectionTitle,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components';

interface ConnectorsPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const ConnectorsPage: React.FC<ConnectorsPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // A versão conectada do Paperclip não expõe um endpoint dedicado de listagem
      // de conectores na matriz de capacidades (apenas skill-sources e rotas de domínio).
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar os conectores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Conectores e integrações (Paperclip)"
        subtitle="Estado, configuração e escopos de conexão dos agentes. Gerenciamento de conectores depende dos endpoints expostos pela versão instalada."
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

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState title="Não foi possível carregar os conectores" message={error} onRetry={load} />
      ) : (
        <EmptyState
          title="Não exposto pela versão conectada"
          description={
            'A instância Paperclip conectada não expõe um endpoint público de listagem/gerenciamento de conectores na versão disponível. Os conectores são administrados diretamente na interface original do Paperclip.'
          }
          action={
            <button
              type="button"
              onClick={() => onToast('Consulte o Paperclip na porta 3100 para gerenciar conectores.')}
              className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Abrir Paperclip (3100)
            </button>
          }
        />
      )}

      <p className="text-xs text-ink-subtle">
        Nenhuma credencial de conector é exposta no navegador. A TokenizAi não duplica o banco de dados operacional do Paperclip.
      </p>
    </div>
  );
};
