import type { PaperclipHttpClient } from './client.ts';
import { assertCompanyScope, PaperclipIntegrationError } from './errors.ts';
import type { PaperclipOpenApiSpecSummary } from './openapi.ts';
import type { PaperclipApprovalDto } from './types.ts';

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

function normalizeApproval(raw: Record<string, unknown>): PaperclipApprovalDto {
  return {
    id: String(raw.id || ''),
    type: typeof raw.type === 'string' ? raw.type : undefined,
    title: String(raw.title || raw.type || 'Solicitação de aprovação'),
    description: typeof raw.description === 'string'
      ? raw.description
      : typeof raw.reason === 'string'
        ? raw.reason
        : undefined,
    status: String(raw.status || 'pending'),
    requestedByAgentId: raw.requestedByAgentId ? String(raw.requestedByAgentId) : null,
    requestedByName: typeof raw.requestedByName === 'string' ? raw.requestedByName : null,
    approverUserId: raw.approverUserId ? String(raw.approverUserId) : null,
    issueId: raw.issueId ? String(raw.issueId) : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    decidedAt: typeof raw.decidedAt === 'string' ? raw.decidedAt : null,
    decisionNote: typeof raw.decisionNote === 'string' ? raw.decisionNote : null,
    payload: (raw.payload as Record<string, unknown> | undefined) || undefined,
  };
}

export class PaperclipApprovalsService {
  constructor(
    private readonly client: PaperclipHttpClient,
    private readonly getCompanyId: () => string | null,
    private readonly _getOpenApi: () => PaperclipOpenApiSpecSummary | null,
  ) {}

  async listApprovals(): Promise<PaperclipApprovalDto[]> {
    const companyId = this.getCompanyId();
    if (!companyId) return [];
    const raw = await this.client.requestJson<unknown>(
      `/api/companies/${encodeURIComponent(companyId)}/approvals`,
      {
        method: 'GET',
        capabilityKey: 'approvals:read',
        cacheTtlMs: 3000,
      },
    );
    return extractList(raw, ['approvals', 'items']).map(normalizeApproval);
  }

  async getApproval(approvalId: string): Promise<PaperclipApprovalDto> {
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/approvals/${encodeURIComponent(approvalId)}`,
      {
        method: 'GET',
        capabilityKey: 'approvals:read',
        isEntityLookup: true,
      },
    );
    assertCompanyScope(raw, this.getCompanyId(), 'aprovação');
    return normalizeApproval(raw);
  }

  private async verifyApprovalScope(approvalId: string, actingPaperclipUserId?: string | null) {
    const existing = await this.getApproval(approvalId);
    if (
      existing.approverUserId &&
      actingPaperclipUserId &&
      existing.approverUserId !== actingPaperclipUserId
    ) {
      throw new PaperclipIntegrationError({
        kind: 'forbidden',
        statusCode: 403,
        capabilityKey: 'approvals:manage',
        message: 'Esta solicitação está direcionada a outro aprovador específico no Paperclip.',
      });
    }
    return existing;
  }

  async createApproval(payload: Record<string, unknown>): Promise<PaperclipApprovalDto> {
    const companyId = this.getCompanyId();
    if (!companyId) throw new Error('Empresa Paperclip não selecionada.');
    const raw = await this.client.requestJson<Record<string, unknown>>(
      `/api/companies/${encodeURIComponent(companyId)}/approvals`,
      {
        method: 'POST',
        body: payload,
        capabilityKey: 'approvals:manage',
      },
    );
    return normalizeApproval(raw);
  }

  async approve(approvalId: string, note?: string, actingPaperclipUserId?: string | null): Promise<unknown> {
    await this.verifyApprovalScope(approvalId, actingPaperclipUserId);
    return this.client.requestJson(`/api/approvals/${encodeURIComponent(approvalId)}/approve`, {
      method: 'POST',
      body: note ? { decisionNote: note, note } : {},
      capabilityKey: 'approvals:manage',
      isEntityLookup: true,
    });
  }

  async reject(approvalId: string, note?: string, actingPaperclipUserId?: string | null): Promise<unknown> {
    await this.verifyApprovalScope(approvalId, actingPaperclipUserId);
    return this.client.requestJson(`/api/approvals/${encodeURIComponent(approvalId)}/reject`, {
      method: 'POST',
      body: note ? { decisionNote: note, note } : {},
      capabilityKey: 'approvals:manage',
      isEntityLookup: true,
    });
  }

  async requestRevision(approvalId: string, note: string, actingPaperclipUserId?: string | null): Promise<unknown> {
    await this.verifyApprovalScope(approvalId, actingPaperclipUserId);
    return this.client.requestJson(`/api/approvals/${encodeURIComponent(approvalId)}/request-revision`, {
      method: 'POST',
      body: { decisionNote: note, note },
      capabilityKey: 'approvals:manage',
      isEntityLookup: true,
    });
  }
}
