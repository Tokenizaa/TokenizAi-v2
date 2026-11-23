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
import { paperclipService } from '../services/paperclip';

interface ArtifactsPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const ArtifactsPage: React.FC<ArtifactsPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<Array<{ id: string; issueId: string; filename: string; contentType?: string; sizeBytes?: number }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Não há endpoint global de biblioteca de artefatos; agrega anexos das issues recentes.
      const iRes = await paperclipService.listIssues({ limit: 25 });
      const issues = iRes.issues || [];
      const collected: Array<{ id: string; issueId: string; filename: string; contentType?: string; sizeBytes?: number }> = [];
      await Promise.all(
        issues.map(async (issue) => {
          if (!issue.id) return;
          try {
            const aRes = await paperclipService.getIssueAttachments(issue.id);
            for (const a of aRes.attachments || []) {
              collected.push({
                id: a.id,
                issueId: issue.id,
                filename: a.filename,
                contentType: a.contentType,
                sizeBytes: a.sizeBytes,
              });
            }
          } catch {
            // Anexo não acessível para esta issue; ignora silenciosamente.
          }
        })
      );
      setArtifacts(collected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar os artefatos.');
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
        description="Não há anexos de issues na instância Paperclip conectada para exibir na biblioteca."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Artefatos e anexos (Paperclip)"
        subtitle="Biblioteca de arquivos anexados a conversas e issues, com navegação e acesso conforme permissões da instância."
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
          <SectionTitle title={`Artefatos (${artifacts.length})`} subtitle="Agregado a partir dos anexos das issues operacionais recentes." />
        </div>
      </CollectionToolbar>

      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {artifacts.map((a) => (
          <div key={a.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink truncate">{a.filename}</div>
              <div className="text-[11px] text-ink-muted">
                Issue: {a.issueId} · {a.contentType || '—'} · {a.sizeBytes != null ? a.sizeBytes + ' bytes' : '—'}
              </div>
            </div>
            <a
              href={paperclipService.getAttachmentContentUrl(a.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-accent dark:text-cyan-300 underline hover:text-accent-ink cursor-pointer"
            >
              Abrir arquivo
            </a>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-subtle">
        Os arquivos são servidos pelo backend da TokenizAi como proxy do Paperclip (rota /api/paperclip/attachments/:id/content). Nenhuma credencial é exposta ao navegador.
      </p>
    </div>
  );
};
