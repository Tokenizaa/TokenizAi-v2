import { normalizeAttachmentItem, normalizeComment } from './chats.ts';
import type { PaperclipHttpClient } from './client.ts';
import { assertCompanyScope } from './errors.ts';
import { findOpenApiRoute, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import { normalizeRun } from './runs.ts';
import type {
  PaperclipAttachmentDto,
  PaperclipCommentDto,
  PaperclipIssueDto,
  PaperclipRunDto,
} from './types.ts';

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

export function normalizeIssue(raw: Record<string, unknown>): PaperclipIssueDto {
  const assignee = (raw.assigneeAgent as Record<string, unknown> | undefined) || {};
  const project = (raw.project as Record<string, unknown> | undefined) || {};

  return {
    id: String(raw.id || ''),
    identifier: typeof raw.identifier === 'string' ? raw.identifier : undefined,
    title: String(raw.title || 'Tarefa operacional'),
    description: typeof raw.description === 'string' ? raw.description : undefined,
    status: String(raw.status || 'todo'),
    priority: typeof raw.priority === 'string' ? raw.priority : undefined,
    assigneeAgentId: raw.assigneeAgentId ? String(raw.assigneeAgentId) : null,
    assigneeAgentName: typeof raw.assigneeAgentName === 'string'
      ? raw.assigneeAgentName
      : typeof assignee.name === 'string'
        ? assignee.name
        : typeof raw.assigneeName === 'string'
          ? raw.assigneeName
          : null,
    assigneeUserId: raw.assigneeUserId ? String(raw.assigneeUserId) : null,
    projectId: raw.projectId ? String(raw.projectId) : null,
    projectName: typeof raw.projectName === 'string'
      ? raw.projectName
      : typeof project.name === 'string'
        ? project.name
        : null,
    goalId: raw.goalId ? String(raw.goalId) : null,
    parentId: raw.parentId ? String(raw.parentId) : null,
    blockedByIssueIds: Array.isArray(raw.blockedByIssueIds) ? raw.blockedByIssueIds.map(String) : undefined,
    labels: Array.isArray(raw.labels)
      ? raw.labels.map((l) => {
          if (typeof l === 'string') return { name: l };
          const obj = l as Record<string, unknown>;
          return {
            id: obj.id ? String(obj.id) : undefined,
            name: String(obj.name || obj.label || ''),
            color: typeof obj.color === 'string' ? obj.color : undefined,
          };
        })
      : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : null,
    activeRun: (raw.activeRun as Record<string, unknown> | null | undefined) || null,
    dependencyReady: typeof raw.dependencyReady === 'boolean' ? raw.dependencyReady : undefined,
    unresolvedBlockerCount: typeof raw.unresolvedBlockerCount === 'number' ? raw.unresolvedBlockerCount : undefined,
    originKind: typeof raw.originKind === 'string' ? raw.originKind : undefined,
    originId: typeof raw.originId === 'string' ? raw.originId : undefined,
    blockerReason: typeof raw.blockerReason === 'string'
      ? raw.blockerReason
      : typeof raw.blockedReason === 'string'
        ? raw.blockedReason
        : undefined,
  };
}

export interface IssueFilterParams {
  status?: string;
  assigneeAgentId?: string;
  assigneeUserId?: string;
  participantAgentId?: string;
  projectId?: string;
  parentId?: string;
  labelId?: string;
  q?: string;
  limit?: number;
  originKind?: string;
  originId?: string;
}

export class PaperclipIssuesService {
  constructor(
    private readonly client: PaperclipHttpClient,
    private readonly getCompanyId: () => string | null,
    private readonly getOpenApi: () => PaperclipOpenApiSpecSummary | null,
  ) {}

  async listIssues(filters: IssueFilterParams = {}): Promise<PaperclipIssueDto[]> {
    const companyId = this.getCompanyId();
    const path = companyId ? `/api/companies/${encodeURIComponent(companyId)}/issues` : '/api/issues';
    const raw = await this.client.requestJson<unknown>(path, {
      method: 'GET',
      query: {
        status: filters.status,
        assigneeAgentId: filters.assigneeAgentId,
        assigneeUserId: filters.assigneeUserId,
        participantAgentId: filters.participantAgentId,
        projectId: filters.projectId,
        parentId: filters.parentId,
        labelId: filters.labelId,
        q: filters.q,
        limit: filters.limit,
        originKind: filters.originKind,
        originId: filters.originId,
      },
      capabilityKey: 'issues:read',
      cacheTtlMs: 3000,
    });
    return extractList(raw, ['issues', 'items', 'data']).map(normalizeIssue);
  }

  async getIssue(issueId: string): Promise<PaperclipIssueDto> {
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/issues/${encodeURIComponent(issueId)}`,
      {
        method: 'GET',
        capabilityKey: 'issues:read',
        isEntityLookup: true,
      },
    );
    assertCompanyScope(raw, this.getCompanyId(), 'issue');
    return normalizeIssue(raw);
  }

  async createIssue(payload: Record<string, unknown>): Promise<PaperclipIssueDto> {
    const companyId = this.getCompanyId();
    const path = companyId ? `/api/companies/${encodeURIComponent(companyId)}/issues` : '/api/issues';
    const raw = await this.client.requestJson<Record<string, unknown>>(path, {
      method: 'POST',
      body: payload,
      capabilityKey: 'issues:write',
    });
    assertCompanyScope(raw, companyId, 'issue');
    return normalizeIssue(raw);
  }

  async updateIssue(issueId: string, payload: Record<string, unknown>): Promise<PaperclipIssueDto> {
    await this.getIssue(issueId);
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/issues/${encodeURIComponent(issueId)}`,
      {
        method: 'PATCH',
        body: payload,
        capabilityKey: 'issues:write',
        isEntityLookup: true,
      },
    );
    assertCompanyScope(raw, this.getCompanyId(), 'issue');
    return normalizeIssue(raw);
  }

  async getComments(issueId: string): Promise<PaperclipCommentDto[]> {
    const raw = await this.client.requestJson<unknown>(
      `/api/issues/${encodeURIComponent(issueId)}/comments`,
      {
        method: 'GET',
        capabilityKey: 'issues:read',
        isEntityLookup: true,
      },
    );
    return extractList(raw, ['comments', 'items']).map(normalizeComment);
  }

  async addComment(issueId: string, body: string): Promise<PaperclipCommentDto> {
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/issues/${encodeURIComponent(issueId)}/comments`,
      {
        method: 'POST',
        body: { body },
        capabilityKey: 'issues:write',
        isEntityLookup: true,
      },
    );
    return normalizeComment(raw);
  }

  async getRuns(issueId: string): Promise<PaperclipRunDto[]> {
    const openApi = this.getOpenApi();
    const companyId = this.getCompanyId();
    const route = findOpenApiRoute(openApi, 'GET', [
      '/api/issues/{issueId}/runs',
      '/api/issues/{issueId}/heartbeat-runs',
    ]);

    if (route) {
      const resolved = route.replace(/\{[^}]+\}/, encodeURIComponent(issueId));
      const raw = await this.client.requestJson<unknown>(resolved, {
        method: 'GET',
        capabilityKey: 'issues:read',
        isEntityLookup: true,
      });
      return extractList(raw, ['runs', 'heartbeatRuns', 'items']).map(normalizeRun);
    }

    if (openApi?.available && companyId) {
      const raw = await this.client.requestJson<unknown>(
        `/api/companies/${encodeURIComponent(companyId)}/heartbeat-runs`,
        {
          method: 'GET',
          query: { issueId },
          capabilityKey: 'runs:read',
        },
      );
      return extractList(raw, ['runs', 'heartbeatRuns', 'items']).map(normalizeRun);
    }

    const raw = await this.client.requestJson<unknown>(
      `/api/issues/${encodeURIComponent(issueId)}/runs`,
      {
        method: 'GET',
        capabilityKey: 'issues:read',
        isEntityLookup: true,
      },
    );
    return extractList(raw, ['runs', 'heartbeatRuns', 'items']).map(normalizeRun);
  }

  async getDocuments(issueId: string): Promise<Array<Record<string, unknown>>> {
    const raw = await this.client.requestJson<unknown>(
      `/api/issues/${encodeURIComponent(issueId)}/documents`,
      {
        method: 'GET',
        capabilityKey: 'issues:read',
        isEntityLookup: true,
      },
    );
    return extractList(raw, ['documents', 'items']);
  }

  async getAttachments(issueId: string): Promise<PaperclipAttachmentDto[]> {
    const openApi = this.getOpenApi();
    const companyId = this.getCompanyId();
    const route = findOpenApiRoute(openApi, 'GET', [
      '/api/issues/{issueId}/attachments',
      '/api/companies/{companyId}/issues/{issueId}/attachments',
    ]);

    let resolved = `/api/issues/${encodeURIComponent(issueId)}/attachments`;
    if (route === '/api/companies/{companyId}/issues/{issueId}/attachments' && companyId) {
      resolved = `/api/companies/${encodeURIComponent(companyId)}/issues/${encodeURIComponent(issueId)}/attachments`;
    }

    const raw = await this.client.requestJson<unknown>(resolved, {
      method: 'GET',
      capabilityKey: 'attachments:read',
      isEntityLookup: true,
    });
    return extractList(raw, ['attachments', 'items']).map(normalizeAttachmentItem);
  }

  async getInteractions(issueId: string): Promise<Array<Record<string, unknown>>> {
    const raw = await this.client.requestJson<unknown>(
      `/api/issues/${encodeURIComponent(issueId)}/interactions`,
      {
        method: 'GET',
        capabilityKey: 'issues:read',
        isEntityLookup: true,
      },
    );
    return extractList(raw, ['interactions', 'items']);
  }
}
