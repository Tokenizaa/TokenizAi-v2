import { runCommand, runCommandSafe } from './cliRunner.ts';

const HERMES_CLI = '/home/lg/.local/bin/hermes';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface DomainFetcher<T> {
  key: string;
  ttlMs: number;
  fetch: () => Promise<T>;
  fallback: T;
}

// Cache em memória por domínio
const domainCaches = new Map<string, CacheEntry<any>>();

// TTLs por domínio (ms)
export const DOMAIN_TTL: Record<string, number> = {
  agents: 30_000,      // 30s
  tasks: 15_000,       // 15s
  routines: 60_000,    // 1min
  skills: 300_000,     // 5min
  org: 30_000,         // 30s
  overview: 5_000,     // 5s
};

/**
 * Obtém dados de um domínio com cache inteligente:
 * - Retorna cache se estiver fresco (dentro do TTL)
 * - Stale-while-revalidate: retorna dados obsoletos se houver, atualiza em background
 * - Degradação graciosa: se falhar e não houver cache, retorna fallback
 */
export async function getCachedDomain<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
  fallback: T
): Promise<T> {
  const now = Date.now();
  const entry = domainCaches.get(key);

  // Cache fresco: retorna imediatamente
  if (entry && now - entry.timestamp < entry.ttl) {
    return entry.data;
  }

  // Cache existe mas está expirado: stale-while-revalidate
  if (entry) {
    const stale = entry.data;
    // Atualiza em background sem bloquear a resposta
    fetcher()
      .then((data) => {
        domainCaches.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
      })
      .catch(() => {
        // Falha em background: mantém dados obsoletos
      });
    return stale;
  }

  // Sem cache: busca inicial
  try {
    const data = await fetcher();
    domainCaches.set(key, { data, timestamp: now, ttl: ttlMs });
    return data;
  } catch {
    // Falha na busca inicial sem cache prévio: retorna fallback
    return fallback;
  }
}

/**
 * Invalida o cache de um domínio específico (ou todos se key for omitida)
 */
export function invalidateDomainCache(key?: string): void {
  if (key) {
    domainCaches.delete(key);
  } else {
    domainCaches.clear();
  }
}

/**
 * Retorna estatísticas do cache para diagnóstico
 */
export function getCacheStats(): Array<{ key: string; ageMs: number; ttl: number }> {
  const now = Date.now();
  return Array.from(domainCaches.entries()).map(([key, entry]) => ({
    key,
    ageMs: now - entry.timestamp,
    ttl: entry.ttl,
  }));
}

/**
 * Executa um comando Hermes CLI com parse seguro. Lança erro se o comando falhar,
 * permitindo que getCachedDomain gerencie fallback e stale-while-revalidate.
 */
export async function fetchHermesJson<T>(
  cmd: string,
  parse: (stdout: string) => T,
  timeoutMs: number = 5000
): Promise<T> {
  const { stdout } = await runCommandSafe(cmd, { timeoutMs });
  return parse(stdout);
}

export { HERMES_CLI };
export { runCommand, runCommandSafe };
