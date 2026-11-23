import React, { useMemo, useState } from 'react';
import { Edit3, Package, Plus, Power } from 'lucide-react';
import {
  PageHeader,
  SegmentedTabs,
  SlideDrawer,
  StatusText,
} from '../../components/ui/Primitives';
import { formatBRL, PlatformApi } from '../../services/api';
import type { ProductCategory, ProductRecord } from '../../types/platform';

interface ProductsViewProps {
  products: ProductRecord[];
  onRefresh: () => Promise<void>;
  onToast: (msg: string) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  onRefresh,
  onToast,
}) => {
  const [viewMode, setViewMode] = useState<'cartoes' | 'tabela'>('cartoes');
  const [category, setCategory] = useState<'Todos' | ProductCategory>('Todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    category: 'Software SaaS' as ProductCategory,
    billingModel: 'Recorrente Mensal' as ProductRecord['billingModel'],
    priceBRL: '',
    marginPercent: '',
    status: 'Ativo' as ProductRecord['status'],
    description: '',
  });

  const [form, setForm] = useState({
    name: '',
    category: 'Software SaaS' as ProductCategory,
    billingModel: 'Recorrente Mensal' as ProductRecord['billingModel'],
    priceBRL: '7500',
    marginPercent: '76',
    description: '',
  });

  const filtered = useMemo(() => {
    if (category === 'Todos') return products;
    return products.filter((p) => p.category === category);
  }, [products, category]);

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId) || null,
    [products, selectedId],
  );

  const openProductDrawer = (prod: ProductRecord, startEditing = false) => {
    setSelectedId(prod.id);
    setEditForm({
      name: prod.name,
      category: prod.category,
      billingModel: prod.billingModel,
      priceBRL: String(prod.priceBRL),
      marginPercent: String(prod.marginPercent),
      status: prod.status,
      description: prod.description,
    });
    setEditMode(startEditing);
  };

  const handleToggleStatus = async (prod: ProductRecord) => {
    const nextStatus: ProductRecord['status'] = prod.status === 'Inativo' ? 'Ativo' : 'Inativo';
    setSaving(true);
    try {
      await PlatformApi.updateProduct(prod.id, { status: nextStatus });
      await onRefresh();
      onToast(`${prod.name} marcado como ${nextStatus}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao alterar status da oferta.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !editForm.name.trim()) return;
    setSaving(true);
    try {
      await PlatformApi.updateProduct(selected.id, {
        name: editForm.name.trim(),
        category: editForm.category,
        billingModel: editForm.billingModel,
        priceBRL: Number(editForm.priceBRL) || 0,
        marginPercent: Number(editForm.marginPercent) || 0,
        status: editForm.status,
        description: editForm.description.trim(),
      });
      setEditMode(false);
      await onRefresh();
      onToast('Produto atualizado com sucesso.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar produto.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await PlatformApi.createProduct({
        name: form.name.trim(),
        category: form.category,
        billingModel: form.billingModel,
        priceBRL: Number(form.priceBRL) || 5000,
        marginPercent: Number(form.marginPercent) || 70,
        description: form.description.trim() || 'Oferta empresarial TokenizAi.',
      });
      setForm({ ...form, name: '', description: '' });
      setCreateOpen(false);
      await onRefresh();
      onToast('Produto cadastrado no catálogo.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao cadastrar produto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos & Serviços"
        subtitle="Catálogo comercial editável com precificação, modelo de cobrança, clientes ativos e margem operacional."
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
              <span>Novo produto</span>
            </button>
          </>
        }
      />

      <SegmentedTabs
        active={category}
        onChange={setCategory}
        tabs={[
          { id: 'Todos', label: 'Todos', count: products.length },
          { id: 'Software SaaS', label: 'Software SaaS' },
          { id: 'Automação IA', label: 'Automação IA' },
          { id: 'Consultoria', label: 'Consultoria' },
          { id: 'Suporte Gerenciado', label: 'Suporte' },
        ]}
      />

      {viewMode === 'cartoes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((prod) => (
            <div
              key={prod.id}
              role="button"
              tabIndex={0}
              onClick={() => openProductDrawer(prod, false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openProductDrawer(prod, false);
                }
              }}
              className={`nc-card rounded-2xl p-5 text-left cursor-pointer flex flex-col justify-between gap-4 ${
                selectedId === prod.id ? 'nc-card-active' : ''
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-accent dark:text-cyan-300">
                    <Package className="w-3.5 h-3.5" />
                    {prod.sku}
                  </span>
                  <StatusText
                    label={prod.status}
                    tone={prod.status === 'Ativo' ? 'nominal' : prod.status === 'Em Revisão' ? 'attention' : 'neutral'}
                  />
                </div>

                <div>
                  <h3 className="font-display text-base font-semibold text-ink leading-snug">
                    {prod.name}
                  </h3>
                  <div className="text-xs text-ink-subtle mt-1">
                    {prod.category} · {prod.billingModel}
                  </div>
                </div>

                <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                  {prod.description}
                </p>

                <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-surface-subtle/60 border border-line text-xs">
                  <div>
                    <div className="text-ink-subtle">Valor</div>
                    <div className="font-mono font-semibold text-ink tabular-nums mt-0.5">
                      {formatBRL(prod.priceBRL)}
                    </div>
                  </div>
                  <div>
                    <div className="text-ink-subtle">Margem</div>
                    <div className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                      {prod.marginPercent}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-ink-subtle">Clientes</div>
                    <div className="font-mono font-semibold text-highlight tabular-nums mt-0.5">
                      {prod.activeClients}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStatus(prod);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line-strong bg-surface-subtle/60 hover:bg-surface-blue text-xs font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer"
                >
                  <Power className="w-3 h-3" />
                  <span>{prod.status === 'Inativo' ? 'Ativar' : 'Desativar'}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openProductDrawer(prod, true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line-strong bg-surface-subtle/60 hover:bg-surface-blue text-xs font-medium text-ink transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Editar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'tabela' && (
        <section className="rounded-2xl nc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-[11px] font-semibold text-ink-subtle bg-surface-subtle/40">
                  <th className="py-3 px-6">SKU</th>
                  <th className="py-3 px-4">Produto / Serviço</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Modelo de Cobrança</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Clientes Ativos</th>
                  <th className="py-3 px-4 text-right">Margem</th>
                  <th className="py-3 px-6 text-right">Valor Base</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {filtered.map((prod) => (
                  <tr
                    key={prod.id}
                    onClick={() => openProductDrawer(prod, false)}
                    className="hover:bg-surface-blue/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-6 font-mono text-xs text-ink-subtle whitespace-nowrap">
                      {prod.sku}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-ink">{prod.name}</td>
                    <td className="py-3.5 px-4 text-xs text-ink-muted">{prod.category}</td>
                    <td className="py-3.5 px-4 text-xs text-ink-subtle whitespace-nowrap">
                      {prod.billingModel}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusText
                        label={prod.status}
                        tone={prod.status === 'Ativo' ? 'nominal' : prod.status === 'Em Revisão' ? 'attention' : 'neutral'}
                      />
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums">
                      {prod.activeClients}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-emerald-700 dark:text-emerald-400">
                      {prod.marginPercent}%
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-xs font-semibold tabular-nums">
                      {formatBRL(prod.priceBRL)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <SlideDrawer
        open={Boolean(selected)}
        onClose={() => {
          setSelectedId(null);
          setEditMode(false);
        }}
        subtitle={selected ? `${selected.sku} · ${selected.category}` : undefined}
        title={selected?.name || ''}
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-2">
              <StatusText
                label={selected.status}
                tone={selected.status === 'Ativo' ? 'nominal' : selected.status === 'Em Revisão' ? 'attention' : 'neutral'}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleToggleStatus(selected)}
                  className="px-3 py-1.5 rounded-lg border border-line-strong text-xs font-medium text-ink-muted hover:text-ink cursor-pointer"
                >
                  {selected.status === 'Inativo' ? 'Ativar oferta' : 'Desativar'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode(!editMode)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-subtle cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{editMode ? 'Cancelar' : 'Editar produto'}</span>
                </button>
              </div>
            </div>

            {editMode ? (
              <form onSubmit={handleSaveEdit} className="space-y-4 p-4 rounded-xl bg-surface-subtle/50 border border-line-strong">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Nome da oferta</label>
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
                    <label className="block text-xs font-medium text-ink-muted mb-1">Categoria</label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value as ProductCategory })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                    >
                      <option value="Software SaaS">Software SaaS</option>
                      <option value="Automação IA">Automação IA</option>
                      <option value="Consultoria">Consultoria</option>
                      <option value="Suporte Gerenciado">Suporte Gerenciado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Modelo de cobrança</label>
                    <select
                      value={editForm.billingModel}
                      onChange={(e) =>
                        setEditForm({ ...editForm, billingModel: e.target.value as ProductRecord['billingModel'] })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                    >
                      <option value="Recorrente Mensal">Recorrente Mensal</option>
                      <option value="Recorrente Anual">Recorrente Anual</option>
                      <option value="Projeto Fechado">Projeto Fechado</option>
                      <option value="Hora Técnica">Hora Técnica</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Valor base (R$)</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.priceBRL}
                      onChange={(e) => setEditForm({ ...editForm, priceBRL: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Margem (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editForm.marginPercent}
                      onChange={(e) => setEditForm({ ...editForm, marginPercent: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Situação</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ProductRecord['status'] })}
                    className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Em Revisão">Em Revisão</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Descrição</label>
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                  />
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
                    {saving ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="text-sm text-ink-muted leading-relaxed">{selected.description}</p>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-line text-sm">
                  <div>
                    <div className="text-xs text-ink-subtle">Valor de tabela</div>
                    <div className="font-mono text-lg font-semibold tabular-nums mt-0.5 text-ink">
                      {formatBRL(selected.priceBRL)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-subtle">Modelo</div>
                    <div className="text-ink font-medium mt-1">{selected.billingModel}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-subtle">Margem estimada</div>
                    <div className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums mt-0.5">
                      {selected.marginPercent}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-subtle">Contas ativas</div>
                    <div className="font-mono text-highlight font-semibold tabular-nums mt-0.5">
                      {selected.activeClients} clientes
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </SlideDrawer>

      <SlideDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Cadastrar Produto ou Serviço"
        subtitle="Defina categoria, modelo de receita e margem alvo"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Nome</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Auditoria Contínua de Contratos"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
              >
                <option value="Software SaaS">Software SaaS</option>
                <option value="Automação IA">Automação IA</option>
                <option value="Consultoria">Consultoria</option>
                <option value="Suporte Gerenciado">Suporte Gerenciado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Cobrança</label>
              <select
                value={form.billingModel}
                onChange={(e) =>
                  setForm({ ...form, billingModel: e.target.value as ProductRecord['billingModel'] })
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
              >
                <option value="Recorrente Mensal">Recorrente Mensal</option>
                <option value="Recorrente Anual">Recorrente Anual</option>
                <option value="Projeto Fechado">Projeto Fechado</option>
                <option value="Hora Técnica">Hora Técnica</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Valor base (R$)</label>
              <input
                type="number"
                min={100}
                value={form.priceBRL}
                onChange={(e) => setForm({ ...form, priceBRL: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Margem alvo (%)</label>
              <input
                type="number"
                min={5}
                max={99}
                value={form.marginPercent}
                onChange={(e) => setForm({ ...form, marginPercent: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Descrição comercial</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-lg border border-line-strong text-xs font-medium text-ink-muted hover:text-ink cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="nc-primary-btn px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Salvar produto
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
};
