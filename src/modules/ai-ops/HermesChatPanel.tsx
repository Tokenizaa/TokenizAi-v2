import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Sparkles,
  User,
} from 'lucide-react';
import { StatusText, UserAvatar } from '../../components/ui/Primitives';
import { formatDateTimeBR, HermesApi } from '../../services/api';
import type {
  HermesIntegrationStatus,
  NavSectionId,
  HermesBotDto,
  HermesChatThreadDto,
  HermesChatMessageDto,
} from '../../types/platform';
import { HermesStatusPanel } from './HermesStatusPanel';

interface HermesChatPanelProps {
  status: HermesIntegrationStatus;
  agents: HermesBotDto[];
  initialAgentRef?: string | null;
  onNavigate: (sec: NavSectionId) => void;
  onOpenIssue?: (issueId: string) => void;
  onToast: (msg: string) => void;
}

interface ChatItem {
  agentId: string;
  agentRef: string;
  agentName: string;
  agentRole?: string;
  agentAvatarUrl?: string;
}

export const HermesChatPanel: React.FC<HermesChatPanelProps> = ({
  status,
  agents,
  initialAgentRef,
  onNavigate,
  onOpenIssue,
  onToast,
}) => {
  const isConnected = status.configured && status.connected;

  const [chats, setChats] = useState<HermesChatThreadDto[]>([]);
  const [selectedRef, setSelectedRef] = useState<string | null>(initialAgentRef || null);
  const [activeThread, setActiveThread] = useState<HermesChatThreadDto | null>(null);
  const [messages, setMessages] = useState<HermesChatMessageDto[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [featureError, setFeatureError] = useState<string | null>(null);

  const chatReadCap = status.availableCapabilities.find((c) => c.key === 'chats:read');
  const chatWriteCap = status.availableCapabilities.find((c) => c.key === 'chats:write');
  const chatUnavailable = !chatReadCap?.available;

  const loadChats = useCallback(async (silent = false) => {
    if (!isConnected || chatUnavailable) return;
    if (!silent) {
      setLoadingThreads(true);
      setFeatureError(null);
    }
    try {
      const res = await HermesApi.listChats();
      setChats(res.chats || []);
      if (!selectedRef && res.chats.length > 0) {
        setSelectedRef(res.chats[0].agentId);
      }
    } catch (err) {
      if (!silent) {
        setFeatureError(err instanceof Error ? err.message : 'Recurso de Agent Chat indisponível.');
      }
    } finally {
      if (!silent) setLoadingThreads(false);
    }
  }, [isConnected, chatUnavailable, selectedRef]);

  const loadConversation = useCallback(
    async (agentRef: string, silent = false) => {
      if (!isConnected || !agentRef) return;
      if (!silent) {
        setLoadingMessages(true);
        setFeatureError(null);
      }
      try {
        const res = await HermesApi.getChat(agentRef);
        setActiveThread(res.thread);
        setMessages(res.messages || []);
      } catch (err) {
        if (!silent) {
          setFeatureError(
            err instanceof Error ? err.message : 'Não foi possível carregar o histórico desta conversa.',
          );
        }
      } finally {
        if (!silent) setLoadingMessages(false);
      }
    },
    [isConnected],
  );

  useEffect(() => {
    if (initialAgentRef) {
      setSelectedRef(initialAgentRef);
    }
  }, [initialAgentRef]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    setActiveThread(null);
    setMessages([]);
    if (selectedRef) {
      loadConversation(selectedRef);
    }
  }, [selectedRef, loadConversation]);

  useEffect(() => {
    if (!isConnected) return;
    const timer = window.setInterval(() => {
      loadChats(true);
      if (selectedRef) {
        loadConversation(selectedRef, true);
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [isConnected, selectedRef, loadChats, loadConversation]);

  const conversationList = useMemo(() => {
    const byAgent = new Map<string, ChatItem>();
    for (const c of chats) {
      byAgent.set(c.agentId, {
        agentId: c.agentId,
        agentRef: c.agentId,
        agentName: c.agentName,
        agentRole: c.agentRole,
        agentAvatarUrl: undefined,
      });
    }
    for (const ag of agents) {
      if (!byAgent.has(ag.id)) {
        byAgent.set(ag.id, {
          agentId: ag.id,
          agentRef: ag.id,
          agentName: ag.name,
          agentRole: ag.role,
          agentAvatarUrl: undefined,
        });
      }
    }
    return Array.from(byAgent.values());
  }, [chats, agents]);

  const handleSend = useCallback(async (textOverride?: string) => {
    if (!selectedRef) return;
    const body = (textOverride ?? draft).trim();
    if (!body) return;
    setSending(true);
    try {
      const res = await HermesApi.sendChatMessage(selectedRef, { body });
      if (res.message) {
        setMessages((prev) => [...prev, res.message]);
      }
      if (!textOverride) setDraft('');
      await Promise.all([loadConversation(selectedRef), loadChats(true)]);
      if (body === '/new') {
        onToast('Nova sessão iniciada com o agente via comando /new.');
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao enviar mensagem para o Hermes.');
    } finally {
      setSending(false);
    }
  }, [selectedRef, draft, loadConversation, loadChats, onToast]);

  if (!isConnected) {
    return (
      <HermesStatusPanel
        status={status}
        title="Chat com Agentes (Hermes)"
        requiredCapabilities={['chats:read', 'chats:write']}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-4">
      <HermesStatusPanel
        status={status}
        title="Chat com Agentes (Hermes)"
        requiredCapabilities={['chats:read', 'chats:write']}
        onNavigate={onNavigate}
        compact
      />

      {featureError && (
        <div className="nc-card rounded-xl p-4 border border-amber-500/40 bg-amber-500/5 text-xs text-ink-muted flex items-center justify-between gap-3">
          <span>{featureError}</span>
          <button
            type="button"
            onClick={() => loadChats(false)}
            className="px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[560px]">
        <aside className="lg:col-span-4 nc-card rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3.5 border-b border-line flex items-center justify-between gap-2 bg-surface-subtle/40">
            <div>
              <h2 className="font-display text-sm font-semibold text-ink">Agentes & Conversas</h2>
              <p className="text-[11px] text-ink-subtle">Uma conversa oficial por agente e usuário</p>
            </div>
            <button
              type="button"
              onClick={() => loadChats(false)}
              disabled={loadingThreads}
              className="p-1.5 rounded-lg border border-line-strong text-ink-muted hover:text-ink cursor-pointer"
              title="Atualizar conversas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingThreads ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-line">
            {conversationList.length === 0 ? (
              <div className="p-6 text-center text-xs text-ink-subtle">
                Nenhum agente disponível neste runtime Hermes para iniciar conversa.
              </div>
            ) : (
              conversationList.map((item) => {
                const ref = item.agentRef || item.agentId;
                const isActive = selectedRef === ref;
                return (
                  <button
                    key={item.agentId}
                    type="button"
                    onClick={() => setSelectedRef(ref)}
                    className={`w-full px-4 py-3.5 text-left flex items-start gap-3 transition-colors cursor-pointer ${
                      isActive ? 'bg-surface-blue/70' : 'hover:bg-surface-blue/35'
                    }`}
                  >
                    <UserAvatar name={item.agentName} src={item.agentAvatarUrl || undefined} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink truncate">{item.agentName}</span>
                      </div>
                      <div className="text-[11px] text-ink-subtle truncate">
                        {item.agentRole || 'Agente Hermes'}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="lg:col-span-8 nc-glow-panel rounded-2xl overflow-hidden flex flex-col">
          {!selectedRef ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
              <Sparkles className="w-6 h-6 text-accent dark:text-cyan-300" />
              <div className="font-display text-base font-semibold text-ink">
                Selecione um agente para conversar
              </div>
              <p className="text-xs text-ink-subtle max-w-md">
                As mensagens são lidas e gravadas diretamente no Agent Chat do Hermes.
              </p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3.5 border-b border-line flex flex-wrap items-center justify-between gap-3 bg-surface-subtle/40">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-sm font-semibold text-ink truncate">
                      {activeThread?.agentName || selectedRef}
                    </h3>
                  </div>
                  <div className="text-[11px] text-ink-subtle">
                    {activeThread?.lastMessageAt
                      ? `Última interação: ${formatDateTimeBR(activeThread.lastMessageAt)}`
                      : 'Conversa vinculada ao Hermes'}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={loadingMessages}
                    onClick={() => loadConversation(selectedRef)}
                    className="p-1.5 rounded-lg border border-line-strong text-ink-muted hover:text-ink cursor-pointer"
                    title="Atualizar mensagens"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingMessages ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[420px]">
                {messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-ink-subtle">
                    Nenhuma mensagem registrada nesta conversa ainda. Envie a primeira instrução abaixo.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isAgent = m.authorType === 'agent';
                    return (
                      <div
                        key={m.id}
                        className={`flex gap-3 ${isAgent ? 'justify-start' : 'justify-end'}`}
                      >
                        {isAgent && (
                          <span className="w-7 h-7 rounded-full bg-surface-blue border border-line-strong flex items-center justify-center shrink-0 mt-0.5">
                            <Bot className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
                          </span>
                        )}
                        <div
                          className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm space-y-1.5 border ${
                            isAgent
                              ? 'bg-surface border-line text-ink'
                              : 'bg-surface-blue/80 border-accent/30 text-ink'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 text-[11px] text-ink-subtle">
                            <span className="font-semibold text-ink">{m.authorName}</span>
                            <span className="font-mono">{formatDateTimeBR(m.createdAt)}</span>
                          </div>
                          <div className="whitespace-pre-wrap leading-relaxed text-ink">{m.body}</div>
                        </div>
                        {!isAgent && (
                          <span className="w-7 h-7 rounded-full bg-surface-subtle border border-line-strong flex items-center justify-center shrink-0 mt-0.5">
                            <User className="w-3.5 h-3.5 text-ink-muted" />
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="p-4 border-t border-line bg-surface-subtle/30 flex items-end gap-2.5"
              >
                <textarea
                  rows={2}
                  value={draft}
                  disabled={activeThread?.canSend === false || !chatWriteCap?.available}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    activeThread?.canSend === false
                      ? 'Somente o proprietário desta conversa pode enviar mensagens.'
                      : 'Escreva para o agente (ou envie /new para iniciar nova sessão)...'
                  }
                  className="flex-1 px-3.5 py-2 rounded-xl border border-line-strong bg-canvas text-sm text-ink resize-none"
                />

                <button
                  type="submit"
                  disabled={
                    sending ||
                    !draft.trim() ||
                    activeThread?.canSend === false ||
                    chatWriteCap?.available === false
                  }
                  className="nc-primary-btn px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              </form>

              {activeThread?.canSend === false && (
                <div className="px-5 pb-3 text-[11px] text-amber-700 dark:text-amber-300">
                  <StatusText label="Autorização restrita ao proprietário da conversa" tone="attention" />
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};