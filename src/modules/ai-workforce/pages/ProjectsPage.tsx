import React, { useCallback, useEffect, useState } from 'react';
import { FolderGit2, Target, RefreshCw } from 'lucide-react';
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
import type { PaperclipProjectDto, PaperclipGoalDto } from '../../../types/platform';

interface ProjectsPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<PaperclipProjectDto[]>([]);
  const [goals, setGoals] = useState<PaperclipGoalDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, gRes] = await Promise.all([
        paperclipService.listProjects(),
        paperclipService.listGoals(),
      ]);
      setProjects(pRes.projects || []);
      setGoals(gRes.goals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar projetos e metas do Paperclip.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar os projetos" message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projetos operacionais e metas (Paperclip)"
        subtitle="Domínio operacional exclusivo do Paperclip (independente dos projetos empresariais da TokenizAi)."
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

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="nc-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-line bg-surface-subtle/40 flex items-center justify-between">
            <div>
              <div className="font-display text-base font-semibold text-ink">
                <FolderGit2 className="mr-2 w-4 h-4 text-accent dark:text-cyan-300" /> Projetos
                operacionais
              </div>
              <div className="text-xs text-ink-subtle">{projects.length} projetos</div>
            </div>
          </div>
          <div className="divide-y divide-line p-6 overflow-y-auto max-h-[600px]">
            {projects.map((p) => (
              <div key={p.id} className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink truncate">{p.name}</div>
                  {p.description && <div className="text-[11px] text-ink-subtle truncate">{p.description}</div>}
                  <div className="text-[10px] text-ink-subtle mt-1">
                    Status: {p.status || '—'} · Lead: {p.leadAgentId || 'não definido'}
                  </div>
                </div>
                <StatusBadge status={p.status || 'desconhecido'} size="sm" />
              </div>
            ))}
            {projects.length === 0 && (
              <div className="py-8 text-center text-xs text-ink-subtle">
                Nenhum projeto operacional cadastrado no Paperclip.
              </div>
            )}
          </div>
        </div>

        <div className="nc-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-line bg-surface-subtle/40 flex items-center justify-between">
            <div>
              <div className="font-display text-base font-semibold text-ink">
                <Target className="mr-2 w-4 h-4 text-accent dark:text-cyan-300" /> Metas &amp;
                objetivos
              </div>
              <div className="text-xs text-ink-subtle">{goals.length} metas</div>
            </div>
          </div>
          <div className="divide-y divide-line p-6 overflow-y-auto max-h-[600px]">
            {goals.map((g) => (
              <div key={g.id} className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink truncate">{g.title}</div>
                  {g.level && <div className="text-[11px] text-ink-subtle">Nível: {g.level}</div>}
                  <div className="text-[10px] text-ink-subtle mt-1">
                    Status: {g.status || '—'} · Proprietário: {g.ownerAgentId || 'não definido'}
                  </div>
                </div>
                {typeof g.progressPercent === 'number' && (
                  <span className="font-mono font-semibold text-highlight tabular-nums">
                    {g.progressPercent}%
                  </span>
                )}
              </div>
            ))}
            {goals.length === 0 && (
              <div className="py-8 text-center text-xs text-ink-subtle">
                Nenhuma meta operacional cadastrada no Paperclip.
              </div>
            )}
          </div>
        </div>
      </section>

      <p className="text-xs text-ink-subtle">
        Projetos e metas pertencem ao escopo operacional do Paperclip. Para vincular a um projeto empresarial da TokenizAi, use o campo de identificador correspondente na ficha do projeto TokenizAi.
      </p>
    </div>
  );
};
