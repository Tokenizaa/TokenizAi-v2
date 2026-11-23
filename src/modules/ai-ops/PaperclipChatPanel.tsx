import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  MessageSquarePlus,
  Paperclip,
  RefreshCw,
  Send,
  Sparkles,
  User,
  Workflow,
} from 'lucide-react';
import { StatusText, UserAvatar } from '../../components/ui/Primitives';
import { formatDateTimeBR, PaperclipApi } from '../../services/api';
import type {
  NavSectionId,
  PaperclipAgentDto,
  PaperclipAttachmentDto,
  PaperclipChatThreadDto,
  PaperclipCommentDto,
  PaperclipIntegrationStatus,
} from '../../types/platform';
import { PaperclipStatusPanel } from './PaperclipStatusPanel';

interface PaperclipChatPanelProps {
  status: PaperclipIntegrationStatus;
  agents: PaperclipAgentDto[];
  initialAgentRef?: string | null;
  onNavigate: (sec: NavSectionId) => void;
  onOpenIssue?: (issueId: string) => void;
  onToast: (msg: string) => void;
}

export const PaperclipChatPanel: React.FC<PaperclipChatPanelProps> = ({
  status,
  agents,
  initialAgentRef,
  onNavigate,
  onOpenIssue,
  onToast,
}) => {
  const [chats, setChats] = useState<PaperclipChatThreadDto[]>([]);
  const [selectedRef, setSelectedRef] = useState<string | null>(initialAgentRef || null);
  const [activeThread, setActiveThread] = useState<PaperclipChatThreadDto | null>(null);
  const [messages, setMessages] = useState<PaperclipCommentDto[]>([]);
  const [attachments, setAttachments] = useState<PaperclipAttachmentDto[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [featureError, setFeatureError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isConnected =
    status.configured && status.reachable && status.authenticated && Boolean(status.companyId);

  const chatReadCap = status.availableCapabilities.find((c) => c.key === 'agent_chat:read');
  const chatWriteCap = status.availableCapabilities.find((c) => c.key === 'agent_chat:write');
  const chatUnavailable =
    chatReadCap?.availableInVersion === false || chatReadCap?.authState === 'forbidden';

  const loadChats = useCallback(async (silent = false) => {
    if (!isConnected || chatUnavailable) return;
    if (!silent) {
      setLoadingThreads(true);
      setFeatureError(null);
    }
    try {
      const res = await PaperclipApi.listChats();
      setChats(res.chats || []);
      if (!selectedRef && res.chats.length > 0) {
        setSelectedRef(res.chats[0].agentRef || res.chats[0].agentId);
      }
    } catch (err) {
      if (!silent) {
        setFeatureError(err instanceof Error ? err.message : 'Recurso de Agent Chat indisponível nesta instância.');
      }
    } finally {
      if (!silent) setLoadingThreads(false);
    }
  }, [isConnected, chatUnavailable, selectedRef]);

  const loadConversation = useCallback(
    async (agentRef: string, silent = false) => {
      if (!isConnected || !agentRef || chatUnavailable) return;
      if (!silent) {
        setLoadingMessages(true);
        setFeatureError(null);
      }
      try {
        const res = await PaperclipApi.getChat(agentRef);
        setActiveThread(res.thread);
        setMessages(res.messages || []);
        if (res.thread?.issueId) {
          const attRes = await PaperclipApi.getIssueAttachments(res.thread.issueId).catch(() => ({
            attachments: [],
          }));
          setAttachments(attRes.attachments || []);
        } else {
          setAttachments([]);
        }
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
    [isConnected, chatUnavailable],
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
    setAttachments([]);
    if (selectedRef) {
      loadConversation(selectedRef);
    }
  }, [selectedRef, loadConversation]);

  // Silent background polling for active conversation & chat list
  useEffect(() => {
    if (!isConnected || chatUnavailable) return;
    const intervalMs = Math.max(5000, status.syncIntervalMs || 15000);
    const timer = window.setInterval(() => {
      loadChats(true);
      if (selectedRef) {
        loadConversation(selectedRef, true);
      }
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isConnected, chatUnavailable, status.syncIntervalMs, selectedRef, loadChats, loadConversation]);

  const conversationList = useMemo(() => {
    const byAgent = new Map<string, PaperclipChatThreadDto>();
    for (const c of chats) {
      byAgent.set(c.agentId || c.agentRef, c);
    }
    for (const ag of agents) {
      if (!byAgent.has(ag.id)) {
        byAgent.set(ag.id, {
          id: `agent-${ag.id}`,
          agentId: ag.id,
          agentRef: ag.id,
          agentName: ag.name,
          agentRole: ag.role,
          agentAvatarUrl: ag.avatarUrl,
          canSend: true,
        });
      }
    }
    return Array.from(byAgent.values());
  }, [chats, agents]);

  const handleSend = async (textOverride?: string) => {
    if (!selectedRef) return;
    const body = (textOverride ?? draft).trim();
    if (!body) return;
    setSending(true);
    try {
      const res = await PaperclipApi.sendChatMessage(selectedRef, {
        body,
        issueId: body === '/new' ? undefined : activeThread?.issueId,
      });
      if (res.thread) {
        setActiveThread(res.thread);
      }
      if (!textOverride) setDraft('');
      await Promise.all([loadConversation(selectedRef), loadChats(true)]);
      if (body === '/new') {
        onToast('Nova sessão iniciada com o agente via comando /new.');
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao enviar mensagem para o Paperclip.');
    } finally {
      setSending(false);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeThread?.issueId) {
      onToast('Inicie a conversa antes de enviar um anexo para a issue da conversa.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      onToast('Anexo excede o limite de 4 MB.');
      return;
    }

    setUploading(true);
    try {
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const commaIdx = result.indexOf(',');
          resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
        };
        reader.onerror = () => reject(new Error('Falha ao ler arquivo selecionado.'));
        reader.readAsDataURL(file);
      });

      await PaperclipApi.uploadIssueAttachment(activeThread.issueId, {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        base64Content,
      });
      await loadConversation(selectedRef!);
      onToast(`Anexo "${file.name}" enviado ao Paperclip.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao enviar anexo.');
    } finally {
      setUploading(false);
    }
  };

  if (!isConnected) {
    return (
      <PaperclipStatusPanel
        status={status}
        title="Chat com Agentes (Paperclip Agent Chat)"
        requiredCapabilities={['agent_chat:read', 'agent_chat:write']}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PaperclipStatusPanel
        status={status}
        title="Agent Chat Oficial"
        requiredCapabilities={['agent_chat:read', 'agent_chat:write']}
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
        {/* Left Sidebar: Real Paperclip Agents & Active Chats */}
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
                Nenhum agente disponível nesta empresa Paperclip para iniciar conversa.
              </div>
            ) : (
              conversationList.map((item) => {
                const ref = item.agentRef || item.agentId;
                const isActive = selectedRef === ref;
                return (
                  <button
                    key={item.id}
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
                        {typeof item.unreadCount === 'number' && item.unreadCount > 0 && (
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent text-white">
                            {item.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-ink-subtle truncate">
                        {item.agentRole || 'Agente Paperclip'}
                        {item.issueIdentifier ? ` · ${item.issueIdentifier}` : ''}
                      </div>
                      {item.lastMessagePreview && (
                        <div className="text-xs text-ink-muted truncate mt-1">
                          {item.lastMessagePreview}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Chat Workspace */}
        <section className="lg:col-span-8 nc-glow-panel rounded-2xl overflow-hidden flex flex-col">
          {!selectedRef ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
              <Sparkles className="w-6 h-6 text-accent dark:text-cyan-300" />
              <div className="font-display text-base font-semibold text-ink">
                Selecione um agente para conversar
              </div>
              <p className="text-xs text-ink-subtle max-w-md">
                As mensagens são lidas e gravadas diretamente no Agent Chat oficial do Paperclip usando a issue da conversa.
              </p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3.5 border-b border-line flex flex-wrap items-center justify-between gap-3 bg-surface-subtle/40">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-sm font-semibold text-ink truncate">
                      {activeThread?.agentName || selectedRef}
                    </h3>
                    {activeThread?.issueIdentifier && (
                      <span className="font-mono text-[11px] text-accent dark:text-cyan-300">
                        {activeThread.issueIdentifier}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-ink-subtle">
                    {activeThread?.lastMessageAt
                      ? `Última interação: ${formatDateTimeBR(activeThread.lastMessageAt)}`
                      : 'Conversa vinculada ao Paperclip'}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {activeThread?.issueId && onOpenIssue && (
                    <button
                      type="button"
                      onClick={() => onOpenIssue(activeThread.issueId!)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line-strong text-xs font-medium text-ink hover:bg-surface-blue cursor-pointer"
                    >
                      <Workflow className="w-3.5 h-3.5" />
                      <span>Abrir issue da conversa</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={sending || chatWriteCap?.availableInVersion === false}
                    onClick={() => handleSend('/new')}
                    title="Envia /new para iniciar nova sessão oficial no Paperclip"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line-strong text-xs font-medium text-ink hover:bg-surface-blue cursor-pointer"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    <span>Nova sessão (/new)</span>
                  </button>
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

              {/* Message Feed */}
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
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {m.attachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={PaperclipApi.getAttachmentContentUrl(att.id)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-line-strong bg-canvas text-[11px] text-accent dark:text-cyan-300 hover:underline"
                                >
                                  <Paperclip className="w-3 h-3" />
                                  <span>{att.filename}</span>
                                </a>
                              ))}
                            </div>
                          )}
                          {m.linkedIssueIds && m.linkedIssueIds.length > 0 && onOpenIssue && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {m.linkedIssueIds.map((issId) => (
                                <button
                                  key={issId}
                                  type="button"
                                  onClick={() => onOpenIssue(issId)}
                                  className="text-[11px] font-mono text-accent dark:text-cyan-300 hover:underline cursor-pointer"
                                >
                                  Ver tarefa #{issId}
                                </button>
                              ))}
                            </div>
                          )}
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

              {/* Attachments Strip */}
              {attachments.length > 0 && (
                <div className="px-5 py-2 border-t border-line bg-surface-subtle/30 flex items-center gap-2 overflow-x-auto text-xs">
                  <span className="text-ink-subtle shrink-0">Anexos:</span>
                  {attachments.map((att) => (
                    <a
                      key={att.id}
                      href={PaperclipApi.getAttachmentContentUrl(att.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-line-strong bg-surface text-accent dark:text-cyan-300 hover:underline shrink-0"
                    >
                      <Paperclip className="w-3 h-3" />
                      <span>{att.filename}</span>
                    </a>
                  ))}
                </div>
              )}

              {/* Message Composer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="p-4 border-t border-line bg-surface-subtle/30 flex items-end gap-2.5"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleUploadFile}
                />
                <button
                  type="button"
                  disabled={uploading || !activeThread?.issueId}
                  onClick={() => fileInputRef.current?.click()}
                  title={
                    activeThread?.issueId
                      ? 'Anexar arquivo na issue da conversa'
                      : 'Envie a primeira mensagem antes de anexar arquivos'
                  }
                  className="p-2.5 rounded-xl border border-line-strong bg-surface text-ink-muted hover:text-ink cursor-pointer disabled:opacity-40"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <textarea
                  rows={2}
                  value={draft}
                  disabled={activeThread?.canSend === false || chatWriteCap?.availableInVersion === false}
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
                    chatWriteCap?.availableInVersion === false
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
