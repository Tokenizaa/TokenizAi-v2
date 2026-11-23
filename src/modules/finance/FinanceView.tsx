import React, { useMemo, useState } from 'react';
import { Edit3, Plus } from 'lucide-react';
import {
  PageHeader,
  SegmentedTabs,
  SlideDrawer,
  StatusText,
} from '../../components/ui/Primitives';
import { formatBRL, formatDateBR, PlatformApi } from '../../services/api';
import type { FinanceEntry, FinanceEntryType } from '../../types/platform';

interface FinanceViewProps {
  entries: FinanceEntry[];
  onRefresh: () => Promise<void>;
  onToast: (msg: string) => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  entries,
  onRefresh,
  onToast,
}) => {
  const [typeFilter, setTypeFilter] = useState<'Todos' | FinanceEntryType>('Todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [periodFilter, setPeriodFilter] = useState<'todos' | 'realizado' | 'proximos' | 'atraso'>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    description: '',
    counterparty: '',
    category: 'Projetos' as FinanceEntry['category'],
    type: 'Receber' as FinanceEntryType,
    status: 'Agendado' as FinanceEntry['status'],
    amountBRL: '',
    date: '',
  });

  const [form, setForm] = useState({
    description: '',
    counterparty: '',
    category: 'Projetos' as FinanceEntry['category'],
    type: 'Receber' as FinanceEntryType,
    status: 'Agendado' as FinanceEntry['status'],
    amountBRL: '15000',
    date: '2026-11-30',
  });

  const categories = useMemo(
    () => ['Todas', ...Array.from(new Set(entries.map((e) => e.category)))],
    [entries],
  );

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (typeFilter !== 'Todos' && e.type !== typeFilter) return false;
      if (categoryFilter !== 'Todas' && e.category !== categoryFilter) return false;
      if (periodFilter === 'realizado' && e.date > '2026-11-22') return false;
      if (periodFilter === 'proximos' && e.date <= '2026-11-22') return false;
      if (periodFilter === 'atraso' && e.status !== 'Em Atraso') return false;
      return true;
    });
  }, [entries, typeFilter, categoryFilter, periodFilter]);

  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedId) || null,
    [entries, selectedId],
  );

  const summary = useMemo(() => {
    const receberLiquidado = entries
      .filter((e) => e.type === 'Receber' && e.status === 'Liquidado')
      .reduce((acc, e) => acc + e.amountBRL, 0);
    const receberAberto = entries
      .filter((e) => e.type === 'Receber' && e.status !== 'Liquidado')
      .reduce((acc, e) => acc + e.amountBRL, 0);
    const pagarTotal = entries
      .filter((e) => e.type === 'Pagar')
      .reduce((acc, e) => acc + e.amountBRL, 0);
    return {
      receberLiquidado,
      receberAberto,
      pagarTotal,
      saldoProjetado: receberLiquidado + receberAberto - pagarTotal,
    };
  }, [entries]);

  const openEntryDrawer = (entry: FinanceEntry) => {
    setSelectedId(entry.id);
    setEditForm({
      description: entry.description,
      counterparty: entry.counterparty,
      category: entry.category,
      type: entry.type,
      status: entry.status,
      amountBRL: String(entry.amountBRL),
      date: entry.date,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry || !editForm.description.trim()) return;
    setSaving(true);
    try {
      await PlatformApi.updateFinanceEntry(selectedEntry.id, {
        description: editForm.description.trim(),
        counterparty: editForm.counterparty.trim(),
        category: editForm.category,
        type: editForm.type,
        status: editForm.status,
        amountBRL: Number(editForm.amountBRL) || selectedEntry.amountBRL,
        date: editForm.date,
      });
      setSelectedId(null);
      await onRefresh();
      onToast('Lançamento financeiro atualizado.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar lançamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkSettled = async (id: string) => {
    try {
      await PlatformApi.updateFinanceEntry(id, 'Liquidado');
      await onRefresh();
      onToast('Lançamento marcado como liquidado.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar lançamento.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      await PlatformApi.createFinanceEntry({
        ...form,
        amountBRL: Number(form.amountBRL) || 0,
      });
      setForm({ ...form, description: '', counterparty: '' });
      setCreateOpen(false);
      await onRefresh();
      onToast('Movimentação financeira registrada.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao registrar movimentação.');
    } finally {
      setSaving(false);
    }
  };

  const maxBar = Math.max(summary.receberLiquidado + summary.receberAberto, summary.pagarTotal, 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro & Fluxo de Caixa"
        subtitle="Extrato financeiro com filtros de período e categoria, conciliação e edição completa de lançamentos."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="nc-primary-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo lançamento</span>
          </button>
        }
      />

      {/* Luminous Cashflow Strip + Visual Balance Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <section className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="nc-card rounded-2xl p-5 flex flex-col justify-center">
            <div className="text-xs text-ink-subtle">Recebido (Liquidado)</div>
            <div className="mt-1.5 font-display text-xl font-semibold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatBRL(summary.receberLiquidado)}
            </div>
            <div className="text-xs text-highlight mt-1 font-mono tabular-nums font-medium">
              + {formatBRL(summary.receberAberto)} a receber
            </div>
          </div>

          <div className="nc-card rounded-2xl p-5 flex flex-col justify-center">
            <div className="text-xs text-ink-subtle">Contas a Pagar (Ciclo)</div>
            <div className="mt-1.5 font-display text-xl font-semibold font-mono tabular-nums text-ink">
              {formatBRL(summary.pagarTotal)}
            </div>
            <div className="text-xs text-ink-muted mt-1">
              Operação, nuvem, folha e impostos
            </div>
          </div>

          <div className="nc-card rounded-2xl p-5 flex flex-col justify-center">
            <div className="text-xs text-ink-subtle">Saldo Projetado</div>
            <div className="mt-1.5 font-display text-xl font-semibold font-mono tabular-nums text-accent dark:text-cyan-300">
              {formatBRL(summary.saldoProjetado)}
            </div>
            <div className="text-xs text-ink-muted mt-1">Competência corrente</div>
          </div>
        </section>

        <section className="lg:col-span-5 rounded-2xl nc-glow-panel p-5 flex flex-col justify-center space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink">Entradas Previstas</span>
            <span className="font-mono tabular-nums text-ink font-semibold">
              {formatBRL(summary.receberLiquidado + summary.receberAberto)}
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-surface-subtle overflow-hidden">
            <div
              className="h-full bg-blue-600 dark:bg-cyan-400 rounded-full"
              style={{ width: `${((summary.receberLiquidado + summary.receberAberto) / maxBar) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="font-semibold text-ink">Saídas Comprometidas</span>
            <span className="font-mono tabular-nums text-highlight font-semibold">{formatBRL(summary.pagarTotal)}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-surface-subtle overflow-hidden">
            <div
              className="h-full bg-amber-500 dark:bg-amber-400 rounded-full"
              style={{ width: `${(summary.pagarTotal / maxBar) * 100}%` }}
            />
          </div>
        </section>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SegmentedTabs
          active={typeFilter}
          onChange={setTypeFilter}
          tabs={[
            { id: 'Todos', label: 'Movimentações', count: entries.length },
            { id: 'Receber', label: 'Contas a Receber' },
            { id: 'Pagar', label: 'Contas a Pagar' },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as typeof periodFilter)}
            aria-label="Filtrar por período"
            className="px-3.5 py-2 rounded-xl border border-line-strong bg-surface text-xs font-medium text-ink"
          >
            <option value="todos">Período: Novembro 2026 (Completo)</option>
            <option value="realizado">Período: Até 22/11 (Competência)</option>
            <option value="proximos">Período: Próximos vencimentos (23–30/11)</option>
            <option value="atraso">Período: Somente em atraso</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filtrar por categoria financeira"
            className="px-3.5 py-2 rounded-xl border border-line-strong bg-surface text-xs font-medium text-ink"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                Categoria: {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ledger Table (Preserved with soft subtle dividers & clickable rows for editing) */}
      <section className="rounded-2xl nc-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line text-[11px] font-semibold text-ink-subtle bg-surface-subtle/40">
                <th className="py-3 px-6">Data</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Contraparte</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-sm">
              {filtered.map((entry) => (
                <tr
                  key={entry.id}
                  onClick={() => openEntryDrawer(entry)}
                  className="hover:bg-surface-blue/40 transition-colors cursor-pointer"
                >
                  <td className="py-3.5 px-6 font-mono text-xs text-ink-subtle whitespace-nowrap">
                    {formatDateBR(entry.date)}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-ink">{entry.description}</td>
                  <td className="py-3.5 px-4 text-xs text-ink-muted">{entry.counterparty}</td>
                  <td className="py-3.5 px-4 text-xs text-ink-subtle whitespace-nowrap">
                    {entry.category}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <StatusText
                      label={entry.status}
                      tone={
                        entry.status === 'Liquidado'
                          ? 'nominal'
                          : entry.status === 'Em Atraso'
                            ? 'critical'
                            : 'attention'
                      }
                    />
                  </td>
                  <td
                    className={`py-3.5 px-4 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap ${
                      entry.type === 'Receber'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-ink'
                    }`}
                  >
                    {entry.type === 'Receber' ? '+' : '-'} {formatBRL(entry.amountBRL)}
                  </td>
                  <td className="py-3.5 px-6 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-3">
                      {entry.status !== 'Liquidado' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkSettled(entry.id);
                          }}
                          className="text-xs font-semibold text-accent dark:text-cyan-300 hover:underline cursor-pointer"
                        >
                          Liquidar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEntryDrawer(entry);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink cursor-pointer"
                        aria-label={`Editar ${entry.description}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-ink-subtle">
                    Nenhum lançamento encontrado para os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* EDIT ENTRY DRAWER */}
      <SlideDrawer
        open={Boolean(selectedEntry)}
        onClose={() => setSelectedId(null)}
        title="Editar Lançamento Financeiro"
        subtitle={selectedEntry ? `${selectedEntry.type} · ${selectedEntry.counterparty}` : undefined}
      >
        {selectedEntry && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Tipo</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value as FinanceEntryType })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                >
                  <option value="Receber">Conta a Receber</option>
                  <option value="Pagar">Conta a Pagar</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Situação</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as FinanceEntry['status'] })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                >
                  <option value="Agendado">Agendado</option>
                  <option value="Liquidado">Liquidado</option>
                  <option value="Em Atraso">Em Atraso</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Descrição</label>
              <input
                type="text"
                required
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Contraparte</label>
              <input
                type="text"
                value={editForm.counterparty}
                onChange={(e) => setEditForm({ ...editForm, counterparty: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Categoria</label>
                <select
                  value={editForm.category}
                  onChange={(e) =>
                    setEditForm({ ...editForm, category: e.target.value as FinanceEntry['category'] })
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-xs text-ink"
                >
                  <option value="Assinaturas">Assinaturas</option>
                  <option value="Projetos">Projetos</option>
                  <option value="Infraestrutura Cloud">Infraestrutura Cloud</option>
                  <option value="Operação IA">Operação IA</option>
                  <option value="Folha & Parceiros">Folha & Parceiros</option>
                  <option value="Impostos">Impostos</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Valor (R$)</label>
                <input
                  type="number"
                  min={1}
                  value={editForm.amountBRL}
                  onChange={(e) => setEditForm({ ...editForm, amountBRL: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Data</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-xs text-ink font-mono"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="px-4 py-2 rounded-lg border border-line-strong text-xs font-medium text-ink-muted hover:text-ink cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="nc-primary-btn px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
              >
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        )}
      </SlideDrawer>

      {/* CREATE ENTRY DRAWER */}
      <SlideDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Novo Lançamento Financeiro"
        subtitle="Registre uma conta a receber ou pagar no fluxo de caixa"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as FinanceEntryType })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
              >
                <option value="Receber">Conta a Receber</option>
                <option value="Pagar">Conta a Pagar</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Situação</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as FinanceEntry['status'] })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
              >
                <option value="Agendado">Agendado</option>
                <option value="Liquidado">Liquidado</option>
                <option value="Em Atraso">Em Atraso</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Descrição</label>
            <input
              type="text"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex.: Renovação anual ou licença cloud"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Contraparte</label>
            <input
              type="text"
              value={form.counterparty}
              onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
              placeholder="Cliente ou fornecedor"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Categoria</label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as FinanceEntry['category'] })
                }
                className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-xs text-ink"
              >
                <option value="Assinaturas">Assinaturas</option>
                <option value="Projetos">Projetos</option>
                <option value="Infraestrutura Cloud">Infraestrutura Cloud</option>
                <option value="Operação IA">Operação IA</option>
                <option value="Folha & Parceiros">Folha & Parceiros</option>
                <option value="Impostos">Impostos</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Valor (R$)</label>
              <input
                type="number"
                min={1}
                value={form.amountBRL}
                onChange={(e) => setForm({ ...form, amountBRL: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Data</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-line-strong bg-canvas text-xs text-ink font-mono"
              />
            </div>
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
              Registrar lançamento
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
};
