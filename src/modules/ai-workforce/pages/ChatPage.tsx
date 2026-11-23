import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, MessageSquare, Users, User, Send, Paperclip, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import {
  SectionTitle,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components';
import { paperclipService } from '../services/paperclip';
import type { PaperclipChatThreadDto, PaperclipCommentDto } from '../../../types/platform';

interface ChatPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<PaperclipChatThreadDto[]>([]);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [thread, setThread] = useState<PaperclipChatThreadDto | null>(null);
  const [messages, setMessages] = useState<PaperclipCommentDto[]>([]);
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadChats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paperclipService.listChats();
      setChats(res.chats || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar as conversas do Paperclip.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const openChat = async (agentRef: string) => {
    setSelectedRef(agentRef);
    setThread(null);
    setMessages([]);
    try {
      const res = await paperclipService.getChat(agentRef);
      setThread(res.thread || null);
      setMessages(res.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a conversa.');
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composer.trim() || !selectedRef) return;
    setSending(true);
    try {
      await paperclipService.sendChatMessage(selectedRef, { body: composer.trim() });
      setComposer('');
      await openChat(selectedRef);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha ao enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar o chat" message={error} onRetry={loadChats} />;

  return (
    <div className="flex flex-col h-full gap-0">
      <PageHeader
        title="Chat com agentes (Agent Chat)"
        subtitle="Conversas reais por agente diretamente na estrutura oficial do Paperclip."
        actions={
          <button
            type="button"
            onClick={loadChats}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Recarregar
          </button>
        }
      />

      <div className="flex flex-1 min-h-0">
        {/* Painel esquerdo: conversas */}
        <aside className="hidden lg:flex flex-col w-[320px] border-r border-line bg-surface">
          <div className="px-4 py-3 border-b border-line bg-surface-subtle/40">
            <SectionTitle title="Conversas" subtitle={chats.length > 0 ? `${chats.length} conversa(s)` : undefined} />
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {chats.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-ink-subtle">Nenhuma conversa encontrada.</div>
            ) : (
              chats.map((chat) => (
                <button
                  key={chat.agentRef}
                  type="button"
                  onClick={() => openChat(chat.agentRef)}
                  className={`w-full text-left rounded-xl p-3 transition-colors ${
                    selectedRef === chat.agentRef
                      ? 'bg-accent-soft border border-accent text-accent-ink'
                      : 'hover:bg-surface-subtle border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full border border-line-strong bg-surface-subtle flex items-center justify-center text-[10px] font-semibold shrink-0">
                        {chat.agentName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-ink truncate">{chat.agentName}</div>
                        <div className="text-[10px] text-ink-subtle truncate">{chat.agentRole || 'Agente Paperclip'}</div>
                      </div>
                    </div>
                    {chat.unreadCount && chat.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                  {chat.lastMessagePreview && (
                    <div className="mt-1 text-[11px] text-ink-subtle truncate">{chat.lastMessagePreview}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Painel central: mensagens */}
        <main className="flex-1 min-w-0 flex flex-col bg-surface">
          {!selectedRef ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
              <div className="w-12 h-12 rounded-full border border-line-strong bg-surface-subtle flex items-center justify-center text-ink-subtle mb-3">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="text-base font-semibold text-ink">Selecione uma conversa</div>
              <p className="text-xs text-ink-muted mt-1">Escolha um agente à esquerda para iniciar ou continuar o chat.</p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-line bg-surface-subtle/40 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full border border-line-strong bg-surface-subtle flex items-center justify-center text-[10px] font-semibold shrink-0">
                      {thread?.agentName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-ink">{thread?.agentName}</div>
                      <div className="text-[10px] text-ink-subtle">{thread?.agentRole || 'Agente Paperclip'}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRef(null)}
                    className="p-1.5 rounded-lg border border-line-strong text-ink-muted hover:text-ink hover:bg-surface-subtle cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-10 text-xs text-ink-subtle">
                    Sem mensagens nesta conversa. Escreva abaixo para iniciar.
                  </div>
                ) : (
                  <>
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`max-w-[80%] ${
                          m.authorType === 'user' ? 'ml-auto' : 'mr-auto'
                        }`}
                      >
                        <div className="inline-block rounded-xl px-3 py-2 text-sm ${
                          m.authorType === 'user'
                            ? 'bg-accent text-white'
                            : 'bg-surface-subtle border border-line text-ink'
                        }">
                          {m.body}
                        </div>
                        <div className="text-[10px] text-ink-subtle mt-0.5">
                          {m.authorName} · {m.createdAt}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
              <form onSubmit={sendMessage} className="px-4 py-3 border-t border-line bg-surface">
                <div className="flex items-center gap-2">
                  <textarea
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    placeholder="Escreva uma mensagem para o agente…"
                    rows={1}
                    className="flex-1 resize-none p-2.5 rounded-xl border border-line-strong bg-white text-xs text-ink focus:border-accent focus:ring-0 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !composer.trim()}
                    className="px-4 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Enviar</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </main>

        {/* Painel direito: informações do agente */}
        <aside className="hidden lg:flex flex-col w-[300px] border-l border-line bg-surface">
          <div className="px-4 py-3 border-b border-line bg-surface-subtle/40">
            <SectionTitle title="Informações do agente" />
          </div>
          <div className="flex-1 p-3 space-y-4">
            {thread ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-semibold text-ink-subtle uppercase">Identidade</div>
                  <div className="font-medium text-ink">{thread.agentName}</div>
                  <div className="text-[11px] text-ink-muted">{thread.agentRole || 'Agente Paperclip'}</div>
                </div>
                {thread.issueId && (
                  <div>
                    <div className="text-[10px] font-semibold text-ink-subtle uppercase">Issue relacionada</div>
                    <div className="font-mono text-[11px] text-accent dark:text-cyan-300">{thread.issueId}</div>
                    <button
                      type="button"
                      onClick={() => onNavigate(`ia-tarefa-detalhe:${thread.issueId}`)}
                      className="mt-2 text-[11px] text-accent dark:text-cyan-300 underline hover:text-accent-ink cursor-pointer"
                    >
                      Abrir tarefa
                    </button>
                  </div>
                )}
                <div>
                  <div className="text-[10px] font-semibold text-ink-subtle uppercase">Estado</div>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> Ativo no Paperclip
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-ink-subtle">Selecione uma conversa para ver os detalhes do agente.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
