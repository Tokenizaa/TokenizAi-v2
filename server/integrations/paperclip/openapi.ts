import type { PaperclipHttpClient } from './client.ts';

export interface OpenApiOperationInfo {
  path: string;
  method: string;
  summary?: string;
  parameters: string[];
  hasRequestBody: boolean;
}

export interface PaperclipOpenApiSpecSummary {
  available: boolean;
  version: string | null;
  title: string | null;
  operations: OpenApiOperationInfo[];
  rawPaths: Record<string, Record<string, unknown>>;
  error: string | null;
}

function normalizeOpenApiPath(pathStr: string): string {
  // Replace {param} variants consistently and ensure /api prefix
  let normalized = pathStr.trim();
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (!normalized.startsWith('/api/')) normalized = `/api${normalized}`;
  return normalized.replace(/\{[^}]+\}/g, '{param}');
}

export function matchesOpenApiRoute(
  spec: PaperclipOpenApiSpecSummary | null,
  method: string,
  routeTemplate: string,
): boolean {
  if (!spec || !spec.available) return false;
  const targetMethod = method.toUpperCase();
  const normalizedTarget = normalizeOpenApiPath(routeTemplate);

  return spec.operations.some(
    (op) => op.method === targetMethod && normalizeOpenApiPath(op.path) === normalizedTarget,
  );
}

export function findOpenApiRoute(
  spec: PaperclipOpenApiSpecSummary | null,
  method: string,
  candidates: string[],
): string | null {
  if (!spec || !spec.available) return null;
  for (const candidate of candidates) {
    if (matchesOpenApiRoute(spec, method, candidate)) {
      return candidate;
    }
  }
  return null;
}

export async function fetchPaperclipOpenApi(
  client: PaperclipHttpClient,
): Promise<PaperclipOpenApiSpecSummary> {
  try {
    const raw = await client.requestJson<Record<string, unknown>>('/api/openapi.json', {
      method: 'GET',
    });

    const info = (raw.info as Record<string, unknown> | undefined) || {};
    const paths = (raw.paths as Record<string, Record<string, unknown>> | undefined) || {};
    const operations: OpenApiOperationInfo[] = [];

    for (const [pathKey, methodsObj] of Object.entries(paths)) {
      if (!methodsObj || typeof methodsObj !== 'object') continue;
      for (const [methodKey, opVal] of Object.entries(methodsObj)) {
        const upper = methodKey.toUpperCase();
        if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(upper)) continue;
        const opObj = (opVal as Record<string, unknown> | undefined) || {};
        const params = Array.isArray(opObj.parameters)
          ? opObj.parameters
              .map((p) => String((p as Record<string, unknown>)?.name || ''))
              .filter(Boolean)
          : [];
        operations.push({
          path: pathKey,
          method: upper,
          summary: typeof opObj.summary === 'string' ? opObj.summary : undefined,
          parameters: params,
          hasRequestBody: Boolean(opObj.requestBody),
        });
      }
    }

    return {
      available: operations.length > 0 || Object.keys(paths).length > 0,
      version: typeof info.version === 'string' ? info.version : null,
      title: typeof info.title === 'string' ? info.title : null,
      operations,
      rawPaths: paths,
      error: null,
    };
  } catch (err) {
    return {
      available: false,
      version: null,
      title: null,
      operations: [],
      rawPaths: {},
      error: err instanceof Error ? err.message : 'Especificação OpenAPI indisponível.',
    };
  }
}
