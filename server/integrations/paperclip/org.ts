import { normalizeAgent } from './agents.ts';
import type { PaperclipHttpClient } from './client.ts';
import { matchesOpenApiRoute, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import type { PaperclipAgentDto, PaperclipOrgNodeDto } from './types.ts';

function extractOrgNodes(raw: unknown): PaperclipOrgNodeDto[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => normalizeRawOrgNode(item as Record<string, unknown>));
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.tree)) {
      return obj.tree.map((item) => normalizeRawOrgNode(item as Record<string, unknown>));
    }
    if (Array.isArray(obj.nodes)) {
      return obj.nodes.map((item) => normalizeRawOrgNode(item as Record<string, unknown>));
    }
    if (Array.isArray(obj.agents)) {
      return buildTreeFromAgents(obj.agents.map((a) => normalizeAgent(a as Record<string, unknown>)));
    }
  }
  return [];
}

function normalizeRawOrgNode(raw: Record<string, unknown>): PaperclipOrgNodeDto {
  const childrenRaw = Array.isArray(raw.children)
    ? raw.children
    : Array.isArray(raw.reports)
      ? raw.reports
      : [];
  return {
    id: String(raw.id || raw.agentId || ''),
    name: String(raw.name || raw.title || 'Membro'),
    title: typeof raw.title === 'string' ? raw.title : undefined,
    role: typeof raw.role === 'string' ? raw.role : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
    reportsTo: raw.reportsTo ? String(raw.reportsTo) : null,
    avatarUrl: typeof raw.avatarUrl === 'string' ? raw.avatarUrl : null,
    team: typeof raw.team === 'string' ? raw.team : null,
    capabilities: Array.isArray(raw.capabilities) ? raw.capabilities.map(String) : undefined,
    children: childrenRaw.map((c) => normalizeRawOrgNode(c as Record<string, unknown>)),
  };
}

export function buildTreeFromAgents(agents: PaperclipAgentDto[]): PaperclipOrgNodeDto[] {
  const map = new Map<string, PaperclipOrgNodeDto>();
  for (const ag of agents) {
    map.set(ag.id, {
      id: ag.id,
      name: ag.name,
      title: ag.title,
      role: ag.role,
      status: ag.status,
      reportsTo: ag.reportsTo || null,
      avatarUrl: ag.avatarUrl || null,
      capabilities: ag.capabilities,
      children: [],
    });
  }

  const roots: PaperclipOrgNodeDto[] = [];
  for (const node of map.values()) {
    if (node.reportsTo && map.has(node.reportsTo) && node.reportsTo !== node.id) {
      map.get(node.reportsTo)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export class PaperclipOrgService {
  constructor(
    private readonly client: PaperclipHttpClient,
    private readonly getCompanyId: () => string | null,
    private readonly getOpenApi: () => PaperclipOpenApiSpecSummary | null,
  ) {}

  async getOrganization(agentsFallback?: PaperclipAgentDto[]): Promise<{
    tree: PaperclipOrgNodeDto[];
    agents: PaperclipAgentDto[];
  }> {
    const companyId = this.getCompanyId();
    if (!companyId) {
      return { tree: [], agents: [] };
    }

    const openApi = this.getOpenApi();
    const orgSupported = !openApi?.available || matchesOpenApiRoute(openApi, 'GET', '/api/companies/{companyId}/org');

    const [orgResult, agentsResult] = await Promise.allSettled([
      orgSupported
        ? this.client.requestJson<unknown>(`/api/companies/${encodeURIComponent(companyId)}/org`, {
            method: 'GET',
            capabilityKey: 'org:read',
            cacheTtlMs: 10000,
          })
        : Promise.resolve(null),
      agentsFallback
        ? Promise.resolve(agentsFallback)
        : this.client
            .requestJson<unknown>(`/api/companies/${encodeURIComponent(companyId)}/agents`, {
              method: 'GET',
              capabilityKey: 'agents:read',
              cacheTtlMs: 5000,
            })
            .then((raw) => {
              const list = Array.isArray(raw)
                ? raw
                : Array.isArray((raw as Record<string, unknown>)?.agents)
                  ? ((raw as Record<string, unknown>).agents as unknown[])
                  : Array.isArray((raw as Record<string, unknown>)?.items)
                    ? ((raw as Record<string, unknown>).items as unknown[])
                    : [];
              return list.map((a) => normalizeAgent(a as Record<string, unknown>));
            }),
    ]);

    const agents = agentsResult.status === 'fulfilled' ? agentsResult.value : [];

    if (orgResult.status === 'fulfilled' && orgResult.value) {
      const parsedTree = extractOrgNodes(orgResult.value);
      if (parsedTree.length > 0) {
        return { tree: parsedTree, agents };
      }
    }

    // Build real hierarchy strictly from Paperclip's reportsTo fields (never hardcoded)
    return {
      tree: buildTreeFromAgents(agents),
      agents,
    };
  }
}
