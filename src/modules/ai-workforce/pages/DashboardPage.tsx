import React, { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, ListTodo, Activity, Bot } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import {
  CollectionToolbar,
  SectionTitle,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components';
import { paperclipService, isPaperclipConnected } from '../services/paperclip';
import type { PaperclipAgentDto, PaperclipIntegrationStatus, PaperclipIssueDto, PaperclipRunDto } from '../../../types/platform';

interface DashboardPageProps {
  onRefresh: () => Promise<void>;
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

const statusTone = (st: string) => {
  const s = st.toLowerCase();
  if (s === 'running' || s === 'active' || s === 'idle' || s === 'ready') return 'nominal';
  if (s === 'error' || s === 'failed' || s === 'terminated') return 'critical';
  return 'attention';
};

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onRefresh,
  onNavigate,
  onToast,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<{
    status: PaperclipIntegrationStatus | null;
    agents: PaperclipAgentDto[];
    issues: PaperclipIssueDto[];
    runs: PaperclipRunDto[];
    projects: any[];
    goals: any[];
    approvals: any[];
    routines: any[];
    costs: any;
    activity: any[];
  } | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bundleRes, dashRes] = await Promise.allSettled([
        paperclipService.getOverviewBundle(),
        paperclipService.getDashboard(),
      ]);
      if (bundleRes.status === 'fulfilled') {
        setBundle({
          status: bundleRes.value.status || null,
          agents: bundleRes.value.agents || [],
          issues: bundleRes.value.issues || [],
          runs: bundleRes.value.runs || [],
          projects: bundleRes.value.projects || [],
          goals: bundleRes.value.goals || [],
          approvals: bundleRes.value.approvals || [],
          routines: bundleRes.value.routines || [],
          costs: bundleRes.value.costs || null,
          activity: bundleRes.value.activity || [],
        });
      }
      if (dashRes.status === 'fulfilled') setDashboard(dashRes.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar o dashboard operacional.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const agents = bundle?.agents ?? [];
  const issues = bundle?.issues ?? [];
  const runs = bundle?.runs ?? [];
  const costs = bundle?.costs;
  const pendingApprovals = (bundle?.approvals ?? []).filter((a) => a.status === 'pending').length;
  const blockedIssues = issues.filter((i) => i.status === 'blocked').length;
  const openIssues = issues.filter((i) => i.status !== 'done' && i.status !== 'cancelled').length;
  const runningAgents = agents.filter((a) => a.status === 'running').length;

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar o dashboard" message={error} onRetry={load} />;
  if (!bundle) return <EmptyState title="Sem dados do Paperclip" description="Nenhum pacote de visão geral disponível." />;

  const dAgents = dashboard?.agents ?? { active: agents.length, running: runningAgents, paused: 0, error: 0 };
  const dTasks = dashboard?.tasks ?? { open: openIssues, inProgress: 0, blocked: blockedIssues, done: 0 };
  const dCosts = dashboard?.costs ?? { monthSpendCents: costs?.totalCostCents ?? 0, monthBudgetCents: costs?.budgetMonthlyCents ?? 0, monthUtilizationPercent: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard operacional — Força de trabalho IA"
        subtitle="Indicadores da instância Paperclip conectada (TokenizAi). Todos os números vêm da API operacional (endpoint /companies/{id}/dashboard)."
        actions={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> <span>Sincronizar</span>
          </button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="nc-card rounded-2xl p-5 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Agentes operacionais</div>
          <div className="mt-1.5 font-display text-3xl font-semibold font-mono tabular-nums text-ink">{agents.length}</div>
          <div className="mt-1 text-xs text-ink-muted">
            {dAgents.running} em execução · {dAgents.paused} pausado(s) · {dAgents.error} com erro
          </div>
        </div>
        <div className="nc-card rounded-2xl p-5 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Tarefas abertas</div>
          <div className="mt-1.5 font-display text-3xl font-semibold font-mono tabular-nums text-ink">{dTasks.open}</div>
          <div className="mt-1 text-xs text-ink-muted">{dTasks.blocked} bloqueada(s) · {dTasks.done} concluída(s)</div>
        </div>
        <div className="nc-card rounded-2xl p-5 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Aprovações pendentes</div>
          <div className="mt-1.5 font-display text-3xl font-semibold font-mono tabular-nums text-highlight">{pendingApprovals}</div>
          <div className="mt-1 text-xs text-ink-muted">Aguardando decisão humana</div>
        </div>
        <div className="nc-card rounded-2xl p-5 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Consumo do mês (USD)</div>
          <div className="mt-1.5 font-display text-3xl font-semibold font-mono tabular-nums text-accent">
            {(dCosts.monthSpendCents / 100).toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-ink-muted">
            Utilização: {dCosts.monthUtilizationPercent}% · {runs.length} execução(ões)
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="nc-card rounded-2xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-line bg-surface-subtle/40 flex items-center justify-between">
            <div>
              <div className="font-display text-base font-semibold text-ink">Tarefas em destaque</div>
              <div className="text-xs text-ink-subtle">Issues operacionais mais recentes do Paperclip</div>
            </div>
          </div>
          <div className="divide-y divide-line p-6 overflow-y-auto max-h-96">
            {issues.slice(0, 8).map((issue) => (
              <div key={issue.id} className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="font-mono text-accent dark:text-cyan-300 truncate">
                    {issue.identifier || issue.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink truncate">{issue.title}</div>
                    <div className="text-[10px] text-ink-subtle">
                      {issue.assigneeAgentName || 'Não atribuída'} · {issue.projectName || 'Sem projeto'}
                    </div>
                  </div>
                </div>
                <StatusBadge status={issue.status} size="sm" />
              </div>
            ))}
            {issues.length === 0 && (
              <div className="py-8 text-center text-xs text-ink-subtle">Nenhuma tarefa operacional encontrada.</div>
            )}
          </div>
        </div>

        <div className="nc-card rounded-2xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-line bg-surface-subtle/40 flex items-center justify-between">
            <div>
              <div className="font-display text-base font-semibold text-ink">Execuções recentes</div>
              <div className="text-xs text-ink-subtle">Runs e heartbeats dos agentes</div>
            </div>
          </div>
          <div className="divide-y divide-line p-6 overflow-y-auto max-h-96">
            {runs.slice(0, 8).map((run) => (
              <div key={run.id} className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="font-mono text-ink-muted truncate">{run.id.slice(0, 8)}…</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink truncate">
                      {run.agentName || 'Agente'} · {run.model || '—'}
                    </div>
                    <div className="text-[10px] text-ink-subtle">
                      {run.issueIdentifier || 'Sem issue'} · {run.status}
                    </div>
                  </div>
                </div>
                <StatusBadge status={run.status} size="sm" />
              </div>
            ))}
            {runs.length === 0 && (
              <div className="py-8 text-center text-xs text-ink-subtle">Nenhuma execução registrada.</div>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('ia-agentes')}
          className="nc-card rounded-2xl p-5 text-left hover:bg-surface-blue cursor-pointer border border-line transition-colors group"
        >
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-accent dark:text-cyan-300" />
            <span className="font-semibold text-ink group-hover:text-accent-ink transition-colors">Agentes operacionais</span>
          </div>
          <div className="mt-3 text-xs text-ink-muted">{agents.length} registrados no Paperclip</div>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('ia-tarefas')}
          className="nc-card rounded-2xl p-5 text-left hover:bg-surface-blue cursor-pointer border border-line transition-colors group"
        >
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-accent dark:text-cyan-300" />
            <span className="font-semibold text-ink group-hover:text-accent-ink transition-colors">Tarefas e delegações</span>
          </div>
          <div className="mt-3 text-xs text-ink-muted">{issues.length} issues operacionais</div>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('ia-execucoes')}
          className="nc-card rounded-2xl p-5 text-left hover:bg-surface-blue cursor-pointer border border-line transition-colors group"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent dark:text-cyan-300" />
            <span className="font-semibold text-ink group-hover:text-accent-ink transition-colors">Execuções &amp; heartbeats</span>
          </div>
          <div className="mt-3 text-xs text-ink-muted">{runs.length} execuções recentes</div>
        </button>
      </section>

      {!isPaperclipConnected(bundle?.status) && (
        <EmptyState
          title="Sem conexão com o Paperclip"
          description="Configure PAPERCLIP_API_URL no backend para exibir os dados operacionais da instância."
        />
      )}
    </div>
  );
};
