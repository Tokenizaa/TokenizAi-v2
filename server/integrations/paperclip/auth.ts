import { sanitizeDiagnosticMessage } from './errors.ts';

export interface PaperclipConfig {
  baseUrl: string;
  apiKeyPresent: boolean;
  companyId: string | null;
  requestTimeoutMs: number;
  syncIntervalMs: number;
  configured: boolean;
  partiallyConfigured: boolean;
  host: string | null;
  configError: string | null;
}

function clampMs(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function normalizePaperclipBaseUrl(rawUrl: string): { baseUrl: string; host: string | null; error: string | null } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { baseUrl: '', host: null, error: null };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        baseUrl: '',
        host: null,
        error: 'PAPERCLIP_API_URL deve utilizar protocolo HTTP ou HTTPS.',
      };
    }

    // Remove trailing slashes and any repeated trailing /api segments to prevent /api/api duplication
    let pathname = parsed.pathname.replace(/\/+$/, '');
    while (pathname.toLowerCase() === '/api' || pathname.toLowerCase().endsWith('/api')) {
      pathname = pathname.slice(0, -4);
    }

    const normalized = `${parsed.origin}${pathname}`;
    return { baseUrl: normalized, host: parsed.host, error: null };
  } catch (err) {
    return {
      baseUrl: '',
      host: null,
      error: `PAPERCLIP_API_URL inválida: ${sanitizeDiagnosticMessage(err instanceof Error ? err.message : String(err))}`,
    };
  }
}

export function readPaperclipConfig(): PaperclipConfig {
  const rawUrl = process.env.PAPERCLIP_API_URL || '';
  const rawKey = (process.env.PAPERCLIP_API_KEY || '').trim();
  const rawCompanyId = (process.env.PAPERCLIP_COMPANY_ID || '').trim();

  const requestTimeoutMs = clampMs(process.env.PAPERCLIP_REQUEST_TIMEOUT_MS, 30000, 1000, 120000);
  const syncIntervalMs = clampMs(process.env.PAPERCLIP_SYNC_INTERVAL_MS, 15000, 5000, 300000);

  const urlInfo = normalizePaperclipBaseUrl(rawUrl);
  const apiKeyPresent = rawKey.length > 0;
  const hasUrl = Boolean(urlInfo.baseUrl);
  const configured = hasUrl && apiKeyPresent && !urlInfo.error;
  const partiallyConfigured = (Boolean(rawUrl.trim()) || apiKeyPresent) && !configured;

  return {
    baseUrl: urlInfo.baseUrl,
    apiKeyPresent,
    companyId: rawCompanyId || null,
    requestTimeoutMs,
    syncIntervalMs,
    configured,
    partiallyConfigured,
    host: urlInfo.host,
    configError: urlInfo.error,
  };
}

/**
 * Strictly server-side header builder. Never expose the return value to clients or logs.
 */
export function getPaperclipAuthHeaders(): Record<string, string> {
  const key = (process.env.PAPERCLIP_API_KEY || '').trim();
  if (!key) return {};
  return {
    Authorization: `Bearer ${key}`,
  };
}
