import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Zap, RefreshCw, MessageSquare, Play, Pause, Layers, Shield, Activity } from 'lucide-react';
import { PageHeader, SegmentedTabs, StatusText } from '../../../components/ui/Primitives';
import {
  CollectionToolbar,
  SectionTitle,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../ai-workforce/components';
import { HermesApi } from '../../../services/api';
import type { HermesBotDto } from '../../../types/platform';
import { useParams } from 'react-router-dom';

type AgentTab =
  | 'geral'
  | 'competencias'
  | 'hierarquia'
  | 'tarefas'
  | 'execucoes'
  | 'runtime'
  | 'permissoes';

interface AgentDetailPageProps {
  agentId?: string;
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

const statusTone = (st: string) => {
  const s = st.toLowerCase();
  if (s === 'running' || s === 'active' || s === 'idle' || s === 'ready') return 'nominal';
  if (s === 'error' || s === 'failed' || s === 'terminated') return 'critical';
  return 'attention';
};

const TABS: { id: AgentTab; label: string }[] = [
  { id: 'geral', label: 'Visão geral' },
  { id: 'competencias', label: 'Competências' },
  { id: 'hierarquia', label: 'Hierarquia' },
  { id: 'tarefas', label: 'Tarefas' },
  { id: 'execucoes', label: 'Execuções' },
  { id: 'runtime', label: 'Runtime State' },
  { id: 'permissoes', label: 'Permissões & Acesso' },
];

export const AgentDetailPage: React.FC<AgentDetailPageProps> = ({
  agentId: agentIdProp,
  onNavigate,
  onToast,
}) => {
  const { agentId: agentIdFromUrl } = useParams<{ agentId: string }>();
  const agentId = agentIdProp ?? agentIdFromUrl ?? '';
  if (!agentId) {
    return null;
  }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<HermesBotDto | null>(null);
  const [tab, setTab] = useState<AgentTab>('geral');
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [editingAgent, setEditingAgent] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', role: '' });

  useEffect(() => {
    if (agent) {
      setEditForm({
        title: agent.title || '',
        role: agent.role || '',
      });
    }
  }, [agent]);

  const loadAgent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await HermesApi.getAgent(agentId);
      setAgent(res.agent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar os detalhes do agente.');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  const handleAction = useCallback(async (action: string) => {
    setBusy((prev) => ({ ...prev, [action]: true }));
    try {
      if (action === 'chat') {
        onNavigate(`ia-chat:agent:${agentId}`);
        return;
      }
      onToast(`Ação "${action}" não disponível via REST do Hermes. Use o terminal Hermes.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha ao executar ação no agente.');
    } finally {
      setBusy((prev) => ({ ...prev, [action]: false }));
    }
  }, [agentId, onNavigate, onToast]);

  const handleSaveAgent = async () => {
    const payload: Record<string, unknown> = {};
    if (editForm.title) payload.title = editForm.title;
    if (editForm.role) payload.role = editForm.role;
    if (Object.keys(payload).length === 0) {
      onToast('Nenhum campo para atualizar.');
      return;
    }
    setEditingAgent(false);
    try {
      await HermesApi.updateAgent(agentId, payload);
      onToast('Agente atualizado no Hermes.');
      await loadAgent();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha ao atualizar o agente.');
      setEditingAgent(true);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar o agente" message={error} onRetry={loadAgent} />;
  if (!agent) return <EmptyState title="Agente não encontrado" description="O agente solicitado não existe no runtime Hermes." />;

  const isPaused = agent.status.toLowerCase() === 'paused';
  const isBusy = (action: string) => Boolean(busy[action]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={agent.title || agent.name}
        subtitle={`${agent.role || 'Agente Hermes'} · ID ${agent.id}`}
        actions={
          <>
            <button
              type="button"
              onClick={() => onNavigate(`ia-chat:agent:${agentId}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Abrir chat
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="nc-card rounded-2xl p-4 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Status / Lifecycle</div>
          <div className="mt-1 flex items-center gap-2">
            <StatusText label={agent.status} tone={statusTone(agent.status)} />
          </div>
        </div>
        <div className="nc-card rounded-2xl p-4 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Perfil</div>
          <div className="mt-1 font-mono text-ink">{agent.profileName || '—'}</div>
        </div>
        <div className="nc-card rounded-2xl p-4 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Modelo</div>
          <div className="mt-1 font-mono text-ink">{agent.model || '—'}</div>
        </div>
        <div className="nc-card rounded-2xl p-4 text-left">
          <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Criado em</div>
          <div className="mt-1 font-mono text-ink">
            {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString('pt-BR') : '—'}
          </div>
        </div>
      </div>

      <SegmentedTabs
        active={tab}
        onChange={setTab}
        tabs={TABS.map((t) => ({ ...t, count: undefined }))}
      />

      {tab === 'geral' && (
        <div className="space-y-4">
          <div className="nc-card rounded-2xl p-5 space-y-3">
            <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Identidade</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-ink-subtle">Nome</div>
                <div className="font-medium text-ink">{agent.title || agent.name}</div>
              </div>
              <div>
                <div className="text-ink-subtle">Cargo / Role</div>
                <div className="font-medium text-ink">{agent.role || '—'}</div>
              </div>
            </div>
          </div>
          {agent.description && (
            <div className="nc-card rounded-2xl p-5 space-y-3">
              <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Descrição</div>
              <div className="text-ink-muted text-sm">{agent.description}</div>
            </div>
          )}
          <div className="nc-card rounded-2xl p-5 space-y-3">
            <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">Ações rápidas</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigate(`ia-chat:agent:${agentId}`)}
                className="px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Abrir chat
              </button>
              {editingAgent ? (
                <>
                  <input
                    autoFocus
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="Título"
                    className="px-2 py-1.5 rounded border border-line-strong bg-white text-xs text-ink focus:border-accent focus:ring-0 outline-none"
                  />
                  <input
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    placeholder="Role"
                    className="px-2 py-1.5 rounded border border-line-strong bg-white text-xs text-ink focus:border-accent focus:ring-0 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveAgent}
                    className="px-2.5 py-1.5 rounded-lg border border-line-strong bg-accent text-white text-xs font-semibold hover:bg-accent-hover cursor-pointer"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingAgent(false)}
                    className="px-2.5 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingAgent(true)}
                  className="px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
                >
                  Editar dados
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'competencias' && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-ink-subtle inline-flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" /> <span>Competências registradas no Hermes</span>
          </div>
          {(agent.capabilities || []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(agent.capabilities as string[]).map((cap, idx) => (
                <span key={idx} className="px-3 py-1.5 rounded-lg border border-line-strong bg-surface-subtle/50 text-xs text-ink">
                  {cap}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-ink-subtle">Nenhuma competência listada neste registro.</div>
          )}
        </div>
      )}

      {tab === 'hierarquia' && (
        <div className="space-y-3 text-xs">
          <div className="p-4 rounded-xl border border-line bg-surface-subtle/40 space-y-1">
            <div className="text-ink-subtle">Divisão</div>
            <div className="font-mono font-semibold text-ink">{agent.division || '—'}</div>
          </div>
          <div className="p-4 rounded-xl border border-line bg-surface-subtle/40 space-y-1">
            <div className="text-ink-subtle">Divisão / Especialidade</div>
            <div className="font-mono font-semibold text-ink">{agent.role || '—'}</div>
          </div>
        </div>
      )}

      {tab === 'tarefas' && (
        <div className="space-y-3">
          <div className="p-4 text-xs text-ink-subtle text-center border border-line rounded-xl">
            Tarefas são gerenciadas no kanban Hermes. Use a seção Tarefas para visualizar.
          </div>
        </div>
      )}

      {tab === 'execucoes' && (
        <div className="space-y-3">
          <div className="p-4 text-xs text-ink-subtle text-center border border-line rounded-xl">
            Execuções são gerenciadas na seção Execuções do Hermes.
          </div>
        </div>
      )}

      {tab === 'runtime' && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-ink-subtle inline-flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> <span>Estado do Operacional Hermes</span>
          </div>
          <pre className="p-4 rounded-xl border border-line bg-surface-subtle/40 font-mono text-[11px] overflow-x-auto max-h-80">
            {JSON.stringify(
              {
                id: agent.id,
                name: agent.name,
                title: agent.title,
                role: agent.role,
                profileName: agent.profileName,
                model: agent.model,
                division: agent.division,
                description: agent.description,
                capabilities: agent.capabilities,
                status: agent.status,
                createdAt: agent.createdAt,
                lastActivityAt: agent.lastActivityAt,
              },
              null,
              2
            )}
          </pre>
        </div>
      )}

      {tab === 'permissoes' && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-ink-subtle inline-flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-accent dark:text-cyan-300" /> <span>Permissões &amp; Acesso</span>
          </div>
          <pre className="p-4 rounded-xl border border-line bg-surface-subtle/40 font-mono text-[11px] overflow-x-auto max-h-80">
            {JSON.stringify(
              {
                note: 'Permissões são gerenciadas via RBAC do Hermes no backend.',
                agentId: agent.id,
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
};
