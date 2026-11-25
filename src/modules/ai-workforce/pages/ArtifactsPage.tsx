import React, { useCallback, useEffect, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import {
  CollectionToolbar,
  SectionTitle,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components';
import { hermesService } from '../services/hermes';
import type { HermesSkillDto } from '../../../types/platform';

interface ArtifactsPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const ArtifactsPage: React.FC<ArtifactsPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<HermesSkillDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hermesService.getArtifacts();
      setArtifacts(res.artifacts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar os artefatos disponibilizados aos agentes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar os artefatos" message={error} onRetry={load} />;
  if (artifacts.length === 0) {
    return (
      <EmptyState
        title="Nenhum artefato encontrado"
        description="O runtime Hermes não retornou artefatos para esta organização."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Artefatos e anexos"
        subtitle="Biblioteca de artefatos da empresa, com navegação e acesso conforme permissões da instância. Fonte: /companies/{companyId}/artifacts."
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
          <SectionTitle title={`Artefatos (${artifacts.length})`} subtitle="Artefatos disponibilizados à operação dos agentes." />
        </div>
      </CollectionToolbar>

      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {artifacts.map((a) => (
          <div key={a.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink truncate">{a.title || 'Artefato sem título'}</div>
              <div className="text-[11px] text-ink-muted">
                {a.source || '—'} · {a.mediaKind || '—'} · {a.authorName || '—'}
              </div>
              {a.previewText && (
                <div className="text-[11px] text-ink-subtle line-clamp-1 mt-1">{a.previewText}</div>
              )}
              {a.issueId && (
                <div className="text-[10px] text-ink-muted mt-1">
                  Issue relacionada: {a.issueId}
                </div>
              )}
            </div>
            <div className="text-right">
              {a.sizeBytes != null ? (
                <div className="font-mono text-ink">{a.sizeBytes} bytes</div>
              ) : (
                <div className="font-mono text-ink-muted">—</div>
              )}
              <a
                href={a.url || ''}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-[11px] text-accent dark:text-cyan-300 underline hover:text-accent-ink cursor-pointer"
              >
                Abrir arquivo
              </a>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-subtle">
        Os arquivos são disponibilizados pelo backend da TokenizAi conforme as permissões aplicáveis. Nenhuma credencial é exposta ao navegador.
      </p>
    </div>
  );
};
