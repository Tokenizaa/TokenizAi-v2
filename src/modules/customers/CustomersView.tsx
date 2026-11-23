import React, { useMemo, useState } from 'react';
import { Building2, Edit3, Mail, Phone, Plus, Search } from 'lucide-react';
import {
  PageHeader,
  SegmentedTabs,
  SlideDrawer,
  StatusText,
} from '../../components/ui/Primitives';
import { formatBRL, formatDateBR, PlatformApi } from '../../services/api';
import type {
  ClientRecord,
  ClientStatus,
  DealRecord,
  ProjectRecord,
  SubscriptionRecord,
} from '../../types/platform';

interface CustomersViewProps {
  clients: ClientRecord[];
  projects: ProjectRecord[];
  deals: DealRecord[];
  subscriptions: SubscriptionRecord[];
  onRefresh: () => Promise<void>;
  onToast: (msg: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  clients,
  projects,
  deals,
  subscriptions,
  onRefresh,
  onToast,
}) => {
  const [viewMode, setViewMode] = useState<'cartoes' | 'tabela'>('cartoes');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | ClientStatus>('Todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'ficha' | 'contratos' | 'historico'>('ficha');
  const [editMode, setEditMode] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [channel, setChannel] = useState<'Reunião' | 'E-mail' | 'Proposta' | 'Suporte'>('Reunião');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    segment: '',
    cnpj: '',
    primaryContact: '',
    email: '',
    phone: '',
    accountManager: '',
    status: 'Ativo' as ClientStatus,
    mrrBRL: '',
  });

  const [newClient, setNewClient] = useState({
    name: '',
    segment: 'Tecnologia & Serviços',
    cnpj: '',
    primaryContact: '',
    email: '',
    phone: '',
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter !== 'Todos' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.segment.toLowerCase().includes(q) ||
        c.primaryContact.toLowerCase().includes(q)
      );
    });
  }, [clients, search, statusFilter]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedId) || null,
    [clients, selectedId],
  );

  const clientRelated = useMemo(() => {
    if (!selectedClient) return { projects: [], deals: [], subs: [] };
    return {
      projects: projects.filter((p) => p.clientId === selectedClient.id),
      deals: deals.filter((d) => d.clientId === selectedClient.id),
      subs: subscriptions.filter((s) => s.clientId === selectedClient.id),
    };
  }, [selectedClient, projects, deals, subscriptions]);

  const openClientDrawer = (client: ClientRecord, startEditing = false) => {
    setSelectedId(client.id);
    setDrawerTab('ficha');
    setEditForm({
      name: client.name,
      segment: client.segment,
      cnpj: client.cnpj,
      primaryContact: client.primaryContact,
      email: client.email,
      phone: client.phone,
      accountManager: client.accountManager,
      status: client.status,
      mrrBRL: String(client.mrrBRL),
    });
    setEditMode(startEditing);
  };

  const handleSaveClientEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !editForm.name.trim()) return;
    setSaving(true);
    try {
      await PlatformApi.updateClient(selectedClient.id, {
        name: editForm.name.trim(),
        segment: editForm.segment.trim(),
        cnpj: editForm.cnpj.trim(),
        primaryContact: editForm.primaryContact.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        accountManager: editForm.accountManager.trim(),
        status: editForm.status,
        mrrBRL: Number(editForm.mrrBRL) || 0,
      });
      setEditMode(false);
      await onRefresh();
      onToast('Cadastro do cliente atualizado com sucesso.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar cadastro.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !note.trim()) return;
    setSaving(true);
    try {
      await PlatformApi.addClientInteraction(selectedClient.id, { channel, note: note.trim() });
      setNote('');
      await onRefresh();
      onToast('Interação registrada na ficha do cliente.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao registrar interação.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name.trim()) return;
    setSaving(true);
    try {
      await PlatformApi.createClient(newClient);
      setNewClient({
        name: '',
        segment: 'Tecnologia & Serviços',
        cnpj: '',
        primaryContact: '',
        email: '',
        phone: '',
      });
      setCreateOpen(false);
      await onRefresh();
      onToast('Cliente cadastrado no CRM.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao cadastrar cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes & CRM"
        subtitle="Carteira B2B com ficha cadastral editável, produtos contratados, contratos e histórico de relacionamento."
        actions={
          <>
            <SegmentedTabs
              active={viewMode}
              onChange={setViewMode}
              tabs={[
                { id: 'cartoes', label: 'Cartões', count: filtered.length },
                { id: 'tabela', label: 'Tabela' },
              ]}
            />
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="nc-primary-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo cliente</span>
            </button>
          </>
        }
      />

      {/* Contextual Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:max-w-sm">
          <Search className="w-4 h-4 text-ink-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por empresa, segmento ou contato..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-line-strong bg-surface text-sm text-ink"
          />
        </div>

        <SegmentedTabs
          active={statusFilter}
          onChange={setStatusFilter}
          tabs={[
            { id: 'Todos', label: 'Todos', count: clients.length },
            { id: 'Ativo', label: 'Ativos' },
            { id: 'Em Implantação', label: 'Implantação' },
            { id: 'Em Risco', label: 'Em Risco' },
          ]}
        />
      </div>

      {/* CARDS VIEW */}
      {viewMode === 'cartoes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((client) => {
            const relatedProjectsCount = projects.filter((p) => p.clientId === client.id).length;
            return (
              <div
                key={client.id}
                role="button"
                tabIndex={0}
                onClick={() => openClientDrawer(client, false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openClientDrawer(client, false);
                  }
                }}
                className={`nc-card rounded-2xl p-5 text-left cursor-pointer flex flex-col justify-between gap-4 ${
                  selectedId === client.id ? 'nc-card-active' : ''
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-subtle">
                        <Building2 className="w-3.5 h-3.5 text-accent dark:text-cyan-300 shrink-0" />
                        <span className="truncate">{client.segment}</span>
                      </div>
                      <h3 className="font-display text-base font-semibold text-ink mt-1 truncate">
                        {client.name}
                      </h3>
                    </div>
                    <StatusText
                      label={client.status}
                      tone={
                        client.status === 'Ativo'
                          ? 'nominal'
                          : client.status === 'Em Risco'
                            ? 'critical'
                            : 'attention'
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-2.5 px-3 rounded-xl bg-surface-subtle/60 border border-line text-xs">
                    <div>
                      <div className="text-ink-subtle">MRR</div>
                      <div className="font-mono font-semibold text-ink tabular-nums mt-0.5">
                        {formatBRL(client.mrrBRL)}
                      </div>
                    </div>
                    <div>
                      <div className="text-ink-subtle">LTV Acumulado</div>
                      <div className="font-mono font-semibold text-highlight tabular-nums mt-0.5">
                        {formatBRL(client.ltvBRL)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-ink-muted">
                    <div className="font-medium text-ink truncate">
                      Contato: {client.primaryContact}
                    </div>
                    <div className="text-ink-subtle truncate">{client.email}</div>
                    <div className="text-ink-subtle truncate">
                      Produtos: {client.products.slice(0, 2).join(', ')}
                      {client.products.length > 2 ? ` +${client.products.length - 2}` : ''}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                  <span className="text-xs text-ink-subtle truncate">
                    Gestor: <strong className="font-medium text-ink-muted">{client.accountManager}</strong> · {relatedProjectsCount} proj.
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openClientDrawer(client, true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line-strong bg-surface-subtle/60 hover:bg-surface-blue text-xs font-medium text-ink transition-colors cursor-pointer shrink-0"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Editar</span>
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-2xl nc-card p-10 text-center text-sm text-ink-subtle">
              Nenhum cliente corresponde aos filtros selecionados.
            </div>
          )}
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'tabela' && (
        <section className="rounded-2xl nc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-[11px] font-semibold text-ink-subtle bg-surface-subtle/40">
                  <th className="py-3 px-6">Empresa</th>
                  <th className="py-3 px-4">Contato Principal</th>
                  <th className="py-3 px-4">Gestor da Conta</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">MRR</th>
                  <th className="py-3 px-6 text-right">LTV Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {filtered.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => openClientDrawer(client, false)}
                    className="hover:bg-surface-blue/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-6">
                      <div className="font-medium text-ink">{client.name}</div>
                      <div className="text-xs text-ink-subtle">{client.segment}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-ink-muted">{client.primaryContact}</div>
                      <div className="text-xs text-ink-subtle">{client.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-ink-muted whitespace-nowrap">
                      {client.accountManager}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusText
                        label={client.status}
                        tone={
                          client.status === 'Ativo'
                            ? 'nominal'
                            : client.status === 'Em Risco'
                              ? 'critical'
                              : 'attention'
                        }
                      />
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-ink">
                      {formatBRL(client.mrrBRL)}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-xs tabular-nums text-ink-muted">
                      {formatBRL(client.ltvBRL)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* CLIENT DOSSIER DRAWER */}
      <SlideDrawer
        open={Boolean(selectedClient)}
        onClose={() => {
          setSelectedId(null);
          setEditMode(false);
        }}
        subtitle={selectedClient ? `${selectedClient.segment} · CNPJ ${selectedClient.cnpj}` : undefined}
        title={selectedClient?.name || ''}
      >
        {selectedClient && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SegmentedTabs
                active={drawerTab}
                onChange={(t) => {
                  setDrawerTab(t);
                  if (t !== 'ficha') setEditMode(false);
                }}
                tabs={[
                  { id: 'ficha', label: 'Ficha & Contatos' },
                  { id: 'contratos', label: 'Contratos & Projetos' },
                  { id: 'historico', label: 'Relacionamento', count: selectedClient.interactions.length },
                ]}
              />
              {drawerTab === 'ficha' && (
                <button
                  type="button"
                  onClick={() => setEditMode(!editMode)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-subtle cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{editMode ? 'Cancelar' : 'Editar cadastro'}</span>
                </button>
              )}
            </div>

            {drawerTab === 'ficha' && editMode && (
              <form onSubmit={handleSaveClientEdit} className="space-y-4 p-4 rounded-xl bg-surface-subtle/50 border border-line-strong">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Razão social / Nome</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Segmento</label>
                    <input
                      type="text"
                      value={editForm.segment}
                      onChange={(e) => setEditForm({ ...editForm, segment: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">CNPJ</label>
                    <input
                      type="text"
                      value={editForm.cnpj}
                      onChange={(e) => setEditForm({ ...editForm, cnpj: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Situação comercial</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ClientStatus })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Em Implantação">Em Implantação</option>
                      <option value="Em Risco">Em Risco</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">MRR (R$)</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.mrrBRL}
                      onChange={(e) => setEditForm({ ...editForm, mrrBRL: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Contato principal</label>
                    <input
                      type="text"
                      value={editForm.primaryContact}
                      onChange={(e) => setEditForm({ ...editForm, primaryContact: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Gestor da conta</label>
                    <input
                      type="text"
                      value={editForm.accountManager}
                      onChange={(e) => setEditForm({ ...editForm, accountManager: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">E-mail</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Telefone</label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-line-strong text-xs text-ink-muted cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="nc-primary-btn px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    {saving ? 'Salvando...' : 'Salvar cadastro'}
                  </button>
                </div>
              </form>
            )}

            {drawerTab === 'ficha' && !editMode && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 py-4 border-y border-line text-sm">
                  <div>
                    <div className="text-xs text-ink-subtle">MRR Atual</div>
                    <div className="font-mono text-lg font-semibold text-ink tabular-nums mt-0.5">
                      {formatBRL(selectedClient.mrrBRL)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-subtle">LTV Total</div>
                    <div className="font-mono text-lg font-semibold text-highlight tabular-nums mt-0.5">
                      {formatBRL(selectedClient.ltvBRL)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-subtle">Cliente desde</div>
                    <div className="font-mono text-ink mt-0.5">{formatDateBR(selectedClient.since)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-subtle">Gestor responsável</div>
                    <div className="text-ink font-medium mt-0.5">{selectedClient.accountManager}</div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="text-xs font-medium text-ink-subtle">Contato Executivo</div>
                  <div className="font-medium text-ink">{selectedClient.primaryContact}</div>
                  <div className="flex flex-wrap gap-4 text-xs text-ink-muted pt-1">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
                      {selectedClient.email}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
                      {selectedClient.phone}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-ink-subtle">Produtos Contratados</div>
                  <ul className="divide-y divide-line border border-line rounded-xl">
                    {selectedClient.products.map((prod) => (
                      <li key={prod} className="px-4 py-2.5 text-sm text-ink">
                        {prod}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {drawerTab === 'contratos' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-ink-subtle mb-2">Assinaturas</h3>
                  <div className="divide-y divide-line border border-line rounded-xl">
                    {clientRelated.subs.map((sub) => (
                      <div key={sub.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-ink">{sub.planName}</div>
                          <div className="text-xs text-ink-subtle">
                            Ciclo {sub.cycle} · Próx. cobrança {formatDateBR(sub.nextBillingDate)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-semibold tabular-nums">
                            {formatBRL(sub.mrrBRL)}
                          </div>
                          <StatusText
                            label={sub.status}
                            tone={sub.status === 'Ativa' ? 'nominal' : sub.status === 'Inadimplente' ? 'critical' : 'attention'}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-ink-subtle mb-2">Projetos Vinculados</h3>
                  <div className="divide-y divide-line border border-line rounded-xl">
                    {clientRelated.projects.map((p) => (
                      <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-ink">
                            {p.code} · {p.name}
                          </div>
                          <div className="text-xs text-ink-subtle">
                            {p.stage} · Entrega {formatDateBR(p.endDate)}
                          </div>
                        </div>
                        <span className="font-mono text-xs tabular-nums text-ink-muted">{p.progress}%</span>
                      </div>
                    ))}
                    {clientRelated.projects.length === 0 && (
                      <div className="px-4 py-4 text-xs text-ink-subtle">Nenhum projeto vinculado.</div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-ink-subtle mb-2">Oportunidades Abertas</h3>
                  <div className="divide-y divide-line border border-line rounded-xl">
                    {clientRelated.deals.map((d) => (
                      <div key={d.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-ink">{d.title}</div>
                          <div className="text-xs text-ink-subtle">{d.stage} · {d.nextStep}</div>
                        </div>
                        <span className="font-mono text-xs font-semibold tabular-nums">
                          {formatBRL(d.valueBRL)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {drawerTab === 'historico' && (
              <div className="space-y-5">
                <form onSubmit={handleAddInteraction} className="space-y-3 pb-4 border-b border-line">
                  <div className="flex gap-2">
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as typeof channel)}
                      className="px-3 py-2 rounded-lg border border-line-strong bg-canvas text-xs font-medium text-ink"
                    >
                      <option value="Reunião">Reunião</option>
                      <option value="E-mail">E-mail</option>
                      <option value="Proposta">Proposta</option>
                      <option value="Suporte">Suporte</option>
                    </select>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Resumo da interação com o cliente..."
                      className="flex-1 px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={saving || !note.trim()}
                      className="nc-primary-btn px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      Registrar contato
                    </button>
                  </div>
                </form>

                <div className="space-y-4">
                  {selectedClient.interactions.map((int) => (
                    <div key={int.id} className="pb-3 border-b border-line last:border-none">
                      <div className="text-xs text-ink-subtle">
                        {int.channel} · {int.date} · {int.author}
                      </div>
                      <p className="text-sm text-ink-muted mt-1">{int.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SlideDrawer>

      <SlideDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Novo Cliente Corporativo"
        subtitle="Cadastre uma empresa na base de relacionamento"
      >
        <form onSubmit={handleCreateClient} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Razão social / Nome</label>
            <input
              type="text"
              required
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
              placeholder="Ex.: Nova Indústria Paulista S.A."
              className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Segmento</label>
              <input
                type="text"
                value={newClient.segment}
                onChange={(e) => setNewClient({ ...newClient, segment: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">CNPJ</label>
              <input
                type="text"
                value={newClient.cnpj}
                onChange={(e) => setNewClient({ ...newClient, cnpj: e.target.value })}
                placeholder="00.000.000/0001-00"
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Contato principal</label>
            <input
              type="text"
              value={newClient.primaryContact}
              onChange={(e) => setNewClient({ ...newClient, primaryContact: e.target.value })}
              placeholder="Nome do executivo ou gestor"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">E-mail</label>
              <input
                type="email"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                placeholder="contato@empresa.com.br"
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Telefone</label>
              <input
                type="text"
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                placeholder="(11) 99999-0000"
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
              />
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-lg border border-line-strong text-xs font-medium text-ink-muted cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="nc-primary-btn px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cadastrar cliente
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
};
