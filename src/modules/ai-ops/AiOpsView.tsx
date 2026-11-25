import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  FolderGit2,
  GitBranch,
  Layers,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import {
  PageHeader,
  SegmentedTabs,
  SlideDrawer,
  StatusText,
  UserAvatar,
} from '../../components/ui/Primitives';
import { formatCents, formatDateTimeBR, HermesApi } from '../../services/api';
import type {
  HermesIntegrationStatus,
  NavSectionId,
  HermesBotDto,
  HermesOverviewBundle,
} from '../../types/platform';
import { HermesChatPanel } from './HermesChatPanel';
import {
  HermesApprovalsPanel,
  HermesCostsAuditPanel,
  HermesRoutinesPanel,
} from './HermesGovernancePanels';
import { HermesRunsPanel } from './HermesRunsPanel';
import { HermesStatusPanel } from './HermesStatusPanel';
import { HermesTasksPanel } from './HermesTasksPanel';

export type AiOpsSectionId =
  | 'ia-visao'
  | 'ia-chat'
  | 'ia-agentes'
  | 'ia-equipes'
  | 'ia-tarefas'
  | 'ia-execucoes'
  | 'ia-rotinas'
  | 'ia-aprovacoes'
  | 'ia-custos';

interface AiOpsViewProps {
  section: AiOpsSectionId;
  bundle: HermesOverviewBundle;
  onRefresh: () => Promise<void>;
  onNavigate: (sec: NavSectionId) => void;
  onToast: (msg: string) => void;
}

type AgentDrawerTab =
  | 'geral'
  | 'competencias'
  | 'hierarquia'
  | 'tarefas'
  | 'execucoes'
  | 'runtime'
  | 'permissoes';

export const AiOpsView: React.FC<AiOpsViewProps> = ({
  section,
  bundle,
  onRefresh,
  onNavigate,
  onToast,
}) => {
  const {
    status,
    agents = bundle.bots || [],
    tasks = [],
    runs = [],
    projects = [],
    goals = [],
    routines = [],
    costs = null,
  } = bundle;
  const capabilities = status.availableCapabilities || [];
  const hermesStatus = status as HermesIntegrationStatus;
  const isConnected =
    hermesStatus.configured && hermesStatus.connected;

  const [agentSearch, setAgentSearch] = useState('');
  const [agentStatusFilter, setAgentStatusFilter] = useState('all');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentDetail, setAgentDetail] = useState<HermesBotDto | null>(null);
  const [agentRuntimeState, setAgentRuntimeState] = useState<Record<string, unknown> | null>(null);
  const [agentDrawerTab, setAgentDrawerTab] = useState<AgentDrawerTab>('geral');

  const [orgTree, setOrgTree] = useState<HermesBotDto[]>([]);
  const [loadingOrg, setLoadingOrg] = useState(false);

  const [chatInitialRef, setChatInitialRef] = useState<string | null>(null);
  const [taskInitialId, setTaskInitialId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadOrg = useCallback(async () => {
    if (!isConnected) {
      setOrgTree([]);
      return;
    }
    setLoadingOrg(true);
    try {
      const res = await HermesApi.getOrganization();
      setOrgTree(res.tree || []);
    } catch {
      setOrgTree([]);
    } finally {
      setLoadingOrg(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (section === 'ia-equipes') {
      loadOrg();
    }
  }, [section, loadOrg]);

  const openAgentProfile = useCallback(
    async (agent: HermesBotDto, initialTab: AgentDrawerTab = 'geral') => {
      setSelectedAgentId(agent.id);
      setAgentDetail(agent);
      setAgentDrawerTab(initialTab);
      setAgentRuntimeState(agent.runtimeState || null);

      if (!isConnected) return;
      const [detRes, rtRes] = await Promise.allSettled([
        HermesApi.getAgent(agent.id),
        HermesApi.getAgentRuntimeState(agent.id),
      ]);
      if (detRes.status === 'fulfilled') setAgentDetail(detRes.value.agent);
      if (rtRes.status === 'fulfilled') setAgentRuntimeState(rtRes.value.runtimeState);
    },
    [isConnected],
  );

  const filteredAgents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    return agents.filter((ag) => {
      if (agentStatusFilter !== 'all' && ag.status.toLowerCase() !== agentStatusFilter) return false;
      if (!q) return true;
      return (
        ag.name.toLowerCase().includes(q) ||
        (ag.role || '').toLowerCase().includes(q) ||
        (ag.title || '').toLowerCase().includes(q) ||
        (ag.capabilities || []).some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [agents, agentSearch, agentStatusFilter]);

  const agentStatusTone = (st: string) => {
    const s = st.toLowerCase();
    if (s === 'active' || s === 'idle' || s === 'ready' || s === 'running') return 'nominal' as const;
    if (s === 'error' || s === 'failed' || s === 'terminated') return 'critical' as const;
    return 'attention' as const;
  };

  const handleAgentAction = async (
    agentId: string,
    action: 'wakeup' | 'heartbeat' | 'pause' | 'resume',
  ) => {
    setBusyId(`${agentId}-${action}`);
    try {
      if (action === 'wakeup') await HermesApi.wakeupAgent(agentId);
      else if (action === 'heartbeat') await HermesApi.invokeHeartbeat(agentId);
      else if (action === 'pause') await HermesApi.pauseAgent(agentId);
      else await HermesApi.resumeAgent(agentId);

      await onRefresh();
      onToast(
        action === 'wakeup'
          ? 'Solicitação de ativação enviada ao runtime Hermes.'
          : action === 'heartbeat'
            ? 'Heartbeat solicitado ao runtime Hermes.'
            : action === 'pause'
              ? 'Agente pausado no runtime Hermes.'
              : 'Agente retomado no runtime Hermes.',
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'O runtime Hermes recusou a operação no agente.');
    } finally {
      setBusyId(null);
    }
  };

  const openChatWithAgent = (agentRef: string) => {
    setSelectedAgentId(null);
    setChatInitialRef(agentRef);
    onNavigate('ia-chat');
  };

  const openTaskDetail = (issueId: string) => {
    setSelectedAgentId(null);
    setTaskInitialId(issueId);
    onNavigate('ia-tarefas');
  };

  const renderOrgBranch = (node: HermesBotDto, depth = 0): React.ReactNode => {
    const matchedAgent = agents.find((a) => a.id === node.id);
    return (
      <div key={node.id} className="space-y-2.5">
        <div
          role={matchedAgent ? 'button' : undefined}
          tabIndex={matchedAgent ? 0 : undefined}
          onClick={() => matchedAgent && openAgentProfile(matchedAgent, 'hierarquia')}
          onKeyDown={(e) => {
            if (matchedAgent && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              openAgentProfile(matchedAgent, 'hierarquia');
            }
          }}
          className={`nc-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            matchedAgent ? 'cursor-pointer' : ''
          }`}
          style={{ marginLeft: `${Math.min(depth * 24, 96)}px` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar name={node.name} src={node.avatarUrl || undefined} size="md" />
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold text-ink truncate">
                {node.title || node.name}
              </div>
              <div className="text-xs text-ink-subtle truncate">
                {node.role || 'Agente da organização'}
                {node.team ? ` · ${node.team}` : ''}
                {node.children ? node.children.length > 0 ? ` · ${node.children.length} subordinado(s)` : '' : ''}
              </div>
            </div>
          </div>
          {node.status && <StatusText label={node.status} tone={agentStatusTone(node.status)} />}
        </div>
        {(node.children || []).map((child) => renderOrgBranch(child, depth + 1))}
      </div>
    );
  };

  const headers: Record<AiOpsSectionId, { title: string; subtitle: string }> = {
    'ia-visao': {
      title: 'Operações de IA — Visão Geral',
      subtitle:
        'Estado do runtime Hermes, capacidades disponíveis, projetos operacionais e metas vinculadas à operação de agentes.',
    },
    'ia-chat': {
      title: 'Chat com Agentes (Agent Chat)',
      subtitle:
        'Conversas por agente e usuário executadas pelo runtime Hermes.',
    },
    'ia-agentes': {
      title: 'Agentes Operacionais',
      subtitle:
        'Agentes vinculados à organização TokenizAi e executados pelo runtime Hermes, separados do catálogo de especialistas Agency Agents.',
    },
    'ia-equipes': {
      title: 'Equipes & Organograma Oficial',
      subtitle:
        'Hierarquia organizacional construída a partir dos vínculos de reporte disponibilizados pelo Hermes.',
    },
    'ia-tarefas': {
      title: 'Tarefas e delegações',
      subtitle:
        'Gestão de tarefas, dependências, comentários, documentos, anexos e interações disponibilizadas pelo runtime.',
    },
    'ia-execucoes': {
      title: 'Execuções & Heartbeats',
      subtitle:
        'Monitoramento de execuções, duração, custos e estados efetivamente disponibilizados pelo Hermes.',
    },
    'ia-rotinas': {
      title: 'Automações & Rotinas',
      subtitle:
        'Rotinas agendadas, gatilhos e histórico de execuções disponibilizados pelo runtime Hermes.',
    },
    'ia-aprovacoes': {
      title: 'Aprovações & Governança',
      subtitle:
        'Solicitações pendentes de autorização humana e revisões de decisões operacionais.',
    },
    'ia-custos': {
      title: 'Custos, Atividade & Auditoria',
      subtitle:
        'Consumo oficial por agente/projeto, cobertura de apuração e trilha de auditoria de ações.',
    },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={headers[section].title}
        subtitle={headers[section].subtitle}
        actions={
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar dados</span>
          </button>
        }
      />

      {/* ======================================================================== */}
      {/* 1. VISÃO GERAL IA + PROJETOS/METAS OPERACIONAIS + CAPACIDADES OPENAPI    */}
      {/* ======================================================================== */}
      {section === 'ia-visao' && (
        <div className="space-y-6">
          <HermesStatusPanel
            status={status as unknown as HermesIntegrationStatus}
            title="Conexão & Matriz de Capacidades Hermes"
            onRefresh={onRefresh}
            onNavigate={onNavigate}
          />

          {isConnected && (
            <>
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => onNavigate('ia-agentes')}
                  className="nc-card rounded-2xl p-5 text-left cursor-pointer"
                >
                  <div className="text-xs text-ink-subtle">Agentes no runtime</div>
                  <div className="mt-1.5 font-display text-2xl font-semibold font-mono tabular-nums text-ink">
                    {agents.length}
                  </div>
                  <div className="text-xs text-ink-muted mt-1">
                    {agents.filter((a) => a.status === 'running').length} em execução
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('ia-tarefas')}
                  className="nc-card rounded-2xl p-5 text-left cursor-pointer"
                >
                  <div className="text-xs text-ink-subtle">Tarefas abertas</div>
                  <div className="mt-1.5 font-display text-2xl font-semibold font-mono tabular-nums text-ink">
                    {tasks.filter((i) => i.status !== 'done' && i.status !== 'cancelled').length}
                  </div>
                  <div className="text-xs text-highlight mt-1">
                    {tasks.filter((i) => i.status === 'blocked').length} bloqueada(s)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('ia-aprovacoes')}
                  className="nc-card rounded-2xl p-5 text-left cursor-pointer"
                >
                  <div className="text-xs text-ink-subtle">Aprovações (não integradas)</div>
                  <div className="mt-1.5 font-display text-2xl font-semibold font-mono tabular-nums text-highlight">
                    —
                  </div>
                  <div className="text-xs text-ink-muted mt-1">Governança de aprovação indisponível na API Hermes</div>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('ia-custos')}
                  className="nc-card rounded-2xl p-5 text-left cursor-pointer"
                >
                  <div className="text-xs text-ink-subtle">Custos reportados ({costs?.currency || 'moeda não informada'})</div>
                  <div className="mt-1.5 font-display text-2xl font-semibold font-mono tabular-nums text-accent dark:text-cyan-300">
                    {formatCents(costs?.totalCostCents, costs?.currency)}
                  </div>
                  <div className="text-xs text-ink-subtle mt-1">{runs.length} execução(ões) recente(s)</div>
                </button>
              </section>

              {/* Projetos operacionais e metas vinculados ao runtime */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="nc-card rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                      <FolderGit2 className="w-4 h-4 text-accent dark:text-cyan-300" />
                      <h2 className="font-display text-sm font-semibold text-ink">
                        Projetos Operacionais
                      </h2>
                    </div>
                    <span className="font-mono text-xs text-ink-subtle">{projects.length}</span>
                  </div>
                  <p className="text-[11px] text-ink-subtle">
                    Projetos utilizados na execução de agentes, separados dos projetos empresariais gerenciados pela TokenizAi.
                  </p>
                  <div className="divide-y divide-line">
                    {projects.map((p) => (
                      <div key={p.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-ink truncate">{p.name}</div>
                          {p.description && <div className="text-ink-subtle truncate">{p.description}</div>}
                        </div>
                        {p.status && <StatusText label={p.status} tone="nominal" />}
                      </div>
                    ))}
                    {projects.length === 0 && (
                      <div className="py-4 text-xs text-ink-subtle text-center">
                        Nenhum projeto operacional retornado pelo runtime Hermes.
                      </div>
                    )}
                  </div>
                </section>

                <section className="nc-card rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-accent dark:text-cyan-300" />
                      <h2 className="font-display text-sm font-semibold text-ink">
                        Metas & Objetivos (Goals)
                      </h2>
                    </div>
                    <span className="font-mono text-xs text-ink-subtle">{goals.length}</span>
                  </div>
                  <div className="divide-y divide-line">
                    {goals.map((g) => (
                      <div key={g.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-ink truncate">{g.title}</div>
                          {g.level && <div className="text-ink-subtle">Nível: {g.level}</div>}
                        </div>
                        {typeof g.progressPercent === 'number' && (
                          <span className="font-mono font-semibold text-highlight tabular-nums">
                            {g.progressPercent}%
                          </span>
                        )}
                      </div>
                    ))}
                    {goals.length === 0 && (
                      <div className="py-4 text-xs text-ink-subtle text-center">
                        Nenhuma meta operacional retornada pelo runtime Hermes.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}

          {/* OpenAPI Capability Matrix Table */}
          <section className="nc-card rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-line bg-surface-subtle/35 flex items-center justify-between">
              <div>
                <h2 className="font-display text-sm font-semibold text-ink">
                  Matriz de capacidades do runtime Hermes
                </h2>
                <p className="text-xs text-ink-subtle mt-0.5">
                  Disponibilidade dos recursos informada pelo runtime e pelo contrato de integração
                </p>
              </div>
              <span className="font-mono text-xs text-ink-subtle">
                {capabilities.filter((c) => Boolean(c.availableInVersion)).length} /{' '}
                {capabilities.length} ativas
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line text-[11px] font-semibold text-ink-subtle">
                    <th className="py-2.5 px-6">Capacidade</th>
                    <th className="py-2.5 px-4">Recurso / endpoint</th>
                    <th className="py-2.5 px-4">Método</th>
                    <th className="py-2.5 px-4">Disponibilidade na Versão</th>
                    <th className="py-2.5 px-6 text-right">Autenticação / Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {capabilities.map((cap) => (
                    <tr key={cap.key}>
                      <td className="py-3 px-6">
                        <div className="font-mono font-semibold text-ink">{cap.key}</div>
                        <div className="text-ink-subtle">{cap.label}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-ink-muted">{cap.route}</td>
                      <td className="py-3 px-4 font-mono text-highlight">{cap.method}</td>
                      <td className="py-3 px-4">
                        <StatusText
                          label={
                            Boolean(cap.availableInVersion)
                              ? 'Disponível'
                              : cap.availableInVersion === undefined
                                ? 'Aguardando OpenAPI'
                                : 'Indisponível nesta versão'
                          }
                          tone={
                            Boolean(cap.availableInVersion)
                              ? 'nominal'
                              : cap.availableInVersion === undefined
                                ? 'neutral'
                                : 'attention'
                          }
                        />
                      </td>
                      <td className="py-3 px-6 text-right">
                        <span className="font-mono text-ink-muted">
                          {cap.authState} · {cap.implementationState}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ======================================================================== */}
      {/* 2. CHAT COM AGENTES                                                      */}
      {/* ======================================================================== */}
      {section === 'ia-chat' && (
        <HermesChatPanel
          status={status as unknown as HermesIntegrationStatus}
          agents={agents}
          initialAgentRef={chatInitialRef}
          onNavigate={onNavigate}
          
          onToast={onToast}
        />
      )}

      {/* ======================================================================== */}
      {/* 3. AGENTES                                                               */}
      {/* ======================================================================== */}
      {section === 'ia-agentes' && (
        <>
          {!isConnected ? (
            <HermesStatusPanel
              status={status as unknown as HermesIntegrationStatus}
              title="Agentes Hermes"
              requiredCapabilities={['agents:read', 'agents:manage']}
              onRefresh={onRefresh}
              onNavigate={onNavigate}
            />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={agentSearch}
                      onChange={(e) => setAgentSearch(e.target.value)}
                      placeholder="Buscar agente por nome, cargo ou competência..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
                    />
                  </div>
                  <select
                    value={agentStatusFilter}
                    onChange={(e) => setAgentStatusFilter(e.target.value)}
                    aria-label="Filtrar status dos agentes"
                    className="px-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
                  >
                    <option value="all">Todos status ({agents.length})</option>
                    <option value="active">active</option>
                    <option value="idle">idle</option>
                    <option value="running">running</option>
                    <option value="paused">paused</option>
                    <option value="error">error</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('biblioteca')}
                  className="px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
                >
                  Ver Catálogo Agency Agents
                </button>
              </div>

              {filteredAgents.length === 0 ? (
                <div className="nc-card rounded-2xl p-10 text-center space-y-2">
                  <Bot className="w-6 h-6 text-accent dark:text-cyan-300 mx-auto" />
                  <div className="font-display text-base font-semibold text-ink">
                    Nenhum agente encontrado nesta organização
                  </div>
                  <p className="text-xs text-ink-subtle">
                    Ajuste os filtros ou vincule agentes à organização TokenizAi por meio dos fluxos disponíveis.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredAgents.map((ag) => {
                    const isPaused = ag.status.toLowerCase() === 'paused';
                    return (
                      <div
                        key={ag.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openAgentProfile(ag, 'geral')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openAgentProfile(ag, 'geral');
                          }
                        }}
                        className={`nc-card rounded-2xl p-5 text-left cursor-pointer flex flex-col justify-between gap-4 ${
                          selectedAgentId === ag.id ? 'nc-card-active' : ''
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <UserAvatar name={ag.title || ag.name} src={ag.avatarUrl || undefined} size="md" />
                              <div className="min-w-0">
                                <h3 className="font-display text-base font-semibold text-ink truncate">
                                  {ag.title || ag.name}
                                </h3>
                                <p className="text-xs text-ink-subtle truncate">{ag.role || 'Agente Hermes'}</p>
                              </div>
                            </div>
                            <StatusText label={ag.status} tone={agentStatusTone(ag.status)} />
                          </div>

                          {ag.capabilities && ag.capabilities.length > 0 && (
                            <div className="text-xs text-ink-muted line-clamp-2">
                              {ag.capabilities.slice(0, 4).join(' · ')}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-line">
                            <div>
                              <span className="text-ink-subtle block">Adapter</span>
                              <span className="font-mono text-ink">{ag.adapterType || '—'}</span>
                            </div>
                            <div>
                              <span className="text-ink-subtle block">Consumo / Teto</span>
                              <span className="font-mono text-ink tabular-nums">
                                {formatCents(ag.spentMonthlyCents)} / {formatCents(ag.budgetMonthlyCents)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          className="pt-3 border-t border-line flex items-center justify-between gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => openChatWithAgent(ag.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-accent dark:text-cyan-300 hover:bg-surface-blue cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Conversar</span>
                          </button>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={busyId === `${ag.id}-wakeup`}
                              onClick={() => handleAgentAction(ag.id, 'wakeup')}
                              title="Wakeup"
                              className="p-1.5 rounded-lg border border-line-strong text-ink-muted hover:text-ink hover:bg-surface-blue cursor-pointer"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={busyId === `${ag.id}-heartbeat`}
                              onClick={() => handleAgentAction(ag.id, 'heartbeat')}
                              title="Invocar Heartbeat"
                              className="p-1.5 rounded-lg border border-line-strong text-ink-muted hover:text-ink hover:bg-surface-blue cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={busyId === `${ag.id}-${isPaused ? 'resume' : 'pause'}`}
                              onClick={() => handleAgentAction(ag.id, isPaused ? 'resume' : 'pause')}
                              title={isPaused ? 'Retomar agente' : 'Pausar agente'}
                              className="p-1.5 rounded-lg border border-line-strong text-ink-muted hover:text-ink hover:bg-surface-blue cursor-pointer"
                            >
                              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ======================================================================== */}
      {/* 4. EQUIPES & DIRETORIA (ORGANOGRAMA REAL VIA /org + reportsTo)           */}
      {/* ======================================================================== */}
      {section === 'ia-equipes' && (
        <>
          {!isConnected ? (
            <HermesStatusPanel
              status={status as unknown as HermesIntegrationStatus}
              title="Equipes & Organograma Hermes"
              requiredCapabilities={['org:read', 'agents:read']}
              onRefresh={onRefresh}
              onNavigate={onNavigate}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-ink-subtle inline-flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
                  <span>Estrutura hierárquica baseada nos vínculos organizacionais retornados pelo Hermes</span>
                </div>
                <button
                  type="button"
                  onClick={loadOrg}
                  disabled={loadingOrg}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingOrg ? 'animate-spin' : ''}`} />
                  <span>Atualizar organograma</span>
                </button>
              </div>

              {orgTree.length === 0 ? (
                <div className="nc-card rounded-2xl p-8 text-center text-xs text-ink-subtle">
                  Nenhum vínculo hierárquico foi retornado pelo runtime Hermes.
                </div>
              ) : (
                <div className="space-y-3">{orgTree.map((root) => renderOrgBranch(root, 0))}</div>
              )}
            </div>
          )}
        </>
      )}

      {/* ======================================================================== */}
      {/* 5..9 DOMAIN PANELS                                                       */}
      {/* ======================================================================== */}
      {section === 'ia-tarefas' && (
        <HermesTasksPanel
          status={status as unknown as HermesIntegrationStatus}
          agents={agents}
          projects={projects}
          initialTaskId={taskInitialId}
          onNavigate={onNavigate}
          onRefreshAll={onRefresh}
          onToast={onToast}
        />
      )}

      {section === 'ia-execucoes' && (
        <HermesRunsPanel status={status as unknown as HermesIntegrationStatus} onNavigate={onNavigate} onToast={onToast} />
      )}

      {section === 'ia-rotinas' && (
        <HermesRoutinesPanel
          status={status as unknown as HermesIntegrationStatus}
          agents={agents}
          onNavigate={onNavigate}
          onToast={onToast}
        />
      )}

      {section === 'ia-aprovacoes' && (
        <HermesApprovalsPanel status={status as unknown as HermesIntegrationStatus} onNavigate={onNavigate} onToast={onToast} />
      )}

      {section === 'ia-custos' && (
        <HermesCostsAuditPanel status={status as unknown as HermesIntegrationStatus} onNavigate={onNavigate} onToast={onToast} />
      )}

      {/* ======================================================================== */}
      {/* PAINEL DE DETALHES DO AGENTE (PERFIL DO RUNTIME HERMES)                       */}
      {/* ======================================================================== */}
      <SlideDrawer
        open={Boolean(selectedAgentId && agentDetail)}
        onClose={() => setSelectedAgentId(null)}
        wide
        title={agentDetail?.title || agentDetail?.name || ''}
        subtitle={agentDetail ? `${agentDetail.role || 'Agente Hermes'} · ID ${agentDetail.id}` : undefined}
      >
        {agentDetail && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-line">
              <StatusText label={agentDetail.status} tone={agentStatusTone(agentDetail.status)} />
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => openChatWithAgent(agentDetail.id)}
                  className="nc-primary-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Abrir chat</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAgentAction(agentDetail.id, 'wakeup')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Wakeup</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAgentAction(agentDetail.id, 'heartbeat')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Heartbeat</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAgentAction(
                      agentDetail.id,
                      agentDetail.status.toLowerCase() === 'paused' ? 'resume' : 'pause',
                    )
                  }
                  className="px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
                >
                  {agentDetail.status.toLowerCase() === 'paused' ? 'Retomar' : 'Pausar'}
                </button>
              </div>
            </div>

            <SegmentedTabs
              active={agentDrawerTab}
              onChange={setAgentDrawerTab}
              tabs={[
                { id: 'geral', label: 'Visão geral' },
                { id: 'competencias', label: 'Competências' },
                { id: 'hierarquia', label: 'Hierarquia' },
                {
                  id: 'tarefas',
                  label: 'Tarefas',
                  count: tasks.filter((i) => i.assigneeAgentId === agentDetail.id).length,
                },
                {
                  id: 'execucoes',
                  label: 'Execuções',
                  count: runs.filter((r) => r.agentId === agentDetail.id).length,
                },
                { id: 'runtime', label: 'Runtime State' },
                { id: 'permissoes', label: 'Permissões & Acesso' },
              ]}
            />

            {agentDrawerTab === 'geral' && (
              <div className="grid grid-cols-2 gap-4 py-3 text-xs">
                <div>
                  <div className="text-ink-subtle">Status / Lifecycle</div>
                  <div className="font-mono text-ink mt-0.5">
                    {agentDetail.status} {agentDetail.lifecycleState ? `(${agentDetail.lifecycleState})` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-ink-subtle">Adapter</div>
                  <div className="font-mono text-ink mt-0.5">{agentDetail.adapterType || '—'}</div>
                </div>
                <div>
                  <div className="text-ink-subtle">Consumo mensal</div>
                  <div className="font-mono font-semibold text-ink mt-0.5">
                    {formatCents(agentDetail.spentMonthlyCents)}
                  </div>
                </div>
                <div>
                  <div className="text-ink-subtle">Orçamento mensal</div>
                  <div className="font-mono font-semibold text-highlight mt-0.5">
                    {formatCents(agentDetail.budgetMonthlyCents)}
                  </div>
                </div>
                <div>
                  <div className="text-ink-subtle">Último heartbeat</div>
                  <div className="font-mono text-ink mt-0.5">{formatDateTimeBR(agentDetail.lastHeartbeatAt || agentDetail.updatedAt)}</div>
                </div>
                <div>
                  <div className="text-ink-subtle">Versão de Lifecycle</div>
                  <div className="font-mono text-ink mt-0.5">{String(agentDetail.lifecycleVersion ?? '—')}</div>
                </div>
                {agentDetail.lifecycleError && (
                  <div className="col-span-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300">
                    <strong>Erro de lifecycle:</strong> {agentDetail.lifecycleError}
                  </div>
                )}
              </div>
            )}

            {agentDrawerTab === 'competencias' && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-ink-subtle inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Capacidades informadas pelo runtime Hermes</span>
                </h4>
                {agentDetail.capabilities && agentDetail.capabilities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {agentDetail.capabilities.map((cap, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-lg border border-line-strong bg-surface-subtle/50 text-xs text-ink"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-ink-subtle">Nenhuma competência listada neste registro.</div>
                )}
              </div>
            )}

            {agentDrawerTab === 'hierarquia' && (
              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-xl border border-line bg-surface-subtle/40 space-y-1">
                  <div className="text-ink-subtle">Reporta diretamente para (reportsTo)</div>
                  <div className="font-mono font-semibold text-ink">
                    {agentDetail.reportsTo || 'Topo da cadeia / Sem superior direto'}
                  </div>
                </div>
                {agentDetail.chainOfCommand && agentDetail.chainOfCommand.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-ink-subtle font-semibold inline-flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Cadeia de comando</span>
                    </div>
                    <pre className="p-3 rounded-xl border border-line bg-surface-subtle/40 font-mono text-[11px] overflow-x-auto">
                      {JSON.stringify(agentDetail.chainOfCommand, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {agentDrawerTab === 'tarefas' && (
              <div className="space-y-2.5">
                {tasks
                  .filter((i) => i.assigneeAgentId === agentDetail.id)
                  .map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => openTaskDetail(i.id)}
                      className="w-full p-3.5 rounded-xl border border-line hover:bg-surface-blue/40 text-left space-y-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-accent dark:text-cyan-300">
                          {i.id}
                        </span>
                        <StatusText label={i.status} tone="attention" />
                      </div>
                      <div className="text-sm font-medium text-ink">{i.title}</div>
                    </button>
                  ))}
                {tasks.filter((i) => i.assigneeAgentId === agentDetail.id).length === 0 && (
                  <div className="p-4 text-xs text-ink-subtle text-center border border-line rounded-xl">
                    Nenhuma tarefa atribuída a este agente.
                  </div>
                )}
              </div>
            )}

            {agentDrawerTab === 'execucoes' && (
              <div className="divide-y divide-line border border-line rounded-xl">
                {runs
                  .filter((r) => r.agentId === agentDetail.id)
                  .map((r) => (
                    <div key={r.id} className="p-3.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-ink-subtle">{formatDateTimeBR(r.startedAt)}</span>
                        <StatusText label={r.status} tone="attention" />
                      </div>
                      <div className="font-mono text-ink">
                        {r.model || '—'} · {formatCents(r.costCents, r.currency)}
                      </div>
                    </div>
                  ))}
                {runs.filter((r) => r.agentId === agentDetail.id).length === 0 && (
                  <div className="p-4 text-xs text-ink-subtle text-center">
                    Nenhuma execução registrada para este agente.
                  </div>
                )}
              </div>
            )}

            {agentDrawerTab === 'runtime' && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-ink-subtle inline-flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Runtime State & Configuração</span>
                </h4>
                <pre className="p-4 rounded-xl border border-line bg-surface-subtle/40 font-mono text-[11px] overflow-x-auto max-h-72">
                  {JSON.stringify(
                    {
                      runtimeState: agentRuntimeState,
                      runtimeConfig: agentDetail.runtimeConfig || null,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}

            {agentDrawerTab === 'permissoes' && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-ink-subtle inline-flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
                  <span>Permissões & Acesso</span>
                </h4>
                <pre className="p-4 rounded-xl border border-line bg-surface-subtle/40 font-mono text-[11px] overflow-x-auto max-h-72">
                  {JSON.stringify(
                    {
                      permissions: agentDetail.permissions || null,
                      access: agentDetail.access || null,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}
          </div>
        )}
      </SlideDrawer>
    </div>
  );
};
