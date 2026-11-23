import React, { useCallback, useEffect, useState } from 'react';
import { Search, MessageSquare, Users, User, RefreshCw, Bot, AlertCircle } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Primitives';
import {
  SectionTitle,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components';
import { paperclipService } from '../services/paperclip';
import type { PaperclipChatThreadDto } from '../../../types/platform';

interface ChatPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<PaperclipChatThreadDto[]>([]);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [agent, setAgent] = useState<any>(null);
  const [directSendAvailable, setDirectSendAvailable] = useState<boolean | null>(null);

  const loadChats = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAgent(null);
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

  const openConversation = async (conversation: PaperclipChatThreadDto) => {
    setSelectedRef(conversation.conversationAgentId || conversation.agentRef || conversation.id);
    setAgent(null);
    try {
      const agentId = conversation.conversationAgentId || conversation.agentRef;
      if (agentId) {
        const res = await paperclipService.getAgent(agentId);
        setAgent(res.agent || null);
      }
    } catch {
      setAgent(null);
    }
  };

  const handleOpenAgentDetail = () => {
    if (agent?.id) onNavigate(`ia-agente-detalhe:${agent.id}`);
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Não foi possível carregar o chat" message={error} onRetry={loadChats} />;
  if (chats.length === 0) {
    return (
      <EmptyState
        title="Nenhuma conversa encontrada"
        description="A instância Paperclip conectada não retornou conversas de agentes para esta empresa."
      />
    );
  }

  return (
    <div className="flex flex-col h-full gap-0">
      <PageHeader
        title="Chat com agentes (Agent Chat)"
        subtitle="Conversas reais por agente diretamente na estrutura oficial do Paperclip. O envio de mensagem direta depende de sessão de agente autenticada na instância operacional."
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
            {chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => openConversation(chat)}
                className={`w-full text-left rounded-xl p-3 transition-colors ${
                  selectedRef === chat.conversationAgentId
                    ? 'bg-accent-soft border border-accent text-accent-ink'
                    : 'hover:bg-surface-subtle border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full border border-line-strong bg-surface-subtle flex items-center justify-center text-[10px] font-semibold shrink-0">
                      {(chat.agentName || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-ink truncate">{chat.agentName || 'Agente'}</div>
                      <div className="text-[10px] text-ink-subtle truncate">
                        {chat.conversationState || '—'} · {chat.status || '—'}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={chat.status || 'desconhecido'} size="sm" />
                </div>
                {chat.title && (
                  <div className="mt-1 text-[11px] text-ink-subtle truncate">{chat.title}</div>
                )}
                {chat.lastMessagePreview && (
                  <div className="mt-0.5 text-[11px] text-ink-subtle truncate">
                    {chat.lastMessagePreview}
                  </div>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Painel central: detalhe da conversa / agente */}
        <main className="flex-1 min-w-0 flex flex-col bg-surface">
          {!selectedRef ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
              <div className="w-12 h-12 rounded-full border border-line-strong bg-surface-subtle flex items-center justify-center text-ink-subtle mb-3">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="text-base font-semibold text-ink">Selecione uma conversa</div>
              <p className="text-xs text-ink-muted mt-1">
                Escolha um agente à esquerda para ver seus dados operacionais no Paperclip.
              </p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-line bg-surface-subtle/40 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full border border-line-strong bg-surface-subtle flex items-center justify-center text-[10px] font-semibold shrink-0">
                      {(agent?.title || agent?.name || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-ink">
                        {agent?.title || agent?.name || 'Agente'}
                      </div>
                      <div className="text-[10px] text-ink-subtle">
                        {agent?.role || 'Agente Paperclip'} ·
                        {agent?.status || '—'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {agent && (
                    <button
                      type="button"
                      onClick={handleOpenAgentDetail}
                      className="p-1.5 rounded-lg border border-line-strong text-accent dark:text-cyan-300 hover:bg-surface-blue cursor-pointer"
                      title="Abrir detalhe do agente"
                    >
                      <Bot className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedRef(null)}
                    className="p-1.5 rounded-lg border border-line-strong text-ink-muted hover:text-ink hover:bg-surface-subtle cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {agent ? (
                  <div className="space-y-4">
                    <div className="nc-card rounded-2xl p-4 space-y-3">
                      <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">
                        Conversa
                      </div>
                      <div className="text-sm text-ink">{selectedRef}</div>
                      <div className="text-xs text-ink-muted">
                        Fonte: endpoint de conversas da instância Paperclip
                      </div>
                    </div>
                    <div className="nc-card rounded-2xl p-4 space-y-3">
                      <div className="text-xs text-ink-subtle font-semibold tracking-wide uppercase">
                        Agente da conversa
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-ink-subtle">Nome</div>
                          <div className="font-medium text-ink">{agent.title || agent.name}</div>
                        </div>
                        <div>
                          <div className="text-ink-subtle">Role</div>
                          <div className="font-medium text-ink">{agent.role || '—'}</div>
                        </div>
                        <div>
                          <div className="text-ink-subtle">Status</div>
                          <StatusBadge status={agent.status || 'desconhecido'} size="sm" />
                        </div>
                        <div>
                          <div className="text-ink-subtle">Adapter</div>
                          <div className="font-mono text-ink-muted">{agent.adapterType || '—'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-xs text-ink-subtle">
                    Carregando dados do agente…
                  </div>
                )}

                <div className="nc-card rounded-2xl p-5 border border-amber-200/60 bg-amber-50/40 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/20 dark:text-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-amber-900 dark:text-amber-200">
                        Envio de mensagem direta indisponível neste modo
                      </div>
                      <div className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                        O endpoint de envio de chat do Paperclip exige uma sessão de agente autenticada
                        (task run), que não está disponível no modo local_trusted sem bearer. As
                        conversas acima são reais e vêm da instância conectada. Para trocar mensagens
                        vinculadas a uma tarefa, use os comentários na página de detalhe da tarefa
                        (endpoint de comentários da issue relacionada).
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};
