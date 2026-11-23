import React, { useCallback, useState } from 'react';
import { GitBranch, User, RefreshCw } from 'lucide-react';
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
import type { PaperclipOrgNodeDto } from '../../../types/platform';

interface OrganizationPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

const statusTone = (st: string) => {
  const s = st.toLowerCase();
  if (s === 'running' || s === 'active' || s === 'idle' || s === 'ready') return 'nominal';
  if (s === 'error' || s === 'failed' || s === 'terminated') return 'critical';
  return 'attention';
};

export const OrganizationPage: React.FC<OrganizationPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<PaperclipOrgNodeDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paperclipService.getOrganization();
      setTree(Array.isArray(res.tree) ? res.tree : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar o organograma do Paperclip.');
    } finally {
      setLoading(false);
    }
  }, []);

  const renderBranch = (node: PaperclipOrgNodeDto, depth = 0): React.ReactNode => {
    const hasChildren = (node.children || []).length > 0;
    return (
      <div key={node.id} className="space-y-2.5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate(`ia-agente-detalhe:${node.id}`)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate(`ia-agente-detalhe:${node.id}`);
            }
          }}
          className={`nc-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-colors hover:border-accent/40 ${
            hasChildren ? '' : 'border-dashed'
          }`}
          style={{ marginLeft: `${Math.min(depth * 24, 96)}px` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full border border-line-strong bg-surface-subtle flex items-center justify-center text-xs font-semibold text-ink shrink-0">
              {(node.title || node.name).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold text-ink truncate">
                {node.title || node.name}
              </div>
              <div className="text-xs text-ink-subtle truncate">
                {node.role || 'Membro Paperclip'}
                {node.team ? ` · ${node.team}` : ''}
                {hasChildren ? ` · ${node.children.length} subordinado(s)` : ''}
              </div>
            </div>
          </div>
          {node.status && <StatusBadge status={node.status} size="sm" />}
        </div>
        {hasChildren && (
          <div className="pl-8 border-l border-line-strong/40 space-y-2.5">
            {node.children.map((child) => renderBranch(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleRetry = () => load();

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar o organograma" message={error} onRetry={handleRetry} />;
  if (tree.length === 0) {
    return (
      <EmptyState
        title="Sem estrutura hierárquica"
        description="A instância Paperclip conectada não retornou vínculos de organização para esta empresa."
        action={
          <button
            type="button"
            onClick={load}
            className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Recarregar
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organização e equipes (Paperclip)"
        subtitle="Hierarquia construída dinamicamente a partir dos vínculos reportsTo e endpoint /org do Paperclip."
        actions={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar organograma
          </button>
        }
      />

      <CollectionToolbar>
        <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
          <SectionTitle title="Estrutura hierárquica" subtitle={tree.length > 0 ? `Nós mapeados: ${countNodes(tree)}` : undefined} />
          <div className="text-xs text-ink-subtle inline-flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
            <span>Fonte: endpoint /org da instância Paperclip</span>
          </div>
        </div>
      </CollectionToolbar>

      <div className="space-y-3">
        {tree.map((root) => renderBranch(root, 0))}
      </div>

      <p className="text-xs text-ink-subtle">
        Clique em um agente para abrir seu perfil operacional. A estrutura reflete a cadeia de reporte oficial do Paperclip (não a empresa TokenizAi).
      </p>
    </div>
  );
};

function countNodes(nodes: PaperclipOrgNodeDto[]): number {
  let total = 0;
  const walk = (list: PaperclipOrgNodeDto[]) => {
    for (const n of list) {
      total += 1;
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return total;
}
