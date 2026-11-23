import { getPaperclipAuthHeaders, readPaperclipConfig, type PaperclipConfig } from './auth.ts';
import {
  classifyHttpError,
  classifyTransportError,
  PaperclipIntegrationError,
} from './errors.ts';

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

export type CapabilityObserver = (
  capabilityKey: string | undefined,
  outcome:
    | { ok: true }
    | { ok: false; statusCode: number; message: string; isEntityLookup?: boolean },
) => void;

export class PaperclipHttpClient {
  private cache = new Map<string, CacheEntry>();
  private observer?: CapabilityObserver;

  setObserver(observer: CapabilityObserver) {
    this.observer = observer;
  }

  getConfig(): PaperclipConfig {
    return readPaperclipConfig();
  }

  buildApiUrl(endpoint: string, query?: Record<string, string | number | boolean | undefined | null>): string {
    const cfg = this.getConfig();
    if (!cfg.configured) {
      throw new PaperclipIntegrationError({
        kind: 'not_configured',
        statusCode: 503,
        endpoint,
        message: cfg.configError || 'Integração Paperclip aguardando credenciais no servidor.',
      });
    }

    // Normalize endpoint so it always begins with /api/ without duplicating /api/api/
    let cleanPath = endpoint.trim();
    if (!cleanPath.startsWith('/')) cleanPath = `/${cleanPath}`;
    if (cleanPath === '/api') {
      cleanPath = '/api/';
    } else if (!cleanPath.startsWith('/api/')) {
      cleanPath = `/api${cleanPath}`;
    }

    const url = new URL(`${cfg.baseUrl}${cleanPath}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && String(v) !== '') {
          url.searchParams.set(k, String(v));
        }
      }
    }
    return url.toString();
  }

  invalidateCache(prefix?: string) {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  async requestJson<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined | null>;
      capabilityKey?: string;
      cacheTtlMs?: number;
      skipAuth?: boolean;
      isEntityLookup?: boolean;
    } = {},
  ): Promise<T> {
    const method = options.method || 'GET';
    const cfg = this.getConfig();
    const url = this.buildApiUrl(endpoint, options.query);
    const cacheKey = `${method}:${url}`;

    if (method === 'GET' && options.cacheTtlMs && options.cacheTtlMs > 0) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value as T;
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-TokenizAi-Client': 'tokenizai-enterprise-bff',
      ...(options.skipAuth ? {} : getPaperclipAuthHeaders()),
    };

    let serializedBody: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      serializedBody = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: serializedBody,
        signal: AbortSignal.timeout(cfg.requestTimeoutMs),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const err = classifyHttpError(response.status, text, endpoint, options.capabilityKey);
        this.observer?.(options.capabilityKey, {
          ok: false,
          statusCode: err.statusCode,
          message: err.message,
          isEntityLookup: options.isEntityLookup,
        });
        throw err;
      }

      this.observer?.(options.capabilityKey, { ok: true });

      const text = await response.text();
      const parsed = (text ? JSON.parse(text) : {}) as T;

      if (method === 'GET' && options.cacheTtlMs && options.cacheTtlMs > 0) {
        if (this.cache.size > 200) {
          this.cache.clear();
        }
        this.cache.set(cacheKey, {
          expiresAt: Date.now() + options.cacheTtlMs,
          value: parsed,
        });
      } else if (method !== 'GET') {
        this.invalidateCache();
      }

      return parsed;
    } catch (err) {
      if (err instanceof PaperclipIntegrationError) {
        throw err;
      }
      const transportErr = classifyTransportError(err, endpoint, options.capabilityKey);
      this.observer?.(options.capabilityKey, {
        ok: false,
        statusCode: transportErr.statusCode,
        message: transportErr.message,
        isEntityLookup: options.isEntityLookup,
      });
      throw transportErr;
    }
  }

  async uploadMultipart<T>(
    endpoint: string,
    formData: FormData,
    capabilityKey?: string,
  ): Promise<T> {
    const cfg = this.getConfig();
    const url = this.buildApiUrl(endpoint);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-TokenizAi-Client': 'tokenizai-enterprise-bff',
          ...getPaperclipAuthHeaders(),
        },
        body: formData,
        signal: AbortSignal.timeout(cfg.requestTimeoutMs),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const err = classifyHttpError(response.status, text, endpoint, capabilityKey);
        this.observer?.(capabilityKey, {
          ok: false,
          statusCode: err.statusCode,
          message: err.message,
          isEntityLookup: true,
        });
        throw err;
      }

      this.observer?.(capabilityKey, { ok: true });
      this.invalidateCache();
      return (await response.json().catch(() => ({}))) as T;
    } catch (err) {
      if (err instanceof PaperclipIntegrationError) throw err;
      throw classifyTransportError(err, endpoint, capabilityKey);
    }
  }

  async fetchBinary(
    endpoint: string,
    capabilityKey?: string,
  ): Promise<{ buffer: Buffer; contentType: string; contentDisposition: string | null }> {
    const cfg = this.getConfig();
    const url = this.buildApiUrl(endpoint);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-TokenizAi-Client': 'tokenizai-enterprise-bff',
          ...getPaperclipAuthHeaders(),
        },
        signal: AbortSignal.timeout(cfg.requestTimeoutMs),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const err = classifyHttpError(response.status, text, endpoint, capabilityKey);
        this.observer?.(capabilityKey, {
          ok: false,
          statusCode: err.statusCode,
          message: err.message,
          isEntityLookup: true,
        });
        throw err;
      }

      this.observer?.(capabilityKey, { ok: true });
      const arrayBuf = await response.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuf),
        contentType: response.headers.get('content-type') || 'application/octet-stream',
        contentDisposition: response.headers.get('content-disposition'),
      };
    } catch (err) {
      if (err instanceof PaperclipIntegrationError) throw err;
      throw classifyTransportError(err, endpoint, capabilityKey);
    }
  }
}
