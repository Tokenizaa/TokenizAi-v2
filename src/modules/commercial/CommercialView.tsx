import React, { useMemo, useState } from 'react';
import { ArrowRight, Edit3, Plus } from 'lucide-react';
import {
  PageHeader,
  SegmentedTabs,
  SlideDrawer,
  StatusText,
} from '../../components/ui/Primitives';
import { formatBRL, formatDateBR, PlatformApi } from '../../services/api';
import type { ClientRecord, DealRecord, DealStage } from '../../types/platform';

interface CommercialViewProps {
  deals: DealRecord[];
  clients: ClientRecord[];
  onRefresh: () => Promise<void>;
  onToast: (msg: string) => void;
}

const PIPELINE_STAGES: DealStage[] = [
  'Prospecção',
  'Qualificação',
  'Proposta',
  'Negociação',
  'Ganho',
];

function nextDealStage(stage: DealStage): DealStage | null {
  const idx = PIPELINE_STAGES.indexOf(stage);
  return idx >= 0 && idx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[idx + 1] : null;
}

export const CommercialView: React.FC<CommercialViewProps> = ({
  deals,
  clients,
  onRefresh,
  onToast,
}) => {
  const [viewMode, setViewMode] = useState<'cartoes' | 'pipeline' | 'lista'>('cartoes');
  const [stageFilter, setStageFilter] = useState<'Todos' | DealStage>('Todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    title: '',
    valueBRL: '',
    stage: 'Prospecção' as DealStage,
    expectedClose: '',
    ownerName: '',
    nextStep: '',
  });

  const [newDeal, setNewDeal] = useState({
    title: '',
    clientId: clients[0]?.id || '',
    valueBRL: '55000',
    stage: 'Prospecção' as DealStage,
    nextStep: '',
  });

  const filteredDeals = useMemo(
    () => (stageFilter === 'Todos' ? deals : deals.filter((d) => d.stage === stageFilter)),
    [deals, stageFilter],
  );

  const selectedDeal = useMemo(
    () => deals.find((d) => d.id === selectedId) || null,
    [deals, selectedId],
  );

  const totals = useMemo(() => {
    const active = deals.filter((d) => d.stage !== 'Ganho' && d.stage !== 'Perdido');
    const totalNominal = active.reduce((acc, d) => acc + d.valueBRL, 0);
    const weighted = active.reduce((acc, d) => acc + (d.valueBRL * d.probability) / 100, 0);
    const won = deals.filter((d) => d.stage === 'Ganho').reduce((acc, d) => acc + d.valueBRL, 0);
    return { totalNominal, weighted, won };
  }, [deals]);

  const openDealDrawer = (deal: DealRecord, startEditing = false) => {
    setSelectedId(deal.id);
    setEditForm({
      title: deal.title,
      valueBRL: String(deal.valueBRL),
      stage: deal.stage,
      expectedClose: deal.expectedClose,
      ownerName: deal.ownerName,
      nextStep: deal.nextStep,
    });
    setEditMode(startEditing);
  };

  const handleSaveDealEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeal || !editForm.title.trim()) return;
    setSaving(true);
    try {
      await PlatformApi.updateDeal(selectedDeal.id, {
        title: editForm.title.trim(),
        valueBRL: Number(editForm.valueBRL) || selectedDeal.valueBRL,
        stage: editForm.stage,
        expectedClose: editForm.expectedClose,
        ownerName: editForm.ownerName.trim(),
        nextStep: editForm.nextStep.trim(),
      });
      setEditMode(false);
      await onRefresh();
      onToast('Negociação atualizada com sucesso.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar negociação.');
    } finally {
      setSaving(false);
    }
  };

  const handleStageUpdate = async (dealId: string, stage: DealStage) => {
    setSaving(true);
    try {
      await PlatformApi.updateDeal(dealId, { stage });
      await onRefresh();
      onToast(`Oportunidade atualizada para ${stage}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar oportunidade.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeal || !noteInput.trim()) return;
    setSaving(true);
    try {
      await PlatformApi.updateDeal(selectedDeal.id, { note: noteInput.trim() });
      setNoteInput('');
      await onRefresh();
      onToast('Anotação registrada na negociação.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao salvar anotação.');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToProject = async (deal: DealRecord) => {
    setSaving(true);
    try {
      await PlatformApi.createProject({
        name: deal.title,
        clientId: deal.clientId,
        ownerName: deal.ownerName,
        endDate: '2027-02-28',
        budgetBRL: deal.valueBRL,
        stage: 'Descoberta',
      });
      await onRefresh();
      onToast(`Projeto criado automaticamente a partir de "${deal.title}".`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao converter em projeto.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeal.title.trim()) return;
    setSaving(true);
    try {
      await PlatformApi.createDeal({
        title: newDeal.title.trim(),
        clientId: newDeal.clientId || clients[0]?.id || '',
        valueBRL: Number(newDeal.valueBRL) || 35000,
        stage: newDeal.stage,
        nextStep: newDeal.nextStep.trim() || 'Qualificar escopo com cliente',
      });
      setNewDeal({ ...newDeal, title: '', nextStep: '' });
      setCreateOpen(false);
      await onRefresh();
      onToast('Oportunidade adicionada ao pipeline.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao criar oportunidade.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comercial & Vendas"
        subtitle={`Pipeline aberto: ${formatBRL(totals.totalNominal)} · Previsão ponderada: ${formatBRL(totals.weighted)} · Ganho no ciclo: ${formatBRL(totals.won)}`}
        actions={
          <>
            <SegmentedTabs
              active={viewMode}
              onChange={setViewMode}
              tabs={[
                { id: 'cartoes', label: 'Cartões', count: deals.length },
                { id: 'pipeline', label: 'Pipeline' },
                { id: 'lista', label: 'Lista' },
              ]}
            />
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="nc-primary-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova oportunidade</span>
            </button>
          </>
        }
      />

      {viewMode === 'cartoes' && (
        <div className="space-y-4">
          <SegmentedTabs
            active={stageFilter}
            onChange={setStageFilter}
            tabs={[
              { id: 'Todos', label: 'Todas as etapas', count: deals.length },
              ...PIPELINE_STAGES.map((st) => ({
                id: st,
                label: st,
                count: deals.filter((d) => d.stage === st).length,
              })),
            ]}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredDeals.map((deal) => {
              const nextSt = nextDealStage(deal.stage);
              return (
                <div
                  key={deal.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDealDrawer(deal, false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openDealDrawer(deal, false);
                    }
                  }}
                  className={`nc-card rounded-2xl p-5 text-left cursor-pointer flex flex-col justify-between gap-4 ${
                    selectedId === deal.id ? 'nc-card-active' : ''
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <StatusText
                        label={deal.stage}
                        tone={deal.stage === 'Ganho' ? 'nominal' : deal.stage === 'Negociação' ? 'attention' : 'neutral'}
                      />
                      <span className="font-mono text-xs font-semibold text-highlight tabular-nums">
                        {deal.probability}% prob.
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display text-base font-semibold text-ink leading-snug">
                        {deal.title}
                      </h3>
                      <p className="text-xs text-ink-subtle mt-1 truncate">{deal.clientName}</p>
                    </div>

                    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-surface-subtle/60 border border-line text-xs">
                      <div>
                        <div className="text-ink-subtle">Valor</div>
                        <div className="font-mono text-sm font-semibold text-ink tabular-nums">
                          {formatBRL(deal.valueBRL)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-ink-subtle">Previsão</div>
                        <div className="font-mono text-ink-muted tabular-nums">
                          {formatDateBR(deal.expectedClose)}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-ink-muted truncate">
                      Próximo passo: <span className="text-ink">{deal.nextStep}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                    <span className="text-xs text-ink-subtle truncate">{deal.ownerName}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDealDrawer(deal, true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line-strong bg-surface-subtle/60 hover:bg-surface-blue text-xs font-medium text-ink transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      {nextSt && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStageUpdate(deal.id, nextSt);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent-soft hover:bg-accent/20 text-xs font-semibold text-accent-ink dark:text-cyan-200 transition-colors cursor-pointer"
                          title={`Avançar para ${nextSt}`}
                        >
                          <span>{nextSt}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'pipeline' && (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
          {PIPELINE_STAGES.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage);
            const stageSum = stageDeals.reduce((acc, d) => acc + d.valueBRL, 0);
            return (
              <div key={stage} className="space-y-3">
                <div className="px-1 pb-2 border-b border-line">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink">
                    <span>{stage}</span>
                    <span className="font-mono text-highlight tabular-nums">{stageDeals.length}</span>
                  </div>
                  <div className="text-[11px] font-mono text-ink-subtle tabular-nums mt-0.5">
                    {formatBRL(stageSum)}
                  </div>
                </div>

                <div className="space-y-3">
                  {stageDeals.map((deal) => (
                    <button
                      key={deal.id}
                      type="button"
                      onClick={() => openDealDrawer(deal, false)}
                      className={`nc-card w-full text-left p-4 rounded-xl cursor-pointer space-y-2.5 ${
                        selectedId === deal.id ? 'nc-card-active' : ''
                      }`}
                    >
                      <div className="text-sm font-semibold text-ink leading-snug">{deal.title}</div>
                      <div className="text-xs text-ink-subtle truncate">{deal.clientName}</div>
                      <div className="flex items-center justify-between pt-2 border-t border-line text-xs">
                        <span className="font-mono font-semibold text-ink tabular-nums">
                          {formatBRL(deal.valueBRL)}
                        </span>
                        <span className="font-mono text-highlight tabular-nums">
                          {deal.probability}%
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-muted truncate">{deal.nextStep}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'lista' && (
        <section className="rounded-2xl nc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-[11px] font-semibold text-ink-subtle bg-surface-subtle/40">
                  <th className="py-3 px-6">Oportunidade</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Etapa</th>
                  <th className="py-3 px-4">Próximo Passo</th>
                  <th className="py-3 px-4 text-right">Prob.</th>
                  <th className="py-3 px-6 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {deals.map((deal) => (
                  <tr
                    key={deal.id}
                    onClick={() => openDealDrawer(deal, false)}
                    className="hover:bg-surface-blue/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-6 font-medium text-ink">{deal.title}</td>
                    <td className="py-3.5 px-4 text-xs text-ink-muted">{deal.clientName}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusText
                        label={deal.stage}
                        tone={deal.stage === 'Ganho' ? 'nominal' : deal.stage === 'Negociação' ? 'attention' : 'neutral'}
                      />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-ink-subtle">{deal.nextStep}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums">
                      {deal.probability}%
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-xs font-semibold tabular-nums">
                      {formatBRL(deal.valueBRL)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* DEAL DRAWER */}
      <SlideDrawer
        open={Boolean(selectedDeal)}
        onClose={() => {
          setSelectedId(null);
          setEditMode(false);
        }}
        subtitle={selectedDeal?.clientName}
        title={selectedDeal?.title || ''}
      >
        {selectedDeal && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-2">
              <StatusText
                label={`${selectedDeal.stage} · ${selectedDeal.probability}%`}
                tone={selectedDeal.stage === 'Ganho' ? 'nominal' : selectedDeal.stage === 'Negociação' ? 'attention' : 'neutral'}
              />
              <button
                type="button"
                onClick={() => setEditMode(!editMode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-subtle cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{editMode ? 'Cancelar edição' : 'Editar negociação'}</span>
              </button>
            </div>

            {editMode ? (
              <form onSubmit={handleSaveDealEdit} className="space-y-4 p-4 rounded-xl bg-surface-subtle/50 border border-line-strong">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Título da oportunidade</label>
                  <input
                    type="text"
                    required
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Valor estimado (R$)</label>
                    <input
                      type="number"
                      min={1000}
                      value={editForm.valueBRL}
                      onChange={(e) => setEditForm({ ...editForm, valueBRL: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Previsão fechamento</label>
                    <input
                      type="date"
                      value={editForm.expectedClose}
                      onChange={(e) => setEditForm({ ...editForm, expectedClose: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Etapa</label>
                    <select
                      value={editForm.stage}
                      onChange={(e) => setEditForm({ ...editForm, stage: e.target.value as DealStage })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                    >
                      {(['Prospecção', 'Qualificação', 'Proposta', 'Negociação', 'Ganho', 'Perdido'] as DealStage[]).map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Responsável</label>
                    <input
                      type="text"
                      value={editForm.ownerName}
                      onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Próximo passo</label>
                  <input
                    type="text"
                    value={editForm.nextStep}
                    onChange={(e) => setEditForm({ ...editForm, nextStep: e.target.value })}
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
                    {saving ? 'Salvando...' : 'Salvar negociação'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-ink-subtle block">Movimentar etapa do funil</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(['Prospecção', 'Qualificação', 'Proposta', 'Negociação', 'Ganho', 'Perdido'] as DealStage[]).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={saving}
                          onClick={() => handleStageUpdate(selectedDeal.id, st)}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                            selectedDeal.stage === st
                              ? 'nc-tab-active'
                              : 'bg-surface border-line text-ink-muted hover:text-ink'
                          }`}
                        >
                          {st}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-line text-sm">
                  <div>
                    <div className="text-xs text-ink-subtle">Valor da proposta</div>
                    <div className="font-mono text-lg font-semibold tabular-nums mt-0.5 text-ink">
                      {formatBRL(selectedDeal.valueBRL)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-subtle">Previsão de fechamento</div>
                    <div className="font-mono text-ink mt-1">{formatDateBR(selectedDeal.expectedClose)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-subtle">Responsável</div>
                    <div className="text-ink font-medium mt-0.5">{selectedDeal.ownerName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-subtle">Próximo passo</div>
                    <div className="text-ink-muted mt-0.5">{selectedDeal.nextStep}</div>
                  </div>
                </div>
              </>
            )}

            {selectedDeal.stage === 'Ganho' && (
              <div className="p-4 rounded-xl bg-surface-blue/70 border border-line-strong flex items-center justify-between gap-3">
                <div className="text-xs text-ink-muted">
                  Contrato ganho. Converta esta oportunidade em um projeto ativo de entrega.
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleConvertToProject(selectedDeal)}
                  className="nc-primary-btn px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Converter em projeto
                </button>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Notas de Negociação</h3>
              <form onSubmit={handleAddNote} className="flex gap-2">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Adicionar atualização comercial..."
                  className="flex-1 px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                />
                <button
                  type="submit"
                  disabled={saving || !noteInput.trim()}
                  className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Salvar
                </button>
              </form>
              <ul className="space-y-2.5 pt-2">
                {selectedDeal.notes.map((n, idx) => (
                  <li key={idx} className="text-sm text-ink-muted pb-2.5 border-b border-line last:border-none">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </SlideDrawer>

      {/* CREATE DEAL DRAWER */}
      <SlideDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nova Oportunidade Comercial"
        subtitle="Registre uma negociação no funil de vendas"
      >
        <form onSubmit={handleCreateDeal} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Título da oportunidade</label>
            <input
              type="text"
              required
              value={newDeal.title}
              onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
              placeholder="Ex.: Automação de Atendimento & SLA"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Cliente</label>
            <select
              value={newDeal.clientId}
              onChange={(e) => setNewDeal({ ...newDeal, clientId: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Valor estimado (R$)</label>
              <input
                type="number"
                min={1000}
                value={newDeal.valueBRL}
                onChange={(e) => setNewDeal({ ...newDeal, valueBRL: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Etapa</label>
              <select
                value={newDeal.stage}
                onChange={(e) => setNewDeal({ ...newDeal, stage: e.target.value as DealStage })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
              >
                {PIPELINE_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Próximo passo</label>
            <input
              type="text"
              value={newDeal.nextStep}
              onChange={(e) => setNewDeal({ ...newDeal, nextStep: e.target.value })}
              placeholder="Ex.: Enviar proposta técnica até sexta-feira"
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
              Criar oportunidade
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
};
