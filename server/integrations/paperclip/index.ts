import { PaperclipActivityService } from './activity.ts';
import { PaperclipAgentsService } from './agents.ts';
import { PaperclipApprovalsService } from './approvals.ts';
import { PaperclipAttachmentsService } from './attachments.ts';
import { readPaperclipConfig } from './auth.ts';
import {
  buildCapabilityMatrix,
  CONNECTION_STATUS_LABELS,
  resolveConnectionStatus,
  type RuntimeCapabilityObservation,
} from './capabilities.ts';
import { PaperclipChatsService } from './chats.ts';
import { PaperclipHttpClient } from './client.ts';
import { PaperclipCostsService } from './costs.ts';
import { PaperclipIntegrationError } from './errors.ts';
import { probePaperclipHealth, type PaperclipHealthReport } from './health.ts';
import { PaperclipIssuesService } from './issues.ts';
import { fetchPaperclipOpenApi, type PaperclipOpenApiSpecSummary } from './openapi.ts';
import { PaperclipOrgService } from './org.ts';
import { PaperclipProjectsService } from './projects.ts';
import { PaperclipRoutinesService } from './routines.ts';
import { PaperclipRunsService } from './runs.ts';
import type {
  PaperclipIntegrationStatus,
  PaperclipOverviewBundle,
} from './types.ts';

export class PaperclipGateway {
  readonly client = new PaperclipHttpClient();

  private connecting = false;
  private health: PaperclipHealthReport | null = null;
  private openApi: PaperclipOpenApiSpecSummary | null = null;
  private resolvedCompanyId: string | null = null;
  private resolvedCompanyName: string | null = null;
  private lastSuccessfulSync: string | null = null;
  private lastError: string | null = null;
  private observations = new Map<string, RuntimeCapabilityObservation>();
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  readonly agents = new PaperclipAgentsService(
    this.client,
    () => this.getActiveCompanyId(),
    () => this.openApi,
  );
  readonly org = new PaperclipOrgService(
    this.client,
    () => this.getActiveCompanyId(),
    () => this.openApi,
  );
  readonly chats = new PaperclipChatsService(
    this.client,
    () => this.getActiveCompanyId(),
    () => this.openApi,
  );
  readonly issues = new PaperclipIssuesService(
    this.client,
    () => this.getActiveCompanyId(),
    () => this.openApi,
  );
  readonly runs = new PaperclipRunsService(
    this.client,
    () => this.getActiveCompanyId(),
    () => this.openApi,
  );
  readonly projects = new PaperclipProjectsService(
    this.client,
    () => this.getActiveCompanyId(),
    () => this.openApi,
  );
  readonly routines = new PaperclipRoutinesService(
    this.client,
    () => this.getActiveCompanyId(),
    () => this.openApi,
  );
  readonly approvals = new PaperclipApprovalsService(
    this.client,
    () => this.getActiveCompanyId(),
    () => this.openApi,
  );
  readonly costs = new PaperclipCostsService(
    this.client,
    () => this.getActiveCompanyId(),
    () => this.openApi,
  );
  readonly activity = new PaperclipActivityService(
    this.client,
    () => this.getActiveCompanyId(),
    () => this.openApi,
  );
  readonly attachments = new PaperclipAttachmentsService(
    this.client,
    () => this.getActiveCompanyId(),
    () => this.openApi,
  );

  constructor() {
    this.client.setObserver((capKey, outcome) => {
      if (!capKey) return;
      if (outcome.ok) {
        this.observations.set(capKey, { ok: true, statusCode: 200 });
      } else {
        this.observations.set(capKey, {
          ok: false,
          statusCode: outcome.statusCode,
          message: outcome.message,
          isEntityLookup: outcome.isEntityLookup,
        });
      }
    });
  }

  getActiveCompanyId(): string | null {
    const cfg = readPaperclipConfig();
    return this.resolvedCompanyId || cfg.companyId;
  }

  ensureCapabilityAvailable(capabilityKey: string): void {
    const status = this.getStatus();
    if (!status.configured) {
      throw new PaperclipIntegrationError({
        kind: 'not_configured',
        statusCode: 503,
        capabilityKey,
        message: 'Integração Paperclip aguardando credenciais no servidor.',
      });
    }
    if (!status.reachable) {
      throw new PaperclipIntegrationError({
        kind: 'instance_unavailable',
        statusCode: 503,
        capabilityKey,
        message: status.lastError || 'Instância Paperclip indisponível no momento.',
      });
    }
    if (!status.authenticated) {
      throw new PaperclipIntegrationError({
        kind: 'invalid_credentials',
        statusCode: 401,
        capabilityKey,
        message: status.lastError || 'Credencial Paperclip inválida.',
      });
    }
    if (!status.companyId) {
      throw new PaperclipIntegrationError({
        kind: 'validation_error',
        statusCode: 400,
        capabilityKey,
        message: 'Autenticado no Paperclip, mas nenhuma empresa (PAPERCLIP_COMPANY_ID) foi selecionada.',
      });
    }
    const cap = status.availableCapabilities.find((c) => c.key === capabilityKey);
    if (cap && cap.availableInVersion === false) {
      throw new PaperclipIntegrationError({
        kind: 'resource_unavailable',
        statusCode: 404,
        capabilityKey,
        message: cap.errorMessage || `O recurso "${cap.label}" não está disponível na versão instalada do Paperclip.`,
      });
    }
  }

  private scheduleNextSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    const cfg = readPaperclipConfig();
    this.syncTimer = setTimeout(() => {
      const currentCfg = readPaperclipConfig();
      if (currentCfg.configured && !this.connecting) {
        this.refresh()
          .catch(() => {
            // Recorded cleanly inside gateway state without crashing server loop
          })
          .finally(() => {
            this.scheduleNextSync();
          });
      } else {
        if (!currentCfg.configured && (this.health || this.openApi)) {
          this.health = null;
          this.openApi = null;
          this.resolvedCompanyId = null;
          this.resolvedCompanyName = null;
          this.observations.clear();
          this.lastError = currentCfg.configError;
        }
        this.scheduleNextSync();
      }
    }, cfg.syncIntervalMs);
    this.syncTimer.unref?.();
  }

  async initialize(): Promise<void> {
    const cfg = readPaperclipConfig();
    if (cfg.configured) {
      await this.refresh();
    } else {
      this.lastError = cfg.configError;
    }

    this.scheduleNextSync();
  }

  async refresh(): Promise<PaperclipIntegrationStatus> {
    const cfg = readPaperclipConfig();
    this.client.invalidateCache();
    this.observations.clear();

    if (!cfg.configured) {
      this.health = null;
      this.openApi = null;
      this.resolvedCompanyId = cfg.companyId;
      this.resolvedCompanyName = null;
      this.lastError = cfg.configError;
      return this.getStatus();
    }

    this.connecting = true;
    try {
      const health = await probePaperclipHealth(this.client, cfg.companyId);
      this.health = health;
      this.resolvedCompanyId = health.companyId;
      this.resolvedCompanyName = health.companyName;

      if (health.reachable && health.authenticated) {
        this.openApi = await fetchPaperclipOpenApi(this.client);
        this.lastSuccessfulSync = new Date().toISOString();
        this.lastError = health.error || this.openApi.error;
      } else {
        this.openApi = null;
        this.lastError = health.error;
      }
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Falha ao atualizar conexão Paperclip.';
    } finally {
      this.connecting = false;
    }

    return this.getStatus();
  }

  getStatus(): PaperclipIntegrationStatus {
    const cfg = readPaperclipConfig();
    const reachable = Boolean(cfg.configured && this.health?.reachable);
    const authenticated = Boolean(cfg.configured && this.health?.authenticated);
    const companyId = cfg.configured ? (this.resolvedCompanyId ?? (this.health ? null : cfg.companyId)) : null;

    const capabilities = buildCapabilityMatrix({
      configured: cfg.configured,
      reachable,
      authenticated,
      openApi: this.openApi,
      observations: this.observations,
    });

    const connectionStatus = resolveConnectionStatus({
      configured: cfg.configured,
      partiallyConfigured: cfg.partiallyConfigured,
      connecting: this.connecting,
      reachable,
      authenticated,
      companyId,
      errorKind: this.health?.errorKind || null,
      capabilities,
    });

    return {
      configured: cfg.configured,
      reachable,
      authenticated,
      companyId,
      companyName: this.resolvedCompanyName,
      serverVersion: this.openApi?.version || this.health?.serverVersion || null,
      openApiAvailable: Boolean(this.openApi?.available),
      lastSuccessfulSync: this.lastSuccessfulSync,
      lastError: this.lastError || cfg.configError,
      connectionStatus,
      connectionLabel: CONNECTION_STATUS_LABELS[connectionStatus],
      requestTimeoutMs: cfg.requestTimeoutMs,
      syncIntervalMs: cfg.syncIntervalMs,
      host: cfg.host,
      availableCapabilities: capabilities,
    };
  }

  async getOverviewBundle(): Promise<PaperclipOverviewBundle> {
    const cfg = readPaperclipConfig();
    if (cfg.configured && (!this.health || !this.health.reachable || !this.openApi) && !this.connecting) {
      await this.refresh();
    }

    const status = this.getStatus();
    const empty: PaperclipOverviewBundle = {
      status,
      agents: [],
      issues: [],
      runs: [],
      projects: [],
      goals: [],
      approvals: [],
      routines: [],
      costs: null,
      activity: [],
    };

    if (!status.configured || !status.reachable || !status.authenticated || !status.companyId) {
      return empty;
    }

    const can = (key: string) => {
      const cap = status.availableCapabilities.find((c) => c.key === key);
      return !cap || cap.availableInVersion !== false;
    };

    const [
      agentsRes,
      issuesRes,
      runsRes,
      projectsRes,
      goalsRes,
      approvalsRes,
      routinesRes,
      costsRes,
      activityRes,
    ] = await Promise.allSettled([
      can('agents:read') ? this.agents.listAgents() : Promise.resolve([]),
      can('issues:read') ? this.issues.listIssues({ limit: 100 }) : Promise.resolve([]),
      can('runs:read') ? this.runs.listRuns({ limit: 40 }) : Promise.resolve([]),
      can('projects:read') ? this.projects.listProjects() : Promise.resolve([]),
      can('projects:read') ? this.projects.listGoals() : Promise.resolve([]),
      can('approvals:read') ? this.approvals.listApprovals() : Promise.resolve([]),
      can('routines:read') ? this.routines.listRoutines() : Promise.resolve([]),
      can('costs:read') ? this.costs.getSummary() : Promise.resolve(null),
      can('activity:read') ? this.activity.listActivity(30) : Promise.resolve([]),
    ]);

    const anySucceeded = [
      agentsRes,
      issuesRes,
      runsRes,
      projectsRes,
      goalsRes,
      approvalsRes,
      routinesRes,
      costsRes,
      activityRes,
    ].some((r) => r.status === 'fulfilled');
    if (anySucceeded) {
      this.lastSuccessfulSync = new Date().toISOString();
    }

    return {
      status: this.getStatus(),
      agents: agentsRes.status === 'fulfilled' ? agentsRes.value : [],
      issues: issuesRes.status === 'fulfilled' ? issuesRes.value : [],
      runs: runsRes.status === 'fulfilled' ? runsRes.value : [],
      projects: projectsRes.status === 'fulfilled' ? projectsRes.value : [],
      goals: goalsRes.status === 'fulfilled' ? goalsRes.value : [],
      approvals: approvalsRes.status === 'fulfilled' ? approvalsRes.value : [],
      routines: routinesRes.status === 'fulfilled' ? routinesRes.value : [],
      costs: costsRes.status === 'fulfilled' ? costsRes.value : null,
      activity: activityRes.status === 'fulfilled' ? activityRes.value : [],
    };
  }
}

export const paperclipGateway = new PaperclipGateway();
export { PaperclipIntegrationError } from './errors.ts';
