import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Search, User, Clock, Zap, RefreshCw, MessageSquare, Play, Pause } from 'lucide-react';
import { PageHeader, SegmentedTabs, StatusText } from '../../../components/ui/Primitives';
import {
  CollectionToolbar,
  SectionTitle,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components';
import { HermesApi } from '../../../services/api';
import type { HermesBotDto } from '../../../types/platform';

interface AgentsPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

const statusTone = (st: string) => {
  const s = st.toLowerCase();
  if (s === 'running' || s === 'active' || s === 'idle' || s === 'ready') return 'nominal';
  if (s === 'error' || s === 'failed' || s === 'terminated') return 'critical';
  return 'attention';
};

export const AgentsPage: React.FC<AgentsPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<HermesBotDto[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await HermesApi.listAgents();
      setAgents(res.agents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar os agentes do Hermes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents.filter((ag) => {
      if (statusFilter !== 'all' && ag.status.toLowerCase() !== statusFilter) return false;
      if (!q) return true;
      return (
        ag.name.toLowerCase().includes(q) ||
        (ag.role || '').toLowerCase().includes(q) ||
        (ag.title || '').toLowerCase().includes(q) ||
        (ag.capabilities || []).some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [agents, search, statusFilter]);

  const handleAction = useCallback(async (agentId: string, action: string) => {
    setBusy((prev) => ({ ...prev, [agentId]: true }));
    try {
      if (action === 'chat') {
        onNavigate(`ia-chat:agent:${agentId}`);
        return;
      }
      onToast(`Ação "${action}" não disponível via REST do Hermes. Use o terminal Hermes.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha ao executar ação no agente.');
    } finally {
      setBusy((prev) => ({ ...prev, [agentId]: false }));
    }
  }, [load, onNavigate, onToast]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar os agentes" message={error} onRetry={load} />;
  if (filtered.length === 0) {
    return (
      <EmptyState
        title="Nenhum agente encontrado"
        description="Ajuste os filtros de busca e status ou contrate um novo agente operacional Hermes."
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

  const statusOptions = [
    { id: 'all', label: `Todos (${agents.length})` },
    { id: 'running', label: 'Em execução' },
    { id: 'idle', label: 'Ocioso' },
    { id: 'paused', label: 'Pausado' },
    { id: 'error', label: 'Erro' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agentes Operacionais (Hermes)"
        subtitle="Instâncias ativas gerenciadas pelo runtime Hermes, separadas do catálogo consultivo Agency Agents."
        actions={
          <button
            type="button"
            onClick={() => onNavigate('biblioteca')}
            className="px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
          >
            <User className="w-3.5 h-3.5 mr-1.5" /> Ver Catálogo Agency Agents
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
              placeholder="Buscar agente por nome, cargo ou competência…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrar status dos agentes"
            className="px-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink shrink-0"
          >
            {statusOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Recarregar
          </button>
        </div>
      </CollectionToolbar>

      <SectionTitle title={filtered.length === agents.length ? 'Todos os agentes' : `Resultado da busca (${filtered.length} de ${agents.length})`} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((ag) => {
          const isBusy = busy[ag.id];
          return (
            <div
              key={ag.id}
              role="button"
              tabIndex={0}
              onClick={() => onNavigate(`ia-agente-detalhe:${ag.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNavigate(`ia-agente-detalhe:${ag.id}`);
                }
              }}
              className="nc-card rounded-2xl p-5 text-left cursor-pointer flex flex-col justify-between gap-4 transition-colors hover:border-accent/40"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full border border-line-strong bg-surface-subtle flex items-center justify-center text-xs font-semibold text-ink shrink-0">
                      {(ag.title || ag.name).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-semibold text-ink truncate">
                        {ag.title || ag.name}
                      </h3>
                      <p className="text-xs text-ink-subtle truncate">{ag.role || 'Agente Hermes'}</p>
                    </div>
                  </div>
                  <StatusBadge status={ag.status} size="md" />
                </div>
                {(ag.capabilities || []).length > 0 && (
                  <div className="text-xs text-ink-muted line-clamp-2">
                    {(ag.capabilities as string[]).slice(0, 4).join(' · ')}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-line">
                  <div>
                    <span className="text-ink-subtle block">Perfil</span>
                    <span className="font-mono text-ink">{ag.profileName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-ink-subtle block">Modelo</span>
                    <span className="font-mono text-ink tabular-nums">{ag.model || '—'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-line">
                  <div>
                    <span className="text-ink-subtle block">Divisão</span>
                    <span className="font-mono text-ink">{ag.division || '—'}</span>
                  </div>
                  <div>
                    <span className="text-ink-subtle block">Criado em</span>
                    <span className="font-mono text-ink">{ag.createdAt ? new Date(ag.createdAt).toLocaleDateString('pt-BR') : '—'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(`ia-chat:agent:${ag.id}`);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line-strong text-accent dark:text-cyan-300 hover:bg-surface-blue text-xs font-semibold cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> <span>Conversar</span>
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction(ag.id, 'chat');
                    }}
                    title="Abrir chat com o agente"
                    className="p-1.5 rounded-lg border border-line-strong text-ink-muted hover:text-ink hover:bg-surface-blue cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
