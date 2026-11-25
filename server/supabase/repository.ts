import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AgenteEmpresarial,
  ClientRecord,
  Departamento,
  DealRecord,
  Equipe,
  EnterpriseDataState,
  FinanceEntry,
  ProductRecord,
  ProjectRecord,
  SubscriptionRecord,
} from '../../src/types/platform.ts';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseConfigured =
  Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY) && Boolean(SUPABASE_SERVICE_ROLE_KEY);

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    if (!supabaseConfigured) {
      throw new Error(
        'Supabase nao esta configurado. Defina SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.',
      );
    }
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdmin;
}

/**
 * SupabaseRepository - adaptador de persistencia empresarial.
 *
 * Usa Supabase como fonte de verdade quando configurado. Quando nao esta
 * configurado (ambiente de desenvolvimento sem credenciais), opera com
 * degradacao graciosa sobre o estado em memoria passado no construtor,
 * sem fingir que a persistencia ocorreu.
 */
export class SupabaseRepository {
  private mem: EnterpriseDataState;
  private useSupabase: boolean;

  constructor(initialState: EnterpriseDataState) {
    this.mem = structuredClone(initialState);
    this.useSupabase = supabaseConfigured;
  }

  isSupabaseAvailable(): boolean {
    return this.useSupabase;
  }

  // ------------------------------------------------------------------
  // Projetos
  // ------------------------------------------------------------------
  async listProjects(): Promise<ProjectRecord[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('projetos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => this.rowToProject(row));
    }
    return this.mem.projects;
  }

  async createProject(project: ProjectRecord): Promise<ProjectRecord> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('projetos')
        .insert(this.projectToRow(project))
        .select()
        .single();
      if (error) throw error;
      return this.rowToProject(data);
    }
    this.mem.projects.unshift(project);
    return project;
  }

  async updateProject(id: string, patch: Partial<ProjectRecord>): Promise<ProjectRecord | null> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('projetos')
        .update(this.projectToRow(patch as ProjectRecord))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return this.rowToProject(data);
    }
    const idx = this.mem.projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.mem.projects[idx] = { ...this.mem.projects[idx], ...patch };
    return this.mem.projects[idx];
  }

  // ------------------------------------------------------------------
  // Entregas de projeto
  // ------------------------------------------------------------------
  async listDeliverables(projectId: string): Promise<any[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('entregas_de_projeto')
        .select('*')
        .eq('projeto_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
    const project = this.mem.projects.find((p) => p.id === projectId);
    return project?.deliverables ?? [];
  }

  async createDeliverable(deliverable: any): Promise<any> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('entregas_de_projeto')
        .insert(deliverable)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    const project = this.mem.projects.find((p) => p.id === deliverable.projeto_id);
    if (project) {
      project.deliverables = project.deliverables || [];
      project.deliverables.push(deliverable);
    }
    return deliverable;
  }

  async updateDeliverable(id: string, patch: any): Promise<any | null> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('entregas_de_projeto')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    for (const project of this.mem.projects) {
      const idx = project.deliverables?.findIndex((d) => d.id === id);
      if (idx !== -1) {
        project.deliverables[idx] = { ...project.deliverables[idx], ...patch };
        return project.deliverables[idx];
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Atividades de projeto
  // ------------------------------------------------------------------
  async listProjectActivities(projectId: string): Promise<any[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('atividades_de_projeto')
        .select('*')
        .eq('projeto_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
    const project = this.mem.projects.find((p) => p.id === projectId);
    return project?.activities ?? [];
  }

  async createProjectActivity(activity: any): Promise<any> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('atividades_de_projeto')
        .insert(activity)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    const project = this.mem.projects.find((p) => p.id === activity.projeto_id);
    if (project) {
      project.activities = project.activities || [];
      project.activities.push(activity);
    }
    return activity;
  }

  async updateProjectActivity(id: string, patch: any): Promise<any | null> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('atividades_de_projeto')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    for (const project of this.mem.projects) {
      const idx = project.activities?.findIndex((a) => a.id === id);
      if (idx !== -1) {
        project.activities[idx] = { ...project.activities[idx], ...patch };
        return project.activities[idx];
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Departamentos
  // ------------------------------------------------------------------
  async listDepartamentos(): Promise<Departamento[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('departamentos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        nome: row.nome,
        codigo: row.codigo,
        descricao: row.descricao,
        departamentoPaiId: row.departamento_pai_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }
    return this.mem.departamentos;
  }

  // ------------------------------------------------------------------
  // Agentes Empresariais
  // ------------------------------------------------------------------
  async listAgentesEmpresariais(): Promise<AgenteEmpresarial[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('agentes_empresariais').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        nome: row.nome,
        slug: row.slug,
        divisao: row.divisao,
        papel: row.papel,
        departamentoId: row.departamento_id,
        hermesAgentId: row.hermes_agent_id,
        hermesProfileId: row.hermes_profile_id,
        status: row.status,
        capabilities: row.capabilities,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }
    return this.mem.agentesEmpresariais;
  }

  // ------------------------------------------------------------------
  // Equipes
  // ------------------------------------------------------------------
  async listEquipes(): Promise<Equipe[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('equipes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        nome: row.nome,
        descricao: row.descricao,
        departamentoId: row.departamento_id,
        liderId: row.lider_id,
        integrantes: row.integrantes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }
    return this.mem.equipes;
  }

  // ------------------------------------------------------------------
  // Clientes
  // ------------------------------------------------------------------
  async listClients(): Promise<ClientRecord[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('clientes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => this.rowToClient(row));
    }
    return this.mem.clients;
  }

  async createClient(client: ClientRecord): Promise<ClientRecord> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('clientes')
        .insert(this.clientToRow(client))
        .select()
        .single();
      if (error) throw error;
      return this.rowToClient(data);
    }
    this.mem.clients.unshift(client);
    return client;
  }

  async updateClient(id: string, patch: Partial<ClientRecord>): Promise<ClientRecord | null> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('clientes')
        .update(this.clientToRow(patch as ClientRecord))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return this.rowToClient(data);
    }
    const idx = this.mem.clients.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.mem.clients[idx] = { ...this.mem.clients[idx], ...patch };
    return this.mem.clients[idx];
  }

  // ------------------------------------------------------------------
  // Negocios
  // ------------------------------------------------------------------
  async listDeals(): Promise<DealRecord[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('negocios').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => this.rowToDeal(row));
    }
    return this.mem.deals;
  }

  async createDeal(deal: DealRecord): Promise<DealRecord> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('negocios')
        .insert(this.dealToRow(deal))
        .select()
        .single();
      if (error) throw error;
      return this.rowToDeal(data);
    }
    this.mem.deals.unshift(deal);
    return deal;
  }

  async updateDeal(id: string, patch: Partial<DealRecord>): Promise<DealRecord | null> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('negocios')
        .update(this.dealToRow(patch as DealRecord))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return this.rowToDeal(data);
    }
    const idx = this.mem.deals.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    this.mem.deals[idx] = { ...this.mem.deals[idx], ...patch };
    return this.mem.deals[idx];
  }

  // ------------------------------------------------------------------
  // Produtos
  // ------------------------------------------------------------------
  async listProducts(): Promise<ProductRecord[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('produtos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => this.rowToProduct(row));
    }
    return this.mem.products;
  }

  async createProduct(product: ProductRecord): Promise<ProductRecord> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('produtos')
        .insert(this.productToRow(product))
        .select()
        .single();
      if (error) throw error;
      return this.rowToProduct(data);
    }
    this.mem.products.unshift(product);
    return product;
  }

  async updateProduct(id: string, patch: Partial<ProductRecord>): Promise<ProductRecord | null> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('produtos')
        .update(this.productToRow(patch as ProductRecord))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return this.rowToProduct(data);
    }
    const idx = this.mem.products.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.mem.products[idx] = { ...this.mem.products[idx], ...patch };
    return this.mem.products[idx];
  }

  // ------------------------------------------------------------------
  // Assinaturas
  // ------------------------------------------------------------------
  async listSubscriptions(): Promise<SubscriptionRecord[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('assinaturas').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => this.rowToSubscription(row));
    }
    return this.mem.subscriptions;
  }

  async createSubscription(sub: SubscriptionRecord): Promise<SubscriptionRecord> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('assinaturas')
        .insert(this.subscriptionToRow(sub))
        .select()
        .single();
      if (error) throw error;
      return this.rowToSubscription(data);
    }
    this.mem.subscriptions.unshift(sub);
    return sub;
  }

  async updateSubscription(id: string, patch: Partial<SubscriptionRecord>): Promise<SubscriptionRecord | null> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('assinaturas')
        .update(this.subscriptionToRow(patch as SubscriptionRecord))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return this.rowToSubscription(data);
    }
    const idx = this.mem.subscriptions.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    this.mem.subscriptions[idx] = { ...this.mem.subscriptions[idx], ...patch };
    return this.mem.subscriptions[idx];
  }

  // ------------------------------------------------------------------
  // Lancamentos financeiros
  // ------------------------------------------------------------------
  async listFinanceEntries(): Promise<FinanceEntry[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('lancamentos_financeiros')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => this.rowToFinanceEntry(row));
    }
    return this.mem.financeEntries;
  }

  async createFinanceEntry(entry: FinanceEntry): Promise<FinanceEntry> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('lancamentos_financeiros')
        .insert(this.financeEntryToRow(entry))
        .select()
        .single();
      if (error) throw error;
      return this.rowToFinanceEntry(data);
    }
    this.mem.financeEntries.unshift(entry);
    return entry;
  }

  async updateFinanceEntry(id: string, patch: Partial<FinanceEntry>): Promise<FinanceEntry | null> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('lancamentos_financeiros')
        .update(this.financeEntryToRow(patch as FinanceEntry))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return this.rowToFinanceEntry(data);
    }
    const idx = this.mem.financeEntries.findIndex((f) => f.id === id);
    if (idx === -1) return null;
    this.mem.financeEntries[idx] = { ...this.mem.financeEntries[idx], ...patch };
    return this.mem.financeEntries[idx];
  }

  // ------------------------------------------------------------------
  // Automacoes
  // ------------------------------------------------------------------
  async listAutomations(): Promise<any[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('automacoes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
    return this.mem.automations;
  }

  async createAutomation(flow: any): Promise<any> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('automacoes').insert(flow).select().single();
      if (error) throw error;
      return data;
    }
    this.mem.automations.unshift(flow);
    return flow;
  }

  async updateAutomation(id: string, patch: any): Promise<any | null> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('automacoes').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }
    const idx = this.mem.automations.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    this.mem.automations[idx] = { ...this.mem.automations[idx], ...patch };
    return this.mem.automations[idx];
  }

  // ------------------------------------------------------------------
  // Usuarios
  // ------------------------------------------------------------------
  async listUsers(): Promise<any[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('perfis_empresariais').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
    return this.mem.users;
  }

  async createUser(user: any): Promise<any> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('perfis_empresariais')
        .insert({
          id: user.id,
          email: user.email,
          nome: user.name,
          role: user.role,
          departamento_id: user.department || null,
          status: user.status,
          avatar_url: user.avatar || null,
          ultimo_acesso: user.lastAccess || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    this.mem.users.unshift(user);
    return user;
  }

  async updateUser(id: string, patch: any): Promise<any | null> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('perfis_empresariais')
        .update({
          nome: patch.name,
          email: patch.email,
          role: patch.role,
          departamento_id: patch.department || null,
          status: patch.status,
          avatar_url: patch.avatar || null,
          ultimo_acesso: patch.lastAccess || null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    const idx = this.mem.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    this.mem.users[idx] = { ...this.mem.users[idx], ...patch };
    return this.mem.users[idx];
  }

  // ------------------------------------------------------------------
  // Auditoria
  // ------------------------------------------------------------------
  async appendAudit(actor: string, action: string, target: string, origin: string): Promise<void> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { error } = await admin.from('auditoria').insert({
        actor,
        action,
        target,
        origin,
        metadata: {},
      });
      if (error) throw error;
      return;
    }
    this.mem.auditLogs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor,
      action,
      target,
      origin: origin as any,
    });
  }

  async listAuditLogs(): Promise<any[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('auditoria')
        .select('*')
        .order('timestamp', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
    return this.mem.auditLogs;
  }

  // ------------------------------------------------------------------
  // Runs
  // ------------------------------------------------------------------
  async listRuns(): Promise<any[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('runs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
    return this.mem.runs;
  }

  async createRun(run: any): Promise<any> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('runs').insert(run).select().single();
      if (error) throw error;
      return data;
    }
    this.mem.runs.unshift(run);
    return run;
  }

  async updateRun(id: string, patch: any): Promise<any | null> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('runs').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }
    const idx = this.mem.runs.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.mem.runs[idx] = { ...this.mem.runs[idx], ...patch };
    return this.mem.runs[idx];
  }

  // ------------------------------------------------------------------
  // Atividades
  // ------------------------------------------------------------------
  async listActivities(): Promise<any[]> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
    return this.mem.activities;
  }

  async createActivity(activity: any): Promise<any> {
    if (this.useSupabase) {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from('activities').insert(activity).select().single();
      if (error) throw error;
      return data;
    }
    this.mem.activities.unshift(activity);
    return activity;
  }

  // ------------------------------------------------------------------
  // Snapshot completo (compatibilidade com estado em memoria)
  // ------------------------------------------------------------------
  getSnapshot(): EnterpriseDataState {
    return this.mem;
  }

  // ------------------------------------------------------------------
  // Mapeadores linha <-> DTO
  // ------------------------------------------------------------------
  private projectToRow(p: ProjectRecord): any {
    return {
      id: p.id,
      codigo: p.code,
      nome: p.name,
      cliente_id: p.clientId,
      cliente_nome: p.clientName,
      stage: p.stage,
      owner_name: p.ownerName,
      start_date: p.startDate,
      end_date: p.endDate,
      progress: p.progress,
      budget_brl: p.budgetBRL,
      spent_brl: p.spentBRL,
      hermes_project_id: p.hermesProjectId || null,
      // Modelo estratégico empresarial
      strategic_objective: p.strategicObjective || null,
      problem_to_solve: p.problemToSolve || null,
      expected_outcome: p.expectedOutcome || null,
      success_indicators: p.successIndicators || [],
      priority: p.priority || null,
      risks_and_dependencies: p.risksAndDependencies || [],
      managing_agent_id: p.managingAgentId || null,
      team_agent_ids: p.teamAgentIds || [],
      strategic_milestones: p.strategicMilestones || [],
      linked_documents: p.linkedDocuments || [],
      decision_history: p.decisionHistory || [],
    };
  }

  private rowToProject(row: any): ProjectRecord {
    return {
      id: row.id,
      code: row.codigo,
      name: row.nome,
      clientId: row.cliente_id,
      clientName: row.cliente_nome,
      stage: row.stage,
      ownerName: row.owner_name,
      startDate: row.start_date,
      endDate: row.end_date,
      progress: row.progress,
      budgetBRL: Number(row.budget_brl || 0),
      spentBRL: Number(row.spent_brl || 0),
      hermesProjectId: row.hermes_project_id || undefined,
      // Modelo estratégico empresarial
      strategicObjective: row.strategic_objective || undefined,
      problemToSolve: row.problem_to_solve || undefined,
      expectedOutcome: row.expected_outcome || undefined,
      successIndicators: row.success_indicators || [],
      priority: row.priority || undefined,
      risksAndDependencies: row.risks_and_dependencies || [],
      managingAgentId: row.managing_agent_id || undefined,
      teamAgentIds: row.team_agent_ids || [],
      strategicMilestones: row.strategic_milestones || [],
      linkedDocuments: row.linked_documents || [],
      decisionHistory: row.decision_history || [],
      deliverables: [],
      activities: [],
    } as ProjectRecord;
  }

  private clientToRow(c: ClientRecord): any {
    return {
      id: c.id,
      nome: c.name,
      segmento: c.segment,
      cnpj: c.cnpj,
      contato_principal: c.primaryContact,
      email: c.email,
      telefone: c.phone,
      gerente_conta: c.accountManager,
      status: c.status,
      mrr_brl: c.mrrBRL,
      ltv_brl: c.ltvBRL,
      since: c.since,
      produtos: c.products,
    };
  }

  private rowToClient(row: any): ClientRecord {
    return {
      id: row.id,
      name: row.nome,
      segment: row.segmento,
      cnpj: row.cnpj,
      primaryContact: row.contato_principal,
      email: row.email,
      phone: row.telefone,
      accountManager: row.gerente_conta,
      status: row.status,
      mrrBRL: Number(row.mrr_brl || 0),
      ltvBRL: Number(row.ltv_brl || 0),
      since: row.since,
      products: row.produtos || [],
      interactions: [],
    } as ClientRecord;
  }

  private dealToRow(d: DealRecord): any {
    return {
      id: d.id,
      titulo: d.title,
      cliente_id: d.clientId,
      cliente_nome: d.clientName,
      stage: d.stage,
      valor_brl: d.valueBRL,
      probabilidade: d.probability,
      owner_name: d.ownerName,
      expected_close: d.expectedClose,
      next_step: d.nextStep,
      notas: d.notes,
    };
  }

  private rowToDeal(row: any): DealRecord {
    return {
      id: row.id,
      title: row.titulo,
      clientId: row.cliente_id,
      clientName: row.cliente_nome,
      stage: row.stage,
      valueBRL: Number(row.valor_brl || 0),
      probability: row.probabilidade,
      ownerName: row.owner_name,
      expectedClose: row.expected_close,
      nextStep: row.next_step,
      notes: row.notas || [],
    } as DealRecord;
  }

  private productToRow(p: ProductRecord): any {
    return {
      id: p.id,
      sku: p.sku,
      nome: p.name,
      categoria: p.category,
      billing_model: p.billingModel,
      price_brl: p.priceBRL,
      margin_percent: p.marginPercent,
      active_clients: p.activeClients,
      status: p.status,
      descricao: p.description,
    };
  }

  private rowToProduct(row: any): ProductRecord {
    return {
      id: row.id,
      sku: row.sku,
      name: row.nome,
      category: row.categoria as any,
      billingModel: row.billing_model as any,
      priceBRL: Number(row.price_brl || 0),
      marginPercent: Number(row.margin_percent || 0),
      activeClients: row.active_clients,
      status: row.status as any,
      description: row.descricao,
    } as ProductRecord;
  }

  private subscriptionToRow(s: SubscriptionRecord): any {
    return {
      id: s.id,
      cliente_id: s.clientId,
      cliente_nome: s.clientName,
      plano: s.planName,
      ciclo: s.cycle,
      mrr_brl: s.mrrBRL,
      status: s.status,
      next_billing_date: s.nextBillingDate,
      overdue_days: s.overdueDays,
    };
  }

  private rowToSubscription(row: any): SubscriptionRecord {
    return {
      id: row.id,
      clientId: row.cliente_id,
      clientName: row.cliente_nome,
      planName: row.plano,
      cycle: row.ciclo as any,
      mrrBRL: Number(row.mrr_brl || 0),
      status: row.status as any,
      nextBillingDate: row.next_billing_date,
      overdueDays: row.overdue_days,
      payments: [],
    } as SubscriptionRecord;
  }

  private financeEntryToRow(e: FinanceEntry): any {
    return {
      id: e.id,
      data: e.date,
      descricao: e.description,
      contraparte: e.counterparty,
      categoria: e.category,
      tipo: e.type,
      status: e.status,
      amount_brl: e.amountBRL,
    };
  }

  private rowToFinanceEntry(row: any): FinanceEntry {
    return {
      id: row.id,
      date: row.data,
      description: row.descricao,
      counterparty: row.contraparte,
      category: row.categoria as any,
      type: row.tipo as any,
      status: row.status as any,
      amountBRL: Number(row.amount_brl || 0),
    } as FinanceEntry;
  }
}
