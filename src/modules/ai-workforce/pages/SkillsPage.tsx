import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Search, Sparkles, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import {
  CollectionToolbar,
  SectionTitle,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components';
import { hermesService } from '../services/hermes';
import type { HermesSkillDto } from '../../../types/platform';

interface SkillsPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const SkillsPage: React.FC<SkillsPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skills, setSkills] = useState<HermesSkillDto[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hermesService.getSkills();
      setSkills(res.skills || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar as skills da empresa no Paperclip.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skills.filter((s) => {
      if (!q) return true;
      return (
        (s.name || '').toLowerCase().includes(q) ||
        (s.key || '').toLowerCase().includes(q) ||
        (s.slug || '').toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q)
      );
    });
  }, [skills, search]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar as skills" message={error} onRetry={load} />;
  if (filtered.length === 0) {
    return (
      <EmptyState
        title="Nenhuma skill encontrada"
        description="A instância Paperclip conectada não retornou skills instaladas para esta empresa."
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
        title="Skills e competências (Paperclip)"
        subtitle="Skills instaladas na empresa no Paperclip, com origem, versão e status. Fonte: endpoint /companies/{companyId}/skills."
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
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0 max-w-md">
            <Search className="w-4 h-4 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar skill por nome, chave ou slug…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
            />
          </div>
          <div className="text-xs text-ink-subtle inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
            <span>{filtered.length} skill(s) instalada(s)</span>
          </div>
        </div>
      </CollectionToolbar>

      <SectionTitle title="Skills instaladas na empresa" />

      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {filtered.map((s) => (
          <div key={s.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink truncate">{s.name || s.slug || s.key}</div>
              <div className="text-[11px] text-ink-muted">
                {s.key || '—'} · {s.slug || '—'} · {s.version || 'sem versão'}
              </div>
              {s.description && (
                <div className="text-[11px] text-ink-subtle line-clamp-1 mt-1">{s.description}</div>
              )}
              <div className="text-[10px] text-ink-muted mt-2">
                Pasta: {s.folderPath || '—'} · Status: {s.status || '—'}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-semibold text-highlight">
                {s.status === 'installed' ? 'instalada' : s.status || '—'}
              </div>
              <div className="text-[10px] text-ink-subtle">status</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-subtle">
        As skills são instaladas na empresa Paperclip (fontes GitHub, catálogo, built-in). A criação, edição e importação de skill packages (Skill Studio) dependem dos endpoints expostos pela versão conectada.
      </p>
    </div>
  );
};
