import type { PaperclipHttpClient } from './client.ts';

export interface PaperclipHealthReport {
  reachable: boolean;
  authenticated: boolean;
  serverVersion: string | null;
  rawStatus: string | null;
  companyId: string | null;
  companyName: string | null;
  error: string | null;
  errorKind: string | null;
}

export async function probePaperclipHealth(
  client: PaperclipHttpClient,
  configuredCompanyId: string | null,
): Promise<PaperclipHealthReport> {
  try {
    const health = await client.requestJson<Record<string, unknown>>('/api/health', {
      method: 'GET',
    });

    const serverVersion =
      typeof health.version === 'string'
        ? health.version
        : typeof health.serverVersion === 'string'
          ? health.serverVersion
          : null;

    const rawStatus = typeof health.status === 'string' ? health.status : 'ok';

    // Validate authentication & company discovery via /api/companies or configured company
    let authenticated = false;
    let companyId = configuredCompanyId;
    let companyName: string | null = null;
    let authError: string | null = null;
    let authErrorKind: string | null = null;

    try {
      const companiesResp = await client.requestJson<unknown>('/api/companies', { method: 'GET' });
      authenticated = true;
      const list = Array.isArray(companiesResp)
        ? (companiesResp as Array<Record<string, unknown>>)
        : Array.isArray((companiesResp as Record<string, unknown>)?.items)
          ? ((companiesResp as Record<string, unknown>).items as Array<Record<string, unknown>>)
          : Array.isArray((companiesResp as Record<string, unknown>)?.companies)
            ? ((companiesResp as Record<string, unknown>).companies as Array<Record<string, unknown>>)
            : [];

      if (companyId) {
        const match = list.find((c) => String(c.id || c.slug || '') === companyId);
        if (match) {
          companyId = String(match.id || companyId);
          companyName = String(match.name || match.title || companyId);
        } else if (list.length > 0) {
          // Verify explicit access to the configured companyId when not returned in /api/companies
          try {
            await client.requestJson(`/api/companies/${encodeURIComponent(companyId)}/agents`, {
              method: 'GET',
              capabilityKey: 'agents:read',
            });
            companyName = companyId;
          } catch (innerErr) {
            const innerStatus = (innerErr as { statusCode?: number }).statusCode;
            if (innerStatus === 401) {
              authenticated = false;
              authError = innerErr instanceof Error ? innerErr.message : 'Credencial inválida.';
              authErrorKind = 'invalid_credentials';
            } else {
              companyId = null;
              authError =
                'A credencial configurada não possui acesso à empresa informada em PAPERCLIP_COMPANY_ID.';
              authErrorKind = innerStatus === 403 ? 'forbidden' : 'forbidden';
            }
          }
        }
      } else if (list.length === 1) {
        companyId = String(list[0].id || '');
        companyName = String(list[0].name || list[0].title || companyId);
      }
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      const kind = (err as { kind?: string }).kind;
      if (statusCode === 401 || kind === 'invalid_credentials') {
        authenticated = false;
        authError = err instanceof Error ? err.message : 'Credencial Paperclip inválida.';
        authErrorKind = 'invalid_credentials';
      } else if (companyId) {
        // Fallback probe directly on company agents if /api/companies is restricted (403/404)
        try {
          await client.requestJson(`/api/companies/${encodeURIComponent(companyId)}/agents`, {
            method: 'GET',
            capabilityKey: 'agents:read',
          });
          authenticated = true;
        } catch (innerErr) {
          const innerStatus = (innerErr as { statusCode?: number }).statusCode;
          if (innerStatus === 401) {
            authenticated = false;
            authError = innerErr instanceof Error ? innerErr.message : 'Credencial inválida.';
            authErrorKind = 'invalid_credentials';
          } else if (innerStatus === 403) {
            authenticated = true;
            authError = innerErr instanceof Error ? innerErr.message : 'Sem permissão para listar empresas/agentes.';
            authErrorKind = 'forbidden';
          } else {
            authenticated = true;
          }
        }
      } else {
        authenticated = statusCode !== 401;
        authError = err instanceof Error ? err.message : 'Não foi possível listar empresas no Paperclip.';
        authErrorKind = kind || 'communication_error';
      }
    }

    return {
      reachable: true,
      authenticated,
      serverVersion,
      rawStatus,
      companyId,
      companyName,
      error: authError,
      errorKind: authErrorKind,
    };
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    const kind = (err as { kind?: string }).kind || 'instance_unavailable';
    return {
      reachable: statusCode === 401 || statusCode === 403,
      authenticated: false,
      serverVersion: null,
      rawStatus: null,
      companyId: configuredCompanyId,
      companyName: null,
      error: err instanceof Error ? err.message : 'Instância Paperclip inacessível.',
      errorKind: kind,
    };
  }
}
