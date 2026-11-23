import React, { useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, Edit3 } from 'lucide-react';
import {
  PageHeader,
  SegmentedTabs,
  SlideDrawer,
  StatusText,
} from '../../components/ui/Primitives';
import { formatBRL, formatDateBR, PlatformApi } from '../../services/api';
import type { SubscriptionRecord, SubscriptionStatus } from '../../types/platform';

interface SubscriptionsViewProps {
  subscriptions: SubscriptionRecord[];
  onRefresh: () => Promise<void>;
  onToast: (msg: string) => void;
}

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  subscriptions,
  onRefresh,
  onToast,
}) => {
  const [viewMode, setViewMode] = useState<'cartoes' | 'tabela'>('cartoes');
  const [filter, setFilter] = useState<'Todas' | SubscriptionStatus>('Todas');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    planName: '',
    cycle: 'Mensal' as 'Mensal' | 'Anual',
    mrrBRL: '',
    nextBillingDate: '',
  });

  const metrics = useMemo(() => {
    const activeMrr = subscriptions
      .filter((s) => s.status === 'Ativa' || s.status === 'Em Teste')
      .reduce((acc, s) => acc + s.mrrBRL, 0);
    const overdue = subscriptions.filter((s) => s.status === 'Inadimplente');
    const canceled = subscriptions.filter((s) => s.status === 'Cancelada').length;
    return {
      mrr: activeMrr,
      arr: activeMrr * 12,
      overdueTotal: overdue.reduce((acc, s) => acc + s.mrrBRL, 0),
      overdueCount: overdue.length,
      canceled,
    };
  }, [subscriptions]);

  const filtered = useMemo(() => {
    if (filter === 'Todas') return subscriptions;
    return subscriptions.filter((s) => s.status === filter);
  }, [subscriptions, filter]);

  const selected = useMemo(
    () => subscriptions.find((s) => s.id === selectedId) || null,
    [subscriptions, selectedId],
  );

  const openSubDrawer = (sub: SubscriptionRecord, startEditing = false) => {
    setSelectedId(sub.id);
    setEditForm({
      planName: sub.planName,
      cycle: sub.cycle,
      mrrBRL: String(sub.mrrBRL),
      nextBillingDate: sub.nextBillingDate,
    });
    setEditMode(startEditing);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !editForm.planName.trim()) return;
    setSaving(true);
    try {
      await PlatformApi.updateSubscription(selected.id, {
        planName: editForm.planName.trim(),
        cycle: editForm.cycle,
        mrrBRL: Number(editForm.mrrBRL) || 0,
        nextBillingDate: editForm.nextBillingDate,
      });
      setEditMode(false);
      await onRefresh();
      onToast('Assinatura atualizada com sucesso.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao editar assinatura.');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (id: string, action: 'mark_paid' | 'cancel' | 'reactivate') => {
    setSaving(true);
    try {
      await PlatformApi.updateSubscription(id, action);
      await onRefresh();
      onToast(
        action === 'mark_paid'
          ? 'Pagamento liquidado e assinatura regularizada.'
          : action === 'cancel'
            ? 'Assinatura cancelada.'
            : 'Assinatura reativada.',
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar assinatura.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assinaturas & Recorrência"
        subtitle="Acompanhamento de planos ativos, renovação, inadimplência e edição de contratos recorrentes."
        actions={
          <SegmentedTabs
            active={viewMode}
            onChange={setViewMode}
            tabs={[
              { id: 'cartoes', label: 'Cartões', count: filtered.length },
              { id: 'tabela', label: 'Tabela' },
            ]}
          />
        }
      />

      {/* Recurrence Summary Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="nc-card rounded-2xl p-5">
          <div className="text-xs text-ink-subtle">MRR Adimplente</div>
          <div className="mt-1.5 font-display text-2xl font-semibold font-mono tabular-nums text-ink">
            {formatBRL(metrics.mrr)}
          </div>
          <div className="text-xs text-ink-muted mt-1">Receita mensal ativa</div>
        </div>
        <div className="nc-card rounded-2xl p-5">
          <div className="text-xs text-ink-subtle">ARR Projetado</div>
          <div className="mt-1.5 font-display text-2xl font-semibold font-mono tabular-nums text-accent dark:text-cyan-300">
            {formatBRL(metrics.arr)}
          </div>
          <div className="text-xs text-ink-muted mt-1">Anualização da base</div>
        </div>
        <div className="nc-card rounded-2xl p-5">
          <div className="text-xs text-ink-subtle">Em Inadimplência</div>
          <div className="mt-1.5 font-display text-2xl font-semibold font-mono tabular-nums text-highlight">
            {formatBRL(metrics.overdueTotal)}
          </div>
          <div className="text-xs text-ink-muted mt-1 tabular-nums">
            {metrics.overdueCount} assinatura(s) em atraso
          </div>
        </div>
        <div className="nc-card rounded-2xl p-5">
          <div className="text-xs text-ink-subtle">Cancelamentos</div>
          <div className="mt-1.5 font-display text-2xl font-semibold font-mono tabular-nums text-ink">
            {metrics.canceled}
          </div>
          <div className="text-xs text-ink-muted mt-1">No período vigente</div>
        </div>
      </section>

      <SegmentedTabs
        active={filter}
        onChange={setFilter}
        tabs={[
          { id: 'Todas', label: 'Todas', count: subscriptions.length },
          { id: 'Ativa', label: 'Ativas' },
          { id: 'Inadimplente', label: 'Inadimplentes' },
          { id: 'Em Teste', label: 'Em Teste' },
          { id: 'Cancelada', label: 'Canceladas' },
        ]}
      />

      {viewMode === 'cartoes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((sub) => (
            <div
              key={sub.id}
              role="button"
              tabIndex={0}
              onClick={() => openSubDrawer(sub, false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openSubDrawer(sub, false);
                }
              }}
              className={`nc-card rounded-2xl p-5 text-left cursor-pointer flex flex-col justify-between gap-4 ${
                selectedId === sub.id ? 'nc-card-active' : ''
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-subtle">
                    <CreditCard className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
                    Ciclo {sub.cycle}
                  </span>
                  <StatusText
                    label={
                      sub.status === 'Inadimplente'
                        ? `Inadimplente (${sub.overdueDays}d)`
                        : sub.status
                    }
                    tone={
                      sub.status === 'Ativa'
                        ? 'nominal'
                        : sub.status === 'Inadimplente'
                          ? 'critical'
                          : sub.status === 'Em Teste'
                            ? 'attention'
                            : 'neutral'
                    }
                  />
                </div>

                <div>
                  <h3 className="font-display text-base font-semibold text-ink leading-snug">
                    {sub.clientName}
                  </h3>
                  <p className="text-xs text-ink-muted mt-1">{sub.planName}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 py-2.5 px-3 rounded-xl bg-surface-subtle/60 border border-line text-xs">
                  <div>
                    <div className="text-ink-subtle">Valor MRR</div>
                    <div className="font-mono text-sm font-semibold text-ink tabular-nums mt-0.5">
                      {formatBRL(sub.mrrBRL)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-ink-subtle">Próx. Cobrança</div>
                    <div className="font-mono text-ink-muted tabular-nums mt-0.5">
                      {formatDateBR(sub.nextBillingDate)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                <span className="text-xs text-ink-subtle">
                  {sub.payments.length} cobrança(s) registrada(s)
                </span>
                <div className="flex items-center gap-2">
                  {sub.status === 'Inadimplente' && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(sub.id, 'mark_paid');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-xs font-semibold text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Quitar</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openSubDrawer(sub, true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line-strong bg-surface-subtle/60 hover:bg-surface-blue text-xs font-medium text-ink transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Editar</span>
                  </button>
                </div>
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
                  <th className="py-3 px-6">Assinante</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4">Ciclo</th>
                  <th className="py-3 px-4">Próxima Cobrança</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-6 text-right">MRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {filtered.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => openSubDrawer(sub, false)}
                    className="hover:bg-surface-blue/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-6 font-medium text-ink">{sub.clientName}</td>
                    <td className="py-3.5 px-4 text-ink-muted">{sub.planName}</td>
                    <td className="py-3.5 px-4 text-xs text-ink-subtle">{sub.cycle}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-ink-muted whitespace-nowrap">
                      {formatDateBR(sub.nextBillingDate)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusText
                        label={
                          sub.status === 'Inadimplente'
                            ? `Inadimplente (${sub.overdueDays}d)`
                            : sub.status
                        }
                        tone={
                          sub.status === 'Ativa'
                            ? 'nominal'
                            : sub.status === 'Inadimplente'
                              ? 'critical'
                              : sub.status === 'Em Teste'
                                ? 'attention'
                                : 'neutral'
                        }
                      />
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-xs font-semibold tabular-nums">
                      {formatBRL(sub.mrrBRL)}
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
        subtitle={selected ? `${selected.planName} · Ciclo ${selected.cycle}` : undefined}
        title={selected?.clientName || ''}
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-2">
              <StatusText
                label={selected.status}
                tone={
                  selected.status === 'Ativa'
                    ? 'nominal'
                    : selected.status === 'Inadimplente'
                      ? 'critical'
                      : 'attention'
                }
              />
              <button
                type="button"
                onClick={() => setEditMode(!editMode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-subtle cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{editMode ? 'Cancelar edição' : 'Editar assinatura'}</span>
              </button>
            </div>

            {editMode ? (
              <form onSubmit={handleSaveEdit} className="space-y-4 p-4 rounded-xl bg-surface-subtle/50 border border-line-strong">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Nome do plano</label>
                  <input
                    type="text"
                    required
                    value={editForm.planName}
                    onChange={(e) => setEditForm({ ...editForm, planName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Ciclo</label>
                    <select
                      value={editForm.cycle}
                      onChange={(e) => setEditForm({ ...editForm, cycle: e.target.value as 'Mensal' | 'Anual' })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                    >
                      <option value="Mensal">Mensal</option>
                      <option value="Anual">Anual</option>
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
                    <label className="block text-xs font-medium text-ink-muted mb-1">Próx. cobrança</label>
                    <input
                      type="date"
                      value={editForm.nextBillingDate}
                      onChange={(e) => setEditForm({ ...editForm, nextBillingDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
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
                    {saving ? 'Salvando...' : 'Salvar assinatura'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between py-4 border-y border-line">
                <div>
                  <div className="text-xs text-ink-subtle">Valor mensal recorrente</div>
                  <div className="font-mono text-xl font-semibold tabular-nums mt-0.5 text-ink">
                    {formatBRL(selected.mrrBRL)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-ink-subtle">Próximo faturamento</div>
                  <div className="font-mono text-sm text-ink mt-0.5">
                    {formatDateBR(selected.nextBillingDate)}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2.5">
              {selected.status === 'Inadimplente' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleAction(selected.id, 'mark_paid')}
                  className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Confirmar pagamento recebido
                </button>
              )}
              {selected.status !== 'Cancelada' ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleAction(selected.id, 'cancel')}
                  className="px-4 py-2 rounded-lg border border-line-strong text-xs font-medium text-red-700 dark:text-red-400 hover:bg-surface-subtle cursor-pointer"
                >
                  Cancelar assinatura
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleAction(selected.id, 'reactivate')}
                  className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Reativar assinatura
                </button>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Histórico de Cobranças</h3>
              <div className="divide-y divide-line border border-line rounded-xl">
                {selected.payments.map((pay) => (
                  <div key={pay.id} className="px-4 py-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-mono text-xs text-ink">{formatDateBR(pay.date)}</div>
                      <div className="text-xs text-ink-subtle">{pay.method}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs font-semibold tabular-nums">
                        {formatBRL(pay.amountBRL)}
                      </div>
                      <StatusText
                        label={pay.status}
                        tone={
                          pay.status === 'Pago'
                            ? 'nominal'
                            : pay.status === 'Falhou'
                              ? 'critical'
                              : 'attention'
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SlideDrawer>
    </div>
  );
};
