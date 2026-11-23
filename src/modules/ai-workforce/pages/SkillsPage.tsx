import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Search, Sparkles, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import {
  CollectionToolbar,
  SectionTitle,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components';
import { paperclipService } from '../services/paperclip';
import type { PaperclipAgentDto } from '../../../types/platform';

interface SkillsPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const SkillsPage: React.FC<SkillsPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<PaperclipAgentDto[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paperclipService.listAgents();
      setAgents(res.agents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar as competências dos agentes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const capabilityMap = useMemo(() => {
    const map = new Map<string, { agents: string[]; count: number }>();
    for (const ag of agents) {
      for (const cap of ag.capabilities || []) {
        const entry = map.get(cap) || { agents: [], count: 0 };
        entry.agents.push(ag.title || ag.name);
        entry.count = entry.agents.length;
        map.set(cap, entry);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [agents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return capabilityMap.filter(([cap]) => !q || cap.toLowerCase().includes(q));
  }, [capabilityMap, search]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar as skills" message={error} onRetry={load} />;
  if (filtered.length === 0) {
    return (
      <EmptyState
        title="Nenhuma competência registrada"
        description="Não foi possível mapear skills dos agentes na instância Paperclip conectada."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Skills e competências (Paperclip)"
        subtitle="Mapeamento de competências declaradas pelos agentes operacionais. A gestão de fontes de skill (Skill Studio) depende da versão instalada do Paperclip."
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
              placeholder="Buscar skill por nome…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
            />
          </div>
          <div className="text-xs text-ink-subtle inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
            <span>{filtered.length} skill(s) mapeada(s)</span>
          </div>
        </div>
      </CollectionToolbar>

      <SectionTitle title="Competências por skill (agregadas dos agentes)" />

      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {filtered.map(([cap, info]) => (
          <div key={cap} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink">{cap}</div>
              <div className="text-[11px] text-ink-muted">{info.count} agente(s) · {info.agents.slice(0, 3).join(', ')}{info.agents.length > 3 ? ` +${info.agents.length - 3}` : ''}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-highlight font-semibold">{info.count}</div>
              <div className="text-[10px] text-ink-subtle">agentes</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-subtle">
        As skills são derivadas dos campos capabilities dos agentes no Paperclip. Criação, edição e importação de skill packages (Skill Studio) dependem dos endpoints expostos pela versão conectada.
      </p>
    </div>
  );
};
