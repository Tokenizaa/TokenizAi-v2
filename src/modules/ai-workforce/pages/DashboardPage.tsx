import React, { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, ListTodo, Activity, Bot, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import { StatusBadge, EmptyState, ErrorState, LoadingState } from '../components';
import { hermesService, isHermesConnected } from '../services/hermes';
import type { HermesOverviewBundle } from '../../../types/platform';

interface DashboardPageProps { onRefresh: () => Promise<void>; onNavigate: (id: string) => void; onToast: (msg: string) => void; }

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<HermesOverviewBundle | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setBundle(await hermesService.getOverviewBundle()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao carregar dados do runtime Hermes.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar a visão geral" message={error} onRetry={load} />;
  if (!bundle) return <EmptyState title="Visão geral indisponível" description="O serviço Hermes não retornou um pacote de dados." />;

  const agents = bundle.bots || bundle.agents || [];
  const tasks = bundle.tasks || [];
  const runs = bundle.runs || [];
  const pendingApprovals = 0;
  const runningAgents = agents.filter((agent) => agent.status === 'running').length;
  const openTasks = tasks.filter((task) => !['done', 'completed', 'cancelled'].includes(task.status.toLowerCase())).length;
  const blockedTasks = tasks.filter((task) => task.status.toLowerCase() === 'blocked').length;
  const completedTasks = tasks.filter((task) => ['done', 'completed'].includes(task.status.toLowerCase())).length;
  const knownCost = bundle.costs?.totalCostCents;
  const currency = bundle.costs?.currency || 'USD';

  return (
    <div className="space-y-6">
      <PageHeader title="Visão geral — Força de trabalho IA" subtitle="Indicadores retornados pelo runtime Hermes."
        actions={<button type="button" onClick={load} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"><RefreshCw className="w-3.5 h-3.5" /> Atualizar</button>} />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="nc-card rounded-2xl p-5"><div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Agentes</div><div className="mt-1.5 font-display text-3xl font-semibold font-mono text-ink">{agents.length}</div><div className="mt-1 text-xs text-ink-muted">{runningAgents} em execução</div></div>
        <div className="nc-card rounded-2xl p-5"><div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Tarefas abertas</div><div className="mt-1.5 font-display text-3xl font-semibold font-mono text-ink">{openTasks}</div><div className="mt-1 text-xs text-ink-muted">{blockedTasks} bloqueada(s) · {completedTasks} concluída(s)</div></div>
        <div className="nc-card rounded-2xl p-5"><div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Aprovações</div><div className="mt-1.5 font-display text-3xl font-semibold font-mono text-ink">—</div><div className="mt-1 text-xs text-ink-muted">Não disponibilizadas no bundle Hermes</div></div>
        <div className="nc-card rounded-2xl p-5"><div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Custo reportado</div><div className="mt-1.5 font-display text-3xl font-semibold font-mono text-accent">{knownCost == null ? 'Não apurado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(knownCost / 100)}</div><div className="mt-1 text-xs text-ink-muted">{runs.length} execução(ões) · {currency}</div></div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="nc-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-line bg-surface-subtle/40"><div className="font-display text-base font-semibold text-ink">Tarefas recentes</div><div className="text-xs text-ink-subtle">Registros reais do Hermes</div></div>
          <div className="divide-y divide-line p-6">
            {tasks.slice(0, 8).map((task) => <div key={task.id} className="py-3 flex items-center justify-between gap-3 text-xs"><div className="min-w-0"><div className="font-medium text-ink truncate">{task.title}</div><div className="text-[10px] text-ink-subtle">{task.assigneeAgentName || 'Não atribuída'} · {task.projectName || 'Sem projeto'}</div></div><StatusBadge status={task.status} size="sm" /></div>)}
            {tasks.length === 0 && <div className="py-8 text-center text-xs text-ink-subtle">Nenhuma tarefa retornada pelo Hermes.</div>}
          </div>
        </div>
        <div className="nc-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-line bg-surface-subtle/40"><div className="font-display text-base font-semibold text-ink">Execuções recentes</div><div className="text-xs text-ink-subtle">Runs do runtime</div></div>
          <div className="divide-y divide-line p-6">
            {runs.slice(0, 8).map((run) => <div key={run.id} className="py-3 flex items-center justify-between gap-3 text-xs"><div className="min-w-0"><div className="font-medium text-ink truncate">{run.agentName || run.agentId || 'Agente'} · {run.model || 'Modelo não informado'}</div><div className="text-[10px] text-ink-subtle">{run.taskId || 'Sem tarefa vinculada'} · {run.status}</div></div><StatusBadge status={run.status} size="sm" /></div>)}
            {runs.length === 0 && <div className="py-8 text-center text-xs text-ink-subtle">Nenhuma execução retornada pelo Hermes.</div>}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button type="button" onClick={() => onNavigate('ia-agentes')} className="nc-card rounded-2xl p-5 text-left hover:bg-surface-blue cursor-pointer border border-line transition-colors"><div className="flex items-center gap-2"><Bot className="w-4 h-4 text-accent" /><span className="font-semibold text-ink">Agentes</span></div><div className="mt-3 text-xs text-ink-muted">{agents.length} agentes retornados</div></button>
        <button type="button" onClick={() => onNavigate('ia-tarefas')} className="nc-card rounded-2xl p-5 text-left hover:bg-surface-blue cursor-pointer border border-line transition-colors"><div className="flex items-center gap-2"><ListTodo className="w-4 h-4 text-accent" /><span className="font-semibold text-ink">Tarefas</span></div><div className="mt-3 text-xs text-ink-muted">{tasks.length} tarefas retornadas</div></button>
        <button type="button" onClick={() => onNavigate('ia-execucoes')} className="nc-card rounded-2xl p-5 text-left hover:bg-surface-blue cursor-pointer border border-line transition-colors"><div className="flex items-center gap-2"><Activity className="w-4 h-4 text-accent" /><span className="font-semibold text-ink">Execuções</span></div><div className="mt-3 text-xs text-ink-muted">{runs.length} execuções retornadas</div></button>
      </section>

      {!isHermesConnected(bundle.status) && <EmptyState title="Runtime Hermes desconectado" description="Configure e valide a conexão Hermes no backend para carregar os dados operacionais." />}
    </div>
  );
};
