import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  CreditCard,
  Download,
  FolderKanban,
  Wallet,
} from 'lucide-react';
import { PageHeader, SegmentedTabs, StatusText } from '../../components/ui/Primitives';
import { formatBRL, formatCents, formatDateBR } from '../../services/api';
import type { EnterpriseDataState, HermesOverviewBundle } from '../../types/platform';

interface ReportsViewProps {
  enterprise: EnterpriseDataState;
  hermes: HermesOverviewBundle;
  onToast: (msg: string) => void;
}

type ReportCategory =
  | 'Todos'
  | 'Executivos'
  | 'Financeiros'
  | 'Comerciais'
  | 'Projetos'
  | 'Clientes'
  | 'Assinaturas'
  | 'Operações de IA';

type ReportId =
  | 'exec-consolidado'
  | 'fin-fluxo'
  | 'com-pipeline'
  | 'prj-margem'
  | 'cli-receita'
  | 'sub-recorrencia'
  | 'ia-orcamento';

interface ReportDefinition {
  id: ReportId;
  category: Exclude<ReportCategory, 'Todos'>;
  title: string;
  purpose: string;
  period: string;
  updatedAt: string;
  icon: React.ComponentType<{ className?: string }>;
}

const REPORT_DEFS: ReportDefinition[] = [
  {
    id: 'exec-consolidado',
    category: 'Executivos',
    title: 'DRE & Saúde Executiva Consolidada',
    purpose: 'Receita por portfólio de ofertas, margem estimada e projeção mensal equivalente.',
    period: 'Novembro 2026',
    updatedAt: 'Hoje, 16:00',
    icon: BarChart3,
  },
  {
    id: 'fin-fluxo',
    category: 'Financeiros',
    title: 'Fluxo de Caixa & Centro de Custos',
    purpose: 'Comparativo de contas a receber vs contas a pagar por categoria operacional.',
    period: 'Novembro 2026',
    updatedAt: 'Hoje, 15:45',
    icon: Wallet,
  },
  {
    id: 'com-pipeline',
    category: 'Comerciais',
    title: 'Conversão & Valor Ponderado do Pipeline',
    purpose: 'Distribuição nominal e ponderada por estágio do funil de vendas B2B.',
    period: 'Ciclo Q4 2026',
    updatedAt: 'Hoje, 15:30',
    icon: Briefcase,
  },
  {
    id: 'prj-margem',
    category: 'Projetos',
    title: 'Rentabilidade & Desvio Orçamentário de Projetos',
    purpose: 'Orçado vs realizado, margem apurada e ritmo de conclusão de entregas.',
    period: 'Carteira Ativa',
    updatedAt: 'Hoje, 15:20',
    icon: FolderKanban,
  },
  {
    id: 'cli-receita',
    category: 'Clientes',
    title: 'Concentração de Receita & LTV por Cliente',
    purpose: 'Ranking de contas por MRR mensal e valor acumulado ao longo do contrato.',
    period: 'Base Atual',
    updatedAt: 'Hoje, 14:50',
    icon: Building2,
  },
  {
    id: 'sub-recorrencia',
    category: 'Assinaturas',
    title: 'Retenção, ARR & Risco de Inadimplência',
    purpose: 'Composição de receita recorrente por plano, ciclo e status de adimplência.',
    period: 'Competência Nov',
    updatedAt: 'Hoje, 14:30',
    icon: CreditCard,
  },
  {
    id: 'ia-orcamento',
    category: 'Operações de IA',
    title: 'Consumo Hermes & Eficiência por Agente',
    purpose: 'Utilização de teto mensal, tarefas ativas e custo por agente ou diretoria.',
    period: 'Dados reportados pelo runtime',
    updatedAt: 'Sincronizado agora',
    icon: Bot,
  },
];

export const ReportsView: React.FC<ReportsViewProps> = ({
  enterprise,
  hermes,
  onToast,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory>('Todos');
  const [activeReportId, setActiveReportId] = useState<ReportId | null>(null);
  const [periodParam, setPeriodParam] = useState<'nov-2026' | 'q4-2026' | 'anual-2026'>('nov-2026');
  const [subFilter, setSubFilter] = useState<string>('Todos');
  const [metricMode, setMetricMode] = useState<'principal' | 'comparativo'>('principal');

  // Grounded summary metrics for each report card
  const kpiMap = useMemo(() => {
    const productMonthly = enterprise.products.reduce(
      (acc, p) =>
        acc +
        (p.billingModel === 'Recorrente Mensal'
          ? p.priceBRL * p.activeClients
          : Math.round((p.priceBRL * p.activeClients) / 3)),
      0,
    );
    const receiv = enterprise.financeEntries.filter((f) => f.type === 'Receber').reduce((a, f) => a + f.amountBRL, 0);
    const payab = enterprise.financeEntries.filter((f) => f.type === 'Pagar').reduce((a, f) => a + f.amountBRL, 0);
    const weightedPipe = enterprise.deals
      .filter((d) => d.stage !== 'Ganho' && d.stage !== 'Perdido')
      .reduce((a, d) => a + (d.valueBRL * d.probability) / 100, 0);
    const avgMarginPct =
      enterprise.projects.length > 0
        ? Math.round(
            enterprise.projects.reduce((a, p) => a + ((p.budgetBRL - p.spentBRL) / Math.max(p.budgetBRL, 1)) * 100, 0) /
              enterprise.projects.length,
          )
        : 0;
    const totalLtv = enterprise.clients.reduce((a, c) => a + c.ltvBRL, 0);
    const activeMrr = enterprise.subscriptions
      .filter((s) => s.status === 'Ativa' || s.status === 'Em Teste')
      .reduce((a, s) => a + s.mrrBRL, 0);
    const isHermesConnected = hermes.status.configured && hermes.status.connected;
    const runtimeCurrency = hermes.costs?.currency || 'moeda não informada';
    const runtimeSpentCents = hermes.costs?.totalCostCents;

    return {
      'exec-consolidado': { kpiLabel: 'Receita Mensal Equiv.', kpiValue: formatBRL(productMonthly) },
      'fin-fluxo': { kpiLabel: 'Saldo do Ciclo', kpiValue: formatBRL(receiv - payab) },
      'com-pipeline': { kpiLabel: 'Pipeline Ponderado', kpiValue: formatBRL(weightedPipe) },
      'prj-margem': { kpiLabel: 'Margem Média Carteira', kpiValue: `${avgMarginPct}%` },
      'cli-receita': { kpiLabel: 'LTV Consolidado', kpiValue: formatBRL(totalLtv) },
      'sub-recorrencia': { kpiLabel: 'MRR Adimplente', kpiValue: formatBRL(activeMrr) },
      'ia-orcamento': {
        kpiLabel: isHermesConnected ? `Consumo Hermes (${runtimeCurrency})` : 'Status do runtime',
        kpiValue: !isHermesConnected
          ? hermes.status.connectionLabel
          : runtimeSpentCents == null
            ? 'Não reportado'
            : `${formatCents(runtimeSpentCents, runtimeCurrency)}${hermes.costs?.budgetMonthlyCents != null && hermes.costs.budgetMonthlyCents > 0 ? ` · ${Math.round((runtimeSpentCents / hermes.costs.budgetMonthlyCents) * 100)}% do orçamento` : ''}`, 
      },
    } satisfies Record<ReportId, { kpiLabel: string; kpiValue: string }>;
  }, [enterprise, hermes]);

  const visibleCards = useMemo(() => {
    if (categoryFilter === 'Todos') return REPORT_DEFS;
    return REPORT_DEFS.filter((r) => r.category === categoryFilter);
  }, [categoryFilter]);

  const activeDef = useMemo(
    () => REPORT_DEFS.find((r) => r.id === activeReportId) || null,
    [activeReportId],
  );

  // Build grounded chart + table rows for whichever report is open
  const reportData = useMemo(() => {
    if (!activeReportId) return null;
    const multiplier = periodParam === 'anual-2026' ? 12 : periodParam === 'q4-2026' ? 3 : 1;
    const periodLabel =
      periodParam === 'anual-2026' ? 'Projeção 12m' : periodParam === 'q4-2026' ? 'Trimestre (3m)' : 'Mensal (Nov/26)';

    if (activeReportId === 'exec-consolidado') {
      const cats = ['Todos', ...Array.from(new Set(enterprise.products.map((p) => p.category)))];
      const rows = enterprise.products
        .filter((p) => subFilter === 'Todos' || p.category === subFilter)
        .map((p) => {
          const monthly =
            p.billingModel === 'Recorrente Mensal'
              ? p.priceBRL * p.activeClients
              : Math.round((p.priceBRL * p.activeClients) / 3);
          const primary = monthly * multiplier;
          const secondary = Math.round((primary * p.marginPercent) / 100);
          return {
            id: p.id,
            label: p.name,
            meta: `${p.category} · ${p.activeClients} clientes`,
            primary,
            secondary,
            extra: `${p.marginPercent}% margem`,
          };
        });
      return {
        filterOptions: cats,
        primaryLabel: metricMode === 'principal' ? `Receita (${periodLabel})` : `Margem Bruta (${periodLabel})`,
        secondaryLabel: 'Lucro Estimado',
        rows,
      };
    }

    if (activeReportId === 'fin-fluxo') {
      const cats = ['Todos', 'Receber', 'Pagar'];
      const grouped = Array.from(new Set(enterprise.financeEntries.map((f) => f.category))).map((cat) => {
        const items = enterprise.financeEntries.filter(
          (f) => f.category === cat && (subFilter === 'Todos' || f.type === subFilter),
        );
        const rec = items.filter((f) => f.type === 'Receber').reduce((a, f) => a + f.amountBRL, 0);
        const pag = items.filter((f) => f.type === 'Pagar').reduce((a, f) => a + f.amountBRL, 0);
        return {
          id: cat,
          label: cat,
          meta: `${items.length} lançamento(s)`,
          primary: rec > 0 ? rec : pag,
          secondary: pag,
          extra: rec > 0 && pag > 0 ? `Saldo ${formatBRL(rec - pag)}` : rec > 0 ? 'Entrada' : 'Saída',
        };
      });
      return {
        filterOptions: cats,
        primaryLabel: 'Valor Consolidado',
        secondaryLabel: 'Saídas Comprometidas',
        rows: grouped.filter((r) => r.primary > 0 || r.secondary > 0),
      };
    }

    if (activeReportId === 'com-pipeline') {
      const stages = ['Todos', 'Prospecção', 'Qualificação', 'Proposta', 'Negociação', 'Ganho'];
      const rows = enterprise.deals
        .filter((d) => subFilter === 'Todos' || d.stage === subFilter)
        .map((d) => ({
          id: d.id,
          label: d.title,
          meta: `${d.clientName} · ${d.stage}`,
          primary: metricMode === 'principal' ? d.valueBRL : Math.round((d.valueBRL * d.probability) / 100),
          secondary: Math.round((d.valueBRL * d.probability) / 100),
          extra: `${d.probability}% prob. · ${formatDateBR(d.expectedClose)}`,
        }));
      return {
        filterOptions: stages,
        primaryLabel: metricMode === 'principal' ? 'Valor Nominal' : 'Valor Ponderado',
        secondaryLabel: 'Receita Ponderada',
        rows,
      };
    }

    if (activeReportId === 'prj-margem') {
      const stages = ['Todos', 'Descoberta', 'Em Execução', 'Revisão', 'Entregue'];
      const rows = enterprise.projects
        .filter((p) => subFilter === 'Todos' || p.stage === subFilter)
        .map((p) => {
          const margin = p.budgetBRL - p.spentBRL;
          const pct = p.budgetBRL > 0 ? Math.round((margin / p.budgetBRL) * 100) : 0;
          return {
            id: p.id,
            label: `${p.code} · ${p.name}`,
            meta: `${p.clientName} · ${p.ownerName}`,
            primary: metricMode === 'principal' ? p.budgetBRL : margin,
            secondary: p.spentBRL,
            extra: `${pct}% saldo · ${p.progress}% concluído`,
          };
        });
      return {
        filterOptions: stages,
        primaryLabel: metricMode === 'principal' ? 'Orçamento Aprovado' : 'Saldo Disponível',
        secondaryLabel: 'Realizado até Hoje',
        rows,
      };
    }

    if (activeReportId === 'cli-receita') {
      const statuses = ['Todos', 'Ativo', 'Em Implantação', 'Em Risco'];
      const rows = enterprise.clients
        .filter((c) => subFilter === 'Todos' || c.status === subFilter)
        .map((c) => ({
          id: c.id,
          label: c.name,
          meta: `${c.segment} · ${c.status}`,
          primary: metricMode === 'principal' ? c.ltvBRL : c.mrrBRL * multiplier,
          secondary: c.mrrBRL,
          extra: `${c.products.length} oferta(s) · Gestor ${c.accountManager}`,
        }));
      return {
        filterOptions: statuses,
        primaryLabel: metricMode === 'principal' ? 'LTV Acumulado' : `MRR (${periodLabel})`,
        secondaryLabel: 'MRR Mensal',
        rows,
      };
    }

    if (activeReportId === 'sub-recorrencia') {
      const statuses = ['Todos', 'Ativa', 'Inadimplente', 'Em Teste', 'Cancelada'];
      const rows = enterprise.subscriptions
        .filter((s) => subFilter === 'Todos' || s.status === subFilter)
        .map((s) => ({
          id: s.id,
          label: s.clientName,
          meta: `${s.planName} · ${s.cycle}`,
          primary: s.mrrBRL * multiplier,
          secondary: s.mrrBRL,
          extra: s.status === 'Inadimplente' ? `${s.status} (${s.overdueDays}d)` : s.status,
        }));
      return {
        filterOptions: statuses,
        primaryLabel: `Receita (${periodLabel})`,
        secondaryLabel: 'MRR Base',
        rows,
      };
    }

    // Os custos por agente vêm exclusivamente do resumo de custos informado pelo runtime Hermes.
    const agentCosts = hermes.costs?.byAgent || [];
    const agentNames = ['Todos', ...Array.from(new Set(agentCosts.map((item) => item.agentName)))];
    const rows = agentCosts
      .filter((item) => subFilter === 'Todos' || item.agentName === subFilter)
      .map((item) => ({
        id: item.agentId,
        label: item.agentName,
        meta: item.model || 'Modelo não informado',
        primary: item.costCents,
        secondary: item.runsCount ?? 0,
        extra: `${item.runsCount ?? '—'} execução(ões)`,
      }));
    const runtimeCurrency = hermes.costs?.currency || 'moeda não informada';
    return {
      filterOptions: agentNames,
      primaryLabel: `Consumo apurado (${runtimeCurrency})`,
      secondaryLabel: 'Execuções',
      rows,
    };
  }, [activeReportId, enterprise, hermes, periodParam, subFilter, metricMode]);

  const handleExportCSV = () => {
    if (activeDef && reportData) {
      const rows = [
        ['Relatorio', 'Item', 'Contexto', reportData.primaryLabel, reportData.secondaryLabel, 'Observacao'],
        ...reportData.rows.map((r) => [
          activeDef.title,
          r.label,
          r.meta,
          String(r.primary),
          String(r.secondary),
          r.extra,
        ]),
      ];
      const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tokenizai-${activeDef.id}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      onToast(`Relatório "${activeDef.title}" exportado em CSV.`);
      return;
    }

    const rows = [
      ['Tipo', 'Referencia', 'Cliente_ou_Area', 'Valor_BRL', 'Status'],
      ...enterprise.financeEntries.map((f) => [
        f.type,
        f.description,
        f.counterparty,
        String(f.amountBRL),
        f.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tokenizai-consolidado-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Base consolidada exportada em CSV.');
  };

  // DETAIL REPORT VIEW
  if (activeDef && reportData) {
    const isHermesCostReport = activeDef.id === 'ia-orcamento';
    const runtimeCurrency = hermes.costs?.currency || 'moeda não informada';
    const formatMetricValue = (val: number) =>
      isHermesCostReport ? formatCents(val, runtimeCurrency) : formatBRL(val);
    const formatSecondaryValue = (val: number) =>
      isHermesCostReport ? new Intl.NumberFormat('pt-BR').format(val) : formatMetricValue(val);
    const maxVal = Math.max(...reportData.rows.map((r) => Math.max(r.primary, r.secondary)), 1);
    const totalPrimary = reportData.rows.reduce((a, r) => a + r.primary, 0);
    const totalSecondary = reportData.rows.reduce((a, r) => a + r.secondary, 0);

    return (
      <div className="space-y-6">
        <PageHeader
          title={activeDef.title}
          subtitle={`${activeDef.category} · ${activeDef.purpose}`}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setActiveReportId(null);
                  setSubFilter('Todos');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-subtle text-xs font-semibold text-ink cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Central de relatórios</span>
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="nc-primary-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </button>
            </>
          }
        />

        {/* Interactive Parameters Bar */}
        <section className="nc-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[11px] font-medium text-ink-subtle mb-1">Período de referência</label>
              <select
                value={periodParam}
                onChange={(e) => setPeriodParam(e.target.value as typeof periodParam)}
                className="px-3 py-1.5 rounded-lg border border-line-strong bg-canvas text-xs font-medium text-ink"
              >
                <option value="nov-2026">Mensal (Novembro 2026)</option>
                <option value="q4-2026">Trimestre (Q4 2026)</option>
                <option value="anual-2026">Anualizado (12 meses)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-subtle mb-1">Segmento / Filtro</label>
              <select
                value={subFilter}
                onChange={(e) => setSubFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-line-strong bg-canvas text-xs font-medium text-ink"
              >
                {reportData.filterOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-subtle mb-1">Visão da métrica</label>
              <SegmentedTabs
                active={metricMode}
                onChange={setMetricMode}
                tabs={[
                  { id: 'principal', label: 'Base Principal' },
                  { id: 'comparativo', label: 'Realizado / Ponderado' },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-6 text-right">
            <div>
              <div className="text-[11px] text-ink-subtle">{reportData.primaryLabel}</div>
              <div className="font-display text-lg font-semibold font-mono tabular-nums text-ink">
                {formatMetricValue(totalPrimary)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-ink-subtle">{reportData.secondaryLabel}</div>
              <div className="font-display text-lg font-semibold font-mono tabular-nums text-highlight">
                {formatSecondaryValue(totalSecondary)}
              </div>
            </div>
          </div>
        </section>

        {/* Visual Analytical Chart */}
        <section className="rounded-2xl nc-glow-panel p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">
                Distribuição Comparativa
              </h2>
              <p className="text-xs text-ink-subtle">
                {reportData.primaryLabel} versus {reportData.secondaryLabel} ({reportData.rows.length} registros)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 dark:bg-cyan-400 inline-block" />
                {reportData.primaryLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 dark:bg-amber-400 inline-block" />
                {reportData.secondaryLabel}
              </span>
            </div>
          </div>

          <div className="space-y-3.5">
            {reportData.rows.map((row) => (
              <div key={row.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-ink truncate">{row.label}</span>
                  <span className="font-mono tabular-nums text-ink-muted shrink-0">
                    {formatMetricValue(row.primary)}{' '}
                    <span className="text-ink-subtle">/ {formatSecondaryValue(row.secondary)}</span>
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="h-2.5 w-full rounded-full bg-surface-subtle overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all"
                      style={{ width: `${Math.max(3, (row.primary / maxVal) * 100)}%` }}
                    />
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-subtle/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500 dark:bg-amber-400 transition-all"
                      style={{ width: `${Math.max(2, (row.secondary / maxVal) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {reportData.rows.length === 0 && (
              <div className="py-6 text-center text-xs text-ink-subtle">
                {isHermesCostReport
                  ? `Nenhum custo por agente foi reportado pelo runtime Hermes (${hermes.status.connectionLabel}).`
                  : 'Nenhum registro encontrado para os filtros selecionados.'}
              </div>
            )}
          </div>
        </section>

        {/* Supporting Table */}
        <section className="rounded-2xl nc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-[11px] font-semibold text-ink-subtle bg-surface-subtle/40">
                  <th className="py-3 px-6">Item</th>
                  <th className="py-3 px-4">Contexto</th>
                  <th className="py-3 px-4 text-right">{reportData.primaryLabel}</th>
                  <th className="py-3 px-4 text-right">{reportData.secondaryLabel}</th>
                  <th className="py-3 px-6 text-right">Indicador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {reportData.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-blue/35 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-ink">{row.label}</td>
                    <td className="py-3.5 px-4 text-xs text-ink-muted">{row.meta}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs font-semibold tabular-nums text-ink">
                      {formatMetricValue(row.primary)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-ink-muted">
                      {formatSecondaryValue(row.secondary)}
                    </td>
                    <td className="py-3.5 px-6 text-right text-xs text-ink-subtle whitespace-nowrap">
                      {row.extra}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // HUB VIEW: Interactive Cards for all 7 Categories
  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Relatórios Gerenciais"
        subtitle="Selecione um relatório por área para analisar gráficos comparativos, ajustar parâmetros e exportar dados."
        actions={
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-subtle text-xs font-semibold text-ink transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar consolidado CSV</span>
          </button>
        }
      />

      <SegmentedTabs
        active={categoryFilter}
        onChange={setCategoryFilter}
        tabs={[
          { id: 'Todos', label: 'Todos', count: REPORT_DEFS.length },
          { id: 'Executivos', label: 'Executivos' },
          { id: 'Financeiros', label: 'Financeiros' },
          { id: 'Comerciais', label: 'Comerciais' },
          { id: 'Projetos', label: 'Projetos' },
          { id: 'Clientes', label: 'Clientes' },
          { id: 'Assinaturas', label: 'Assinaturas' },
          { id: 'Operações de IA', label: 'Operações de IA' },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleCards.map((rep) => {
          const Icon = rep.icon;
          const kpi = kpiMap[rep.id];
          return (
            <button
              key={rep.id}
              type="button"
              onClick={() => {
                setActiveReportId(rep.id);
                setSubFilter('Todos');
                setMetricMode('principal');
              }}
              className="nc-card rounded-2xl p-5 text-left cursor-pointer flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent dark:text-cyan-300">
                    <Icon className="w-4 h-4" />
                    <span>{rep.category}</span>
                  </span>
                  <StatusText label={rep.period} tone="neutral" />
                </div>

                <div>
                  <h3 className="font-display text-base font-semibold text-ink leading-snug">
                    {rep.title}
                  </h3>
                  <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">
                    {rep.purpose}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-line">
                <div className="flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl bg-surface-subtle/60 border border-line">
                  <span className="text-xs text-ink-subtle">{kpi.kpiLabel}</span>
                  <span className="font-mono text-sm font-semibold text-highlight tabular-nums">
                    {kpi.kpiValue}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-subtle">Atualizado: {rep.updatedAt}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-accent dark:text-cyan-300">
                    <span>Abrir análise</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
