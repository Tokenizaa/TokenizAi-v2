import React, { useMemo } from 'react';
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  CircleAlert,
  FolderKanban,
  Package,
  Workflow,
} from 'lucide-react';
import { PageHeader, StatusText } from '../../components/ui/Primitives';
import type { NavSectionId, PaperclipOverviewBundle } from '../../types/platform';

interface ExecutiveViewProps {
  paperclip: PaperclipOverviewBundle;
  onNavigate: (section: NavSectionId) => void;
}

type Priority = {
  id: string;
  area: string;
  title: string;
  detail: string;
  tone: 'critical' | 'attention' | 'nominal';
  statusLabel: string;
  target: NavSectionId;
};

const OWNED_PRODUCTS = [
  {
    name: 'AdeusMultas',
    description: 'Defesa de multas, recursos e serviços relacionados à CNH.',
    focus: 'Produto próprio',
  },
  {
    name: 'DefesaI Saúde',
    description: 'Jornada digital de defesa dos beneficiários de planos de saúde.',
    focus: 'Produto próprio',
  },
  {
    name: 'Beleza Digital',
    description: 'Soluções digitais para salões, barbearias e negócios de beleza.',
    focus: 'Produto próprio',
  },
];

export const ExecutiveView: React.FC<ExecutiveViewProps> = ({
  paperclip,
  onNavigate,
}) => {
  const connectionReady =
    paperclip.status.configured &&
    paperclip.status.reachable &&
    paperclip.status.authenticated;

  const operationalMetrics = useMemo(() => {
    const activeAgents = paperclip.agents.filter((agent) =>
      ['active', 'running', 'idle'].includes(agent.status.toLowerCase()),
    ).length;
    const openTasks = paperclip.issues.filter(
      (issue) => !['done', 'completed', 'cancelled', 'canceled'].includes(issue.status.toLowerCase()),
    ).length;
    const blockedTasks = paperclip.issues.filter(
      (issue) => issue.status === 'blocked' || (issue.unresolvedBlockerCount ?? 0) > 0,
    ).length;
    const pendingApprovals = paperclip.approvals.filter(
      (approval) => approval.status === 'pending',
    ).length;
    return { activeAgents, openTasks, blockedTasks, pendingApprovals };
  }, [paperclip]);

  const priorities = useMemo(() => {
    const items: Priority[] = [];

    for (const issue of paperclip.issues) {
      if (issue.status === 'blocked' || (issue.unresolvedBlockerCount ?? 0) > 0) {
        items.push({
          id: `blocked-${issue.id}`,
          area: 'Operações de IA',
          title: `${issue.identifier || 'Tarefa'} · ${issue.title}`,
          detail: issue.blockerReason || `Responsável: ${issue.assigneeAgentName || 'Não atribuído'}`,
          tone: 'critical',
          statusLabel: 'Bloqueado',
          target: 'ia-tarefas',
        });
      }
    }

    for (const approval of paperclip.approvals) {
      if (approval.status === 'pending') {
        items.push({
          id: `approval-${approval.id}`,
          area: 'Governança',
          title: approval.title,
          detail: approval.requestedByName
            ? `Solicitado por ${approval.requestedByName}`
            : 'Aguardando decisão humana',
          tone: 'attention',
          statusLabel: 'Aguardando decisão',
          target: 'ia-aprovacoes',
        });
      }
    }

    return items.slice(0, 7);
  }, [paperclip]);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Cockpit executivo"
        subtitle="A empresa, o portfólio de produtos e a operação de agentes em uma única visão."
        actions={
          <button
            type="button"
            onClick={() => onNavigate('ia-visao')}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-surface-subtle"
          >
            <Workflow className="h-4 w-4" />
            Ver operação
          </button>
        }
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo operacional">
        <button
          type="button"
          onClick={() => onNavigate('ia-agentes')}
          className="nc-card rounded-xl p-4 text-left"
        >
          <div className="flex items-center justify-between text-xs text-ink-subtle">
            <span>Agentes em atividade</span>
            <Bot className="h-4 w-4" />
          </div>
          <p className="mt-3 font-display text-2xl font-semibold tabular-nums text-ink">
            {connectionReady ? operationalMetrics.activeAgents : '—'}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {connectionReady ? 'Estado reportado pelo Paperclip' : 'Aguardando conexão Paperclip'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('ia-tarefas')}
          className="nc-card rounded-xl p-4 text-left"
        >
          <div className="flex items-center justify-between text-xs text-ink-subtle">
            <span>Tarefas em aberto</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <p className="mt-3 font-display text-2xl font-semibold tabular-nums text-ink">
            {connectionReady ? operationalMetrics.openTasks : '—'}
          </p>
          <p className="mt-1 text-xs text-ink-muted">Fila operacional do Paperclip</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('ia-tarefas')}
          className="nc-card rounded-xl p-4 text-left"
        >
          <div className="flex items-center justify-between text-xs text-ink-subtle">
            <span>Bloqueios operacionais</span>
            <CircleAlert className="h-4 w-4" />
          </div>
          <p className="mt-3 font-display text-2xl font-semibold tabular-nums text-ink">
            {connectionReady ? operationalMetrics.blockedTasks : '—'}
          </p>
          <p className="mt-1 text-xs text-ink-muted">Itens que exigem desbloqueio</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('ia-aprovacoes')}
          className="nc-card rounded-xl p-4 text-left"
        >
          <div className="flex items-center justify-between text-xs text-ink-subtle">
            <span>Decisões pendentes</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <p className="mt-3 font-display text-2xl font-semibold tabular-nums text-ink">
            {connectionReady ? operationalMetrics.pendingApprovals : '—'}
          </p>
          <p className="mt-1 text-xs text-ink-muted">Aguardando supervisão humana</p>
        </button>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">Estratégia atual</div>
            <h2 className="mt-1 font-display text-lg font-semibold text-ink">Portfólio próprio</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Primeiro, usamos nossa estrutura para fortalecer e escalar nossos próprios produtos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('produtos')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            Gestão de produtos <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {OWNED_PRODUCTS.map((product) => (
            <button
              key={product.name}
              type="button"
              onClick={() => onNavigate('produtos')}
              className="nc-card group rounded-xl p-4 text-left transition-colors hover:border-line-strong"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-subtle text-ink-muted">
                  <Package className="h-4 w-4" />
                </div>
                <span className="rounded-full bg-surface-subtle px-2 py-1 text-[10px] font-medium text-ink-subtle">
                  {product.focus}
                </span>
              </div>
              <h3 className="mt-4 font-display text-base font-semibold text-ink">{product.name}</h3>
              <p className="mt-1 min-h-10 text-xs leading-relaxed text-ink-muted">{product.description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent">
                Abrir portfólio <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="nc-card overflow-hidden rounded-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-display text-sm font-semibold text-ink">Fila de atenção executiva</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Bloqueios, aprovações e entregas que precisam de acompanhamento.
              </p>
            </div>
            <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-[11px] font-medium tabular-nums text-ink-muted">
              {priorities.length} itens
            </span>
          </div>

          {priorities.length > 0 ? (
            <div className="divide-y divide-line">
              {priorities.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.target)}
                  className="flex w-full flex-col gap-2 px-5 py-3.5 text-left transition-colors hover:bg-surface-subtle sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">{item.area}</span>
                    <span className="mt-1 block truncate text-sm font-medium text-ink">{item.title}</span>
                    <span className="mt-1 block truncate text-xs text-ink-muted">{item.detail}</span>
                  </span>
                  <span className="shrink-0">
                    <StatusText label={item.statusLabel} tone={item.tone} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-ink-subtle" />
              <p className="mt-3 text-sm font-medium text-ink">Nenhum item crítico identificado</p>
              <p className="mt-1 text-xs text-ink-muted">
                {connectionReady
                  ? 'A fila de atenção não apresenta bloqueios ou aprovações pendentes.'
                  : 'Conecte o Paperclip para carregar os sinais operacionais.'}
              </p>
            </div>
          )}
        </div>

        <aside className="nc-card rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold text-ink">Central de operação</h2>
            <span className={`h-2 w-2 rounded-full ${connectionReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {connectionReady
              ? `Conectado a ${paperclip.status.companyName || 'Paperclip'}.`
              : `Paperclip: ${paperclip.status.connectionLabel}.`}
          </p>
          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => onNavigate('ia-chat')}
              className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2.5 text-xs font-medium text-ink transition-colors hover:bg-surface-subtle"
            >
              Comunicação com agentes <ArrowUpRight className="h-3.5 w-3.5 text-ink-subtle" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ia-equipes')}
              className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2.5 text-xs font-medium text-ink transition-colors hover:bg-surface-subtle"
            >
              Estrutura organizacional <ArrowUpRight className="h-3.5 w-3.5 text-ink-subtle" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ia-rotinas')}
              className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2.5 text-xs font-medium text-ink transition-colors hover:bg-surface-subtle"
            >
              Rotinas e automações <ArrowUpRight className="h-3.5 w-3.5 text-ink-subtle" />
            </button>
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-xs font-medium text-ink">Projetos e entregas</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Acompanhe o desenvolvimento dos produtos e os vínculos operacionais com o Paperclip.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('projetos')}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              Acompanhar entregas <FolderKanban className="h-3.5 w-3.5" />
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
};
