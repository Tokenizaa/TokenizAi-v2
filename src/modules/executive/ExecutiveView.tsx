import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Bot, Building2, FolderKanban, Wallet } from 'lucide-react';
import { PageHeader, StatusText } from '../../components/ui/Primitives';
import { formatBRL } from '../../services/api';
import type {
  EnterpriseDataState,
  NavSectionId,
  PaperclipOverviewBundle,
} from '../../types/platform';

interface ExecutiveViewProps {
  enterprise: EnterpriseDataState;
  paperclip: PaperclipOverviewBundle;
  onNavigate: (section: NavSectionId) => void;
}

const MONTHLY_SERIES = [
  { month: 'Jun', receita: 112000, despesa: 78000, mrr: 68400 },
  { month: 'Jul', receita: 124500, despesa: 81200, mrr: 72100 },
  { month: 'Ago', receita: 131000, despesa: 84900, mrr: 76500 },
  { month: 'Set', receita: 146800, despesa: 89300, mrr: 81200 },
  { month: 'Out', receita: 158200, despesa: 91800, mrr: 84900 },
  { month: 'Nov', receita: 171400, despesa: 97350, mrr: 87600 },
];

export const ExecutiveView: React.FC<ExecutiveViewProps> = ({
  enterprise,
  paperclip,
  onNavigate,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const metrics = useMemo(() => {
    const activeMrr = enterprise.subscriptions
      .filter((s) => s.status === 'Ativa' || s.status === 'Em Teste')
      .reduce((acc, s) => acc + s.mrrBRL, 0);

    const overdueMrr = enterprise.subscriptions
      .filter((s) => s.status === 'Inadimplente')
      .reduce((acc, s) => acc + s.mrrBRL, 0);

    const inflow = enterprise.financeEntries
      .filter((f) => f.type === 'Receber' && f.status !== 'Em Atraso')
      .reduce((acc, f) => acc + f.amountBRL, 0);

    const outflow = enterprise.financeEntries
      .filter((f) => f.type === 'Pagar')
      .reduce((acc, f) => acc + f.amountBRL, 0);

    const weightedPipeline = enterprise.deals
      .filter((d) => d.stage !== 'Ganho' && d.stage !== 'Perdido')
      .reduce((acc, d) => acc + (d.valueBRL * d.probability) / 100, 0);

    const activeProjects = enterprise.projects.filter((p) => p.stage !== 'Entregue').length;

    return {
      activeMrr,
      overdueMrr,
      netCash: inflow - outflow,
      weightedPipeline,
      activeProjects,
    };
  }, [enterprise]);

  const priorities = useMemo(() => {
    const items: Array<{
      id: string;
      area: string;
      title: string;
      detail: string;
      tone: 'critical' | 'attention' | 'nominal';
      statusLabel: string;
      target: NavSectionId;
    }> = [];

    for (const sub of enterprise.subscriptions) {
      if (sub.status === 'Inadimplente') {
        items.push({
          id: `prio-sub-${sub.id}`,
          area: 'Assinaturas',
          title: `Fatura em aberto — ${sub.clientName}`,
          detail: `${sub.overdueDays} dias de atraso · ${formatBRL(sub.mrrBRL)}`,
          tone: 'critical',
          statusLabel: 'Inadimplente',
          target: 'assinaturas',
        });
      }
    }

    for (const issue of paperclip.issues) {
      if (issue.status === 'blocked' || (issue.unresolvedBlockerCount ?? 0) > 0) {
        items.push({
          id: `prio-pc-${issue.id}`,
          area: 'Operações de IA',
          title: `${issue.identifier || 'Task'} · ${issue.title}`,
          detail: issue.blockerReason || `Responsável: ${issue.assigneeAgentName || 'Sem agente'}`,
          tone: 'critical',
          statusLabel: 'Bloqueio Paperclip',
          target: 'ia-tarefas',
        });
      }
    }

    for (const approval of paperclip.approvals) {
      if (approval.status === 'pending') {
        items.push({
          id: `prio-app-${approval.id}`,
          area: 'Aprovações IA',
          title: approval.title,
          detail: approval.requestedByName
            ? `Solicitado por ${approval.requestedByName}`
            : 'Aguardando decisão humana no Paperclip',
          tone: 'attention',
          statusLabel: 'Aguardando aprovação',
          target: 'ia-aprovacoes',
        });
      }
    }

    for (const deal of enterprise.deals) {
      if (deal.stage === 'Negociação') {
        items.push({
          id: `prio-deal-${deal.id}`,
          area: 'Comercial',
          title: `${deal.title} — ${deal.clientName}`,
          detail: `${formatBRL(deal.valueBRL)} · ${deal.nextStep}`,
          tone: 'attention',
          statusLabel: `${deal.probability}% prob.`,
          target: 'comercial',
        });
      }
    }

    for (const proj of enterprise.projects) {
      if (proj.stage === 'Revisão') {
        items.push({
          id: `prio-prj-${proj.id}`,
          area: 'Projetos',
          title: `${proj.code} · ${proj.name}`,
          detail: `${proj.clientName} · ${proj.progress}% concluído`,
          tone: 'nominal',
          statusLabel: 'Em revisão',
          target: 'projetos',
        });
      }
    }

    return items.slice(0, 6);
  }, [enterprise, paperclip]);

  const maxChartVal = 190000;
  const chartHeight = 190;
  const chartWidth = 560;
  const xStep = chartWidth / (MONTHLY_SERIES.length - 1);

  const buildPolyline = (key: 'receita' | 'despesa' | 'mrr') =>
    MONTHLY_SERIES.map((d, i) => {
      const x = i * xStep;
      const y = chartHeight - (d[key] / maxChartVal) * (chartHeight - 20) - 10;
      return `${x},${y}`;
    }).join(' ');

  return (
    <div className="space-y-8">
      <PageHeader
        title="Visão Executiva"
        subtitle="Panorama consolidado de receita, caixa, entregas em curso e operação assistida pelo Paperclip."
        actions={
          <button
            type="button"
            onClick={() => onNavigate('relatorios')}
            className="nc-card px-4 py-2 rounded-lg text-xs font-semibold text-ink cursor-pointer"
          >
            Central de relatórios
          </button>
        }
      />

      {/* 4 Interactive Executive Cards */}
      <section aria-label="Indicadores executivos principais" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('assinaturas')}
          className="nc-card rounded-2xl p-5 text-left cursor-pointer space-y-2"
        >
          <div className="flex items-center justify-between gap-2 text-xs text-ink-subtle">
            <span>Receita Recorrente (MRR)</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
          </div>
          <div className="font-display text-2xl font-semibold text-ink font-mono tabular-nums">
            {formatBRL(metrics.activeMrr)}
          </div>
          <div
            className={`text-xs font-medium tabular-nums ${
              metrics.overdueMrr > 0 ? 'text-highlight' : 'text-ink-muted'
            }`}
          >
            {metrics.overdueMrr > 0
              ? `${formatBRL(metrics.overdueMrr)} em inadimplência`
              : 'Carteira 100% adimplente'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('financeiro')}
          className="nc-card rounded-2xl p-5 text-left cursor-pointer space-y-2"
        >
          <div className="flex items-center justify-between gap-2 text-xs text-ink-subtle">
            <span>Saldo Projetado (Nov)</span>
            <Wallet className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
          </div>
          <div className="font-display text-2xl font-semibold text-ink font-mono tabular-nums">
            {formatBRL(metrics.netCash)}
          </div>
          <div className="text-xs text-ink-muted">
            Recebimentos vs obrigações do mês
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('comercial')}
          className="nc-card rounded-2xl p-5 text-left cursor-pointer space-y-2"
        >
          <div className="flex items-center justify-between gap-2 text-xs text-ink-subtle">
            <span>Pipeline Ponderado</span>
            <Building2 className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
          </div>
          <div className="font-display text-2xl font-semibold text-ink font-mono tabular-nums">
            {formatBRL(metrics.weightedPipeline)}
          </div>
          <div className="text-xs text-ink-muted tabular-nums">
            <span className="text-highlight font-semibold">
              {enterprise.deals.filter((d) => d.stage !== 'Ganho' && d.stage !== 'Perdido').length}
            </span>{' '}
            negociações abertas no funil
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('projetos')}
          className="nc-card rounded-2xl p-5 text-left cursor-pointer space-y-2"
        >
          <div className="flex items-center justify-between gap-2 text-xs text-ink-subtle">
            <span>Projetos & Operação IA</span>
            <FolderKanban className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
          </div>
          <div className="font-display text-2xl font-semibold text-ink font-mono tabular-nums">
            {metrics.activeProjects} ativos
          </div>
          <div className="text-xs text-ink-muted tabular-nums">
            {paperclip.status.configured &&
            paperclip.status.reachable &&
            paperclip.status.authenticated
              ? `${paperclip.agents.filter((a) => ['active', 'running', 'idle'].includes(a.status.toLowerCase())).length} agentes ativos no Paperclip`
              : `Paperclip: ${paperclip.status.connectionLabel}`}
          </div>
        </button>
      </section>

      {/* Main Split: Luminous Financial Chart + Operational Automations Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-8 rounded-2xl nc-glow-panel p-6 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">
                Evolução de Receita, MRR e Despesas
              </h2>
              <p className="text-xs text-ink-subtle mt-0.5">
                Últimos 6 meses consolidados em reais (R$)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-blue-600 dark:bg-blue-400 inline-block" />
                Receita Total
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-cyan-500 inline-block" />
                MRR
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-amber-500 dark:bg-amber-400 inline-block" />
                Despesas
              </span>
            </div>
          </div>

          <div className="mt-6 relative">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight + 28}`}
              className="w-full h-52 overflow-visible"
              role="img"
              aria-label="Gráfico de evolução financeira de junho a novembro"
            >
              {[0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = chartHeight - ratio * (chartHeight - 20) - 10;
                return (
                  <line
                    key={ratio}
                    x1={0}
                    y1={y}
                    x2={chartWidth}
                    y2={y}
                    stroke="currentColor"
                    className="text-ink-subtle/15"
                    strokeDasharray="3 4"
                  />
                );
              })}

              <polyline
                fill="none"
                stroke="#f59e0b"
                strokeOpacity="0.85"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={buildPolyline('despesa')}
              />
              <polyline
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={buildPolyline('mrr')}
              />
              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={buildPolyline('receita')}
              />

              {MONTHLY_SERIES.map((pt, i) => {
                const x = i * xStep;
                const yRec = chartHeight - (pt.receita / maxChartVal) * (chartHeight - 20) - 10;
                return (
                  <g
                    key={pt.month}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  >
                    <rect x={x - 24} y={0} width={48} height={chartHeight + 24} fill="transparent" />
                    <circle
                      cx={x}
                      cy={yRec}
                      r={hoveredIdx === i ? 5 : 3.5}
                      className="fill-blue-600 dark:fill-cyan-300"
                    />
                    <text
                      x={x}
                      y={chartHeight + 20}
                      textAnchor="middle"
                      className="fill-current text-ink-subtle text-[11px] font-mono"
                    >
                      {pt.month}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hoveredIdx !== null && (
              <div className="mt-2 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums">
                <span className="font-semibold text-highlight">
                  Competência {MONTHLY_SERIES[hoveredIdx].month}/2026
                </span>
                <div className="flex items-center gap-4 text-ink-muted">
                  <span>Receita: {formatBRL(MONTHLY_SERIES[hoveredIdx].receita)}</span>
                  <span>MRR: {formatBRL(MONTHLY_SERIES[hoveredIdx].mrr)}</span>
                  <span>Despesas: {formatBRL(MONTHLY_SERIES[hoveredIdx].despesa)}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="lg:col-span-4 rounded-2xl nc-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-ink inline-flex items-center gap-2">
                <Bot className="w-4 h-4 text-accent dark:text-cyan-300" />
                <span>Operação Paperclip</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('ia-visao')}
                className="text-xs font-semibold text-accent dark:text-cyan-300 hover:underline cursor-pointer"
              >
                Abrir painel IA
              </button>
            </div>
            <p className="text-xs text-ink-subtle mt-1">
              {paperclip.status.configured &&
              paperclip.status.reachable &&
              paperclip.status.authenticated
                ? `Conectado a ${paperclip.status.companyName || 'instância Paperclip'}`
                : `${paperclip.status.connectionLabel} — painel empresarial operando normalmente`}
            </p>

            {paperclip.status.configured &&
            paperclip.status.reachable &&
            paperclip.status.authenticated ? (
              <div className="mt-5 space-y-2.5">
                {paperclip.routines.slice(0, 3).map((routine) => (
                  <button
                    key={routine.id}
                    type="button"
                    onClick={() => onNavigate('ia-rotinas')}
                    className="w-full text-left p-3 rounded-xl bg-surface-subtle/60 hover:bg-surface-blue/60 border border-line transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-ink truncate">{routine.name}</span>
                      <StatusText
                        label={routine.enabled !== false ? 'Ativa' : 'Pausada'}
                        tone={routine.enabled !== false ? 'nominal' : 'neutral'}
                      />
                    </div>
                    <div className="text-[11px] text-ink-subtle mt-1 truncate">
                      {routine.agentName || 'Paperclip'} · {routine.triggers.length} trigger(s)
                    </div>
                  </button>
                ))}
                {paperclip.routines.length === 0 && (
                  <div className="p-3 rounded-xl bg-surface-subtle/50 border border-line text-xs text-ink-subtle">
                    Nenhuma rotina cadastrada no Paperclip até o momento.
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 space-y-2.5">
                <div className="p-3.5 rounded-xl bg-surface-subtle/60 border border-line space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ink">Status da Integração</span>
                    <StatusText label={paperclip.status.connectionLabel} tone="attention" />
                  </div>
                  <p className="text-[11px] text-ink-subtle leading-relaxed">
                    Configure as variáveis de ambiente no servidor e valide a conexão em Administração &gt; Integrações para sincronizar agentes, chat, tasks e custos reais.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className="w-full text-left p-3 rounded-xl bg-surface-subtle/40 hover:bg-surface-blue/50 border border-line text-xs font-semibold text-accent dark:text-cyan-300 transition-colors cursor-pointer"
                >
                  Configurar & testar integração Paperclip →
                </button>
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-line flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => onNavigate('ia-chat')}
              className="text-ink-muted hover:text-ink font-medium cursor-pointer"
            >
              Chat & Diretoria ({paperclip.agents.length} agentes)
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ia-tarefas')}
              className="font-mono font-semibold text-highlight hover:underline cursor-pointer tabular-nums"
            >
              {paperclip.issues.length} tasks
            </button>
          </div>
        </section>
      </div>

      {/* Priority Action Queue — Soft hairline table */}
      <section className="rounded-2xl nc-card overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-4 bg-surface-subtle/35">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">
              Pontos de Atenção Imediata
            </h2>
            <p className="text-xs text-ink-subtle mt-0.5">
              Itens que exigem decisão executiva, cobrança ou desbloqueio operacional. Clique em qualquer linha para agir.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-highlight tabular-nums">
            {priorities.length} pendências
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line text-[11px] font-semibold text-ink-subtle bg-surface-subtle/30">
                <th className="py-2.5 px-6">Área</th>
                <th className="py-2.5 px-4">Item</th>
                <th className="py-2.5 px-4">Contexto</th>
                <th className="py-2.5 px-4">Situação</th>
                <th className="py-2.5 px-6 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-sm">
              {priorities.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onNavigate(item.target)}
                  className="hover:bg-surface-blue/40 transition-colors cursor-pointer"
                >
                  <td className="py-3.5 px-6 text-xs font-semibold text-ink-subtle whitespace-nowrap">
                    {item.area}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-ink">{item.title}</td>
                  <td className="py-3.5 px-4 text-xs text-ink-muted">{item.detail}</td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <StatusText label={item.statusLabel} tone={item.tone} />
                  </td>
                  <td className="py-3.5 px-6 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent dark:text-cyan-300">
                      <span>Abrir</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
