import path from 'node:path';
import type { PaperclipHttpClient } from './client.ts';
import { PaperclipIntegrationError } from './errors.ts';
import { findOpenApiRoute, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import type { PaperclipAttachmentDto } from './types.ts';

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

function sanitizeFilename(rawName: string): string {
  const base = path.basename(rawName || 'anexo.bin').replace(/[\u0000-\u001f\u007f\\/]/g, '_').trim();
  return base && base !== '.' && base !== '..' ? base.slice(0, 180) : 'anexo.bin';
}

export class PaperclipAttachmentsService {
  constructor(
    private readonly client: PaperclipHttpClient,
    private readonly getCompanyId: () => string | null,
    private readonly getOpenApi: () => PaperclipOpenApiSpecSummary | null,
  ) {}

  async uploadToIssue(
    issueId: string,
    file: { filename: string; contentType: string; base64Content: string },
  ): Promise<PaperclipAttachmentDto> {
    const companyId = this.getCompanyId();
    if (!companyId) throw new Error('Empresa Paperclip não selecionada.');

    const cleanBase64 = file.base64Content.trim();
    if (!cleanBase64 || !/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
      throw new PaperclipIntegrationError({
        kind: 'validation_error',
        statusCode: 400,
        message: 'Conteúdo do anexo em base64 inválido.',
      });
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_ATTACHMENT_BYTES) {
      throw new PaperclipIntegrationError({
        kind: 'validation_error',
        statusCode: 400,
        message: 'O anexo deve ter entre 1 byte e 4 MB.',
      });
    }

    const safeName = sanitizeFilename(file.filename);
    const blob = new Blob([buffer], { type: file.contentType || 'application/octet-stream' });
    const form = new FormData();
    form.append('file', blob, safeName);

    const openApi = this.getOpenApi();
    const route = findOpenApiRoute(openApi, 'POST', [
      '/api/companies/{companyId}/issues/{issueId}/attachments',
      '/api/issues/{issueId}/attachments',
    ]);
    const targetPath =
      route === '/api/issues/{issueId}/attachments'
        ? `/api/issues/${encodeURIComponent(issueId)}/attachments`
        : `/api/companies/${encodeURIComponent(companyId)}/issues/${encodeURIComponent(issueId)}/attachments`;

    const raw = await this.client.uploadMultipart<Record<string, unknown>>(
      targetPath,
      form,
      'attachments:write',
    );

    return {
      id: String(raw.id || ''),
      filename: String(raw.filename || safeName),
      contentType: typeof raw.contentType === 'string' ? raw.contentType : file.contentType,
      sizeBytes: typeof raw.sizeBytes === 'number' ? raw.sizeBytes : buffer.byteLength,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    };
  }

  async getContent(attachmentId: string) {
    return this.client.fetchBinary(
      `/api/attachments/${encodeURIComponent(attachmentId)}/content`,
      'attachments:read',
    );
  }
}
