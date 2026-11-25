import React, { useCallback, useEffect, useState } from 'react';
import { Coins, Activity, RefreshCw } from 'lucide-react';
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
import type { HermesCostSummaryDto } from '../../../types/platform';

interface CostsPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const CostsPage: React.FC<CostsPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [costs, setCosts] = useState<HermesCostSummaryDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hermesService.getCostsSummary();
      setCosts(res.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar os custos do Hermes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar os custos" message={error} onRetry={load} />;
  if (!costs) {
    return (
      <EmptyState
        title="Sem dados de custo"
        description="A instância Hermes conectada não retornou um resumo de custos para esta empresa."
      />
    );
  }

  const byAgent = costs.byAgent || [];
  const byProject = costs.byProject || [];
  const totalUsd = costs.totalCostCents / 100;
  const budget = costs.budgetMonthlyCents != null ? costs.budgetMonthlyCents / 100 : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Custos e orçamentos (Hermes)"
        subtitle="Consumo oficial por agente/projeto, cobertura de apuração e limites de orçamento da força de trabalho."
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

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="nc-card rounded-2xl p-5 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Consumo total</div>
          <div className="mt-1.5 font-display text-3xl font-semibold font-mono tabular-nums text-accent">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: costs.currency || 'USD' }).format(totalUsd)}</div>
          <div className="mt-1 text-xs text-ink-muted">{costs.currency || 'USD'} · {costs.eventCount ?? '—'} eventos</div>
        </div>
        <div className="nc-card rounded-2xl p-5 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Orçamento mensal</div>
          <div className="mt-1.5 font-display text-3xl font-semibold font-mono tabular-nums text-ink">
            {budget != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: costs.currency || 'USD' }).format(budget) : 'Não informado'}
          </div>
          <div className="mt-1 text-xs text-ink-muted">
            Utilização: {budget != null ? ((totalUsd / budget) * 100).toFixed(1) : '—'}%
          </div>
        </div>
        <div className="nc-card rounded-2xl p-5 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Runs não precificados</div>
          <div className="mt-1.5 font-display text-3xl font-semibold font-mono tabular-nums text-highlight">
            {costs.dataQuality?.unpricedRunsCount ?? '—'}
          </div>
          <div className="mt-1 text-xs text-ink-muted">Cobertura: {costs.dataQuality?.coveragePercent != null ? costs.dataQuality.coveragePercent + '%' : '—'}</div>
        </div>
        <div className="nc-card rounded-2xl p-5 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Agentes com consumo</div>
          <div className="mt-1.5 font-display text-3xl font-semibold font-mono tabular-nums text-ink">{byAgent.length}</div>
          <div className="mt-1 text-xs text-ink-muted">Projetos: {byProject.length}</div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="nc-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-line bg-surface-subtle/40 flex items-center justify-between">
            <SectionTitle title="Consumo por agente" subtitle={byAgent.length > 0 ? 'Custo alocado por agente operacional' : undefined} />
          </div>
          <div className="divide-y divide-line p-6 overflow-y-auto max-h-[420px]">
            {byAgent.map((a) => (
              <div key={a.agentId} className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink truncate">{a.agentName}</div>
                  <div className="text-[11px] text-ink-muted">{a.model || '—'} · {a.runsCount ?? 0} run(s)</div>
                </div>
                <div className="font-mono text-ink tabular-nums">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: costs.currency || 'USD' }).format(a.costCents / 100)}
                </div>
              </div>
            ))}
            {byAgent.length === 0 && (
              <div className="py-8 text-center text-xs text-ink-subtle">Sem consumo por agente apurado.</div>
            )}
          </div>
        </div>

        <div className="nc-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-line bg-surface-subtle/40 flex items-center justify-between">
            <SectionTitle title="Consumo por projeto" subtitle={byProject.length > 0 ? 'Custo alocado por projeto operacional' : undefined} />
          </div>
          <div className="divide-y divide-line p-6 overflow-y-auto max-h-[420px]">
            {byProject.map((p) => (
              <div key={p.projectId} className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink truncate">{p.projectName}</div>
                  <div className="text-[11px] text-ink-muted">{p.issuesCount ?? 0} issue(s)</div>
                </div>
                <div className="font-mono text-ink tabular-nums">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: costs.currency || 'USD' }).format(p.costCents / 100)}
                </div>
              </div>
            ))}
            {byProject.length === 0 && (
              <div className="py-8 text-center text-xs text-ink-subtle">Sem consumo por projeto apurado.</div>
            )}
          </div>
        </div>
      </section>

      <p className="text-xs text-ink-subtle">
        Estes custos pertencem ao orçamento operacional do Hermes. Não confundir com o financeiro empresarial da TokenizAi.
      </p>
    </div>
  );
};
