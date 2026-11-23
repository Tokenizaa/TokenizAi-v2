import type { PaperclipHttpClient } from './client.ts';
import { PaperclipIntegrationError } from './errors.ts';
import { matchesOpenApiRoute, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import type { PaperclipAttachmentDto, PaperclipChatThreadDto, PaperclipCommentDto } from './types.ts';

function extractList(raw: unknown, keys: string[]): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const k of keys) {
      if (Array.isArray(obj[k])) return obj[k] as Array<Record<string, unknown>>;
    }
  }
  return [];
}

export function normalizeAttachmentItem(raw: Record<string, unknown>): PaperclipAttachmentDto {
  return {
    id: String(raw.id || ''),
    filename: String(raw.filename || raw.name || 'anexo'),
    contentType:
      typeof raw.contentType === 'string'
        ? raw.contentType
        : typeof raw.mimeType === 'string'
          ? raw.mimeType
          : undefined,
    sizeBytes:
      typeof raw.sizeBytes === 'number'
        ? raw.sizeBytes
        : typeof raw.size === 'number'
          ? raw.size
          : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    uploadedBy: typeof raw.uploadedBy === 'string' ? raw.uploadedBy : undefined,
  };
}

function normalizeChatThread(raw: Record<string, unknown>): PaperclipChatThreadDto {
  const agent = (raw.agent as Record<string, unknown> | undefined) || {};
  const issue = (raw.issue as Record<string, unknown> | undefined) || {};
  const agentId = String(raw.agentId || agent.id || raw.agentRef || '');
  const agentRef = String(raw.agentRef || agent.slug || agentId);
  const issueId = raw.issueId
    ? String(raw.issueId)
    : issue.id
      ? String(issue.id)
      : raw.backingIssueId
        ? String(raw.backingIssueId)
        : undefined;

  return {
    id: String(raw.id || issueId || agentRef),
    agentId,
    agentRef,
    agentName: String(raw.agentName || agent.name || agent.title || 'Agente'),
    agentRole:
      typeof raw.agentRole === 'string'
        ? raw.agentRole
        : typeof agent.role === 'string'
          ? agent.role
          : undefined,
    agentAvatarUrl: typeof agent.avatarUrl === 'string' ? agent.avatarUrl : null,
    issueId,
    issueIdentifier:
      typeof issue.identifier === 'string'
        ? issue.identifier
        : typeof raw.issueIdentifier === 'string'
          ? raw.issueIdentifier
          : undefined,
    title:
      typeof raw.title === 'string'
        ? raw.title
        : typeof issue.title === 'string'
          ? issue.title
          : undefined,
    unreadCount: typeof raw.unreadCount === 'number' ? raw.unreadCount : undefined,
    lastMessageAt:
      typeof raw.lastMessageAt === 'string'
        ? raw.lastMessageAt
        : typeof raw.updatedAt === 'string'
          ? raw.updatedAt
          : undefined,
    lastMessagePreview:
      typeof raw.lastMessagePreview === 'string' ? raw.lastMessagePreview : undefined,
    ownerUserId: typeof raw.ownerUserId === 'string' ? raw.ownerUserId : undefined,
    canSend: typeof raw.canSend === 'boolean' ? raw.canSend : true,
    raw,
  };
}

export function normalizeComment(raw: Record<string, unknown>): PaperclipCommentDto {
  const author = (raw.author as Record<string, unknown> | undefined) || {};
  const body = String(raw.body || raw.content || raw.message || '');
  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map(normalizeAttachmentItem)
    : undefined;

  return {
    id: String(raw.id || `cmt-${Date.now()}`),
    issueId: raw.issueId ? String(raw.issueId) : undefined,
    authorType:
      typeof raw.authorType === 'string'
        ? raw.authorType
        : typeof author.type === 'string'
          ? author.type
          : raw.agentId || raw.authorAgentId
            ? 'agent'
            : 'user',
    authorId: raw.authorId
      ? String(raw.authorId)
      : raw.authorAgentId
        ? String(raw.authorAgentId)
        : raw.authorUserId
          ? String(raw.authorUserId)
          : typeof author.id === 'string'
            ? author.id
            : undefined,
    authorName: String(
      raw.authorName || author.name || (raw.authorAgentId ? 'Agente' : 'Usuário'),
    ),
    authorAvatarUrl: typeof author.avatarUrl === 'string' ? author.avatarUrl : null,
    body,
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    linkedIssueIds: Array.isArray(raw.linkedIssueIds) ? raw.linkedIssueIds.map(String) : undefined,
    attachments: attachments && attachments.length > 0 ? attachments : undefined,
  };
}

export class PaperclipChatsService {
  constructor(
    private readonly client: PaperclipHttpClient,
    private readonly getCompanyId: () => string | null,
    private readonly getOpenApi: () => PaperclipOpenApiSpecSummary | null,
  ) {}

  async listChats(): Promise<PaperclipChatThreadDto[]> {
    const companyId = this.getCompanyId();
    if (!companyId) return [];
    const raw = await this.client.requestJson<unknown>(
      `/api/companies/${encodeURIComponent(companyId)}/chats`,
      {
        method: 'GET',
        capabilityKey: 'agent_chat:read',
        cacheTtlMs: 3000,
      },
    );
    return extractList(raw, ['chats', 'threads', 'items']).map(normalizeChatThread);
  }

  async getChat(agentRef: string): Promise<{
    thread: PaperclipChatThreadDto;
    messages: PaperclipCommentDto[];
    attachments?: PaperclipAttachmentDto[];
  }> {
    const companyId = this.getCompanyId();
    if (!companyId) {
      throw new Error('Empresa Paperclip não selecionada.');
    }

    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/companies/${encodeURIComponent(companyId)}/chats/${encodeURIComponent(agentRef)}`,
      {
        method: 'GET',
        capabilityKey: 'agent_chat:read',
        isEntityLookup: true,
      },
    );

    const thread = normalizeChatThread(
      ((raw.chat || raw.thread) as Record<string, unknown> | undefined) || raw,
    );
    let messages: PaperclipCommentDto[] = [];

    if (Array.isArray(raw.messages)) {
      messages = raw.messages.map((m) => normalizeComment(m as Record<string, unknown>));
    } else if (Array.isArray(raw.comments)) {
      messages = raw.comments.map((m) => normalizeComment(m as Record<string, unknown>));
    }

    if (messages.length === 0 && thread.issueId) {
      const commentsRaw = await this.client.requestJson<unknown>(
        `/api/issues/${encodeURIComponent(thread.issueId)}/comments`,
        {
          method: 'GET',
          capabilityKey: 'agent_chat:read',
          isEntityLookup: true,
        },
      );
      messages = extractList(commentsRaw, ['comments', 'items']).map(normalizeComment);
    }

    const inlineAttachments = Array.isArray(raw.attachments)
      ? raw.attachments
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          .map(normalizeAttachmentItem)
      : undefined;

    return { thread, messages, attachments: inlineAttachments };
  }

  /**
   * Sends a user message via the official Board/User Agent Chat endpoint.
   * Never uses /api/agents/me/chat/messages (which is reserved for agent identity).
   * Sending "/new" starts a new agent chat session per Paperclip specification while preserving prior issue history.
   */
  async sendMessage(
    agentRef: string,
    payload: { body: string; issueId?: string },
  ): Promise<{ thread?: PaperclipChatThreadDto; message?: PaperclipCommentDto }> {
    const companyId = this.getCompanyId();
    if (!companyId) {
      throw new Error('Empresa Paperclip não selecionada.');
    }

    const trimmed = payload.body.trim();
    if (!trimmed) {
      throw new PaperclipIntegrationError({
        kind: 'validation_error',
        statusCode: 400,
        message: 'Conteúdo da mensagem é obrigatório.',
      });
    }

    const openApi = this.getOpenApi();
    const supportsOfficialAgentChatPost =
      !openApi?.available ||
      matchesOpenApiRoute(openApi, 'POST', '/api/companies/{companyId}/chats/{agentRef}');

    if (!supportsOfficialAgentChatPost && payload.issueId && trimmed !== '/new') {
      const commentRaw = await this.client.requestJson<Record<string, unknown>>(
        `/api/issues/${encodeURIComponent(payload.issueId)}/comments`,
        {
          method: 'POST',
          body: { body: trimmed },
          capabilityKey: 'agent_chat:write',
        },
      );
      return { message: normalizeComment(commentRaw) };
    }

    const chatResp = await this.client.requestJson<Record<string, unknown>>(
      `/api/companies/${encodeURIComponent(companyId)}/chats/${encodeURIComponent(agentRef)}`,
      {
        method: 'POST',
        body: { body: trimmed, message: trimmed },
        capabilityKey: 'agent_chat:write',
      },
    );

    const thread = normalizeChatThread(
      ((chatResp.chat || chatResp.thread) as Record<string, unknown> | undefined) || chatResp,
    );
    const msgRaw = (chatResp.comment || chatResp.message) as Record<string, unknown> | undefined;
    return {
      thread,
      message: msgRaw ? normalizeComment(msgRaw) : undefined,
    };
  }
}
