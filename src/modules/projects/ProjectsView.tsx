import React, { useMemo, useState } from 'react';
import { ArrowRight, Calendar, CheckSquare, Edit3, FolderGit2, Plus, Square } from 'lucide-react';
import {
  PageHeader,
  SegmentedTabs,
  SlideDrawer,
  StatusText,
  UserAvatar,
} from '../../components/ui/Primitives';
import { formatBRL, formatDateBR, PlatformApi } from '../../services/api';
import type {
  ClientRecord,
  HermesProjectDto,
  ProjectRecord,
  ProjectStage,
} from '../../types/platform';

interface ProjectsViewProps {
  projects: ProjectRecord[];
  clients: ClientRecord[];
  hermesProjects?: HermesProjectDto[];
  onRefresh: () => Promise<void>;
  onToast: (msg: string) => void;
  createOpenExternal?: boolean;
  onCloseCreateExternal?: () => void;
}

const STAGES: ProjectStage[] = ['Descoberta', 'Em Execução', 'Revisão', 'Entregue'];

function nextProjectStage(stage: ProjectStage): ProjectStage | null {
  const idx = STAGES.indexOf(stage);
  return idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  clients,
  hermesProjects = [],
  onRefresh,
  onToast,
  createOpenExternal,
  onCloseCreateExternal,
}) => {
  const [viewMode, setViewMode] = useState<'cartoes' | 'kanban' | 'cronograma'>('cartoes');
  const [stageFilter, setStageFilter] = useState<'Todos' | ProjectStage>('Todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [internalCreateOpen, setInternalCreateOpen] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    ownerName: '',
    endDate: '',
    budgetBRL: '',
    spentBRL: '',
    stage: 'Descoberta' as ProjectStage,
    hermesProjectId: '',
  });

  const [newForm, setNewForm] = useState({
    name: '',
    clientId: clients[0]?.id || '',
    ownerName: 'Rafael Mendes',
    endDate: '2027-01-30',
    budgetBRL: '85000',
    stage: 'Descoberta' as ProjectStage,
    hermesProjectId: '',
  });

  const isCreateOpen = Boolean(createOpenExternal || internalCreateOpen);
  const closeCreate = () => {
    setInternalCreateOpen(false);
    onCloseCreateExternal?.();
  };

  const filteredProjects = useMemo(
    () => (stageFilter === 'Todos' ? projects : projects.filter((p) => p.stage === stageFilter)),
    [projects, stageFilter],
  );

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) || null,
    [projects, selectedId],
  );

  const openProjectDrawer = (proj: ProjectRecord, startEditing = false) => {
    setSelectedId(proj.id);
    setEditForm({
      name: proj.name,
      ownerName: proj.ownerName,
      endDate: proj.endDate,
      budgetBRL: String(proj.budgetBRL),
      spentBRL: String(proj.spentBRL),
      stage: proj.stage,
      hermesProjectId: proj.hermesProjectId || '',
    });
    setEditMode(startEditing);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !editForm.name.trim()) return;
    setSaving(true);
    try {
      const linkedPc = hermesProjects.find((p) => p.id === editForm.hermesProjectId);
      await PlatformApi.updateProject(selectedProject.id, {
        name: editForm.name.trim(),
        ownerName: editForm.ownerName.trim(),
        endDate: editForm.endDate,
        budgetBRL: Number(editForm.budgetBRL) || selectedProject.budgetBRL,
        spentBRL: Number(editForm.spentBRL) || 0,
        stage: editForm.stage,
        hermesProjectId: editForm.hermesProjectId || null,
      });
      setEditMode(false);
      await onRefresh();
      onToast('Alterações do projeto salvas com sucesso.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  const handleStageChange = async (projectId: string, stage: ProjectStage) => {
    setSaving(true);
    try {
      await PlatformApi.updateProject(projectId, { stage });
      await onRefresh();
      onToast(`Projeto movido para ${stage}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar estágio.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDeliverable = async (projectId: string, deliverableId: string, done: boolean) => {
    try {
      await PlatformApi.updateProject(projectId, { deliverableId, deliverableDone: done });
      await onRefresh();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar entrega.');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !noteInput.trim()) return;
    setSaving(true);
    try {
      await PlatformApi.updateProject(selectedProject.id, { activityNote: noteInput.trim() });
      setNoteInput('');
      await onRefresh();
      onToast('Registro adicionado ao histórico do projeto.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao registrar atividade.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.name.trim()) return;
    setSaving(true);
    try {
      await PlatformApi.createProject({
        name: newForm.name.trim(),
        clientId: newForm.clientId || clients[0]?.id || '',
        ownerName: newForm.ownerName,
        endDate: newForm.endDate,
        budgetBRL: Number(newForm.budgetBRL) || 65000,
        stage: newForm.stage,
      });
      setNewForm({ ...newForm, name: '' });
      closeCreate();
      await onRefresh();
      onToast('Projeto criado com sucesso.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao criar projeto.');
    } finally {
      setSaving(false);
    }
  };

  const getTimelineSpan = (start: string, end: string) => {
    const min = new Date('2026-08-01').getTime();
    const max = new Date('2027-02-15').getTime();
    const s = Math.max(min, new Date(start).getTime());
    const e = Math.min(max, new Date(end).getTime());
    const left = ((s - min) / (max - min)) * 100;
    const width = Math.max(10, ((e - s) / (max - min)) * 100);
    return { left: `${left}%`, width: `${Math.min(100 - left, width)}%` };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projetos & Entregas"
        subtitle="Acompanhamento de escopo, cronograma, entregas e marcos financeiros por cliente."
        actions={
          <>
            <SegmentedTabs
              active={viewMode}
              onChange={setViewMode}
              tabs={[
                { id: 'cartoes', label: 'Cartões', count: projects.length },
                { id: 'kanban', label: 'Kanban' },
                { id: 'cronograma', label: 'Cronograma' },
              ]}
            />
            <button
              type="button"
              onClick={() => setInternalCreateOpen(true)}
              className="nc-primary-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo projeto</span>
            </button>
          </>
        }
      />

      {viewMode === 'cartoes' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedTabs
            active={stageFilter}
            onChange={setStageFilter}
            tabs={[
              { id: 'Todos', label: 'Todos', count: projects.length },
              ...STAGES.map((st) => ({
                id: st,
                label: st,
                count: projects.filter((p) => p.stage === st).length,
              })),
            ]}
          />
          <span className="text-xs text-ink-subtle">
            Clique em um cartão para consultar entregas ou editar informações
          </span>
        </div>
      )}

      {viewMode === 'cartoes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map((proj) => {
            const nextStage = nextProjectStage(proj.stage);
            const doneCount = proj.deliverables.filter((d) => d.done).length;
            return (
              <div
                key={proj.id}
                role="button"
                tabIndex={0}
                onClick={() => openProjectDrawer(proj, false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openProjectDrawer(proj, false);
                  }
                }}
                className={`nc-card rounded-2xl p-5 text-left cursor-pointer flex flex-col justify-between gap-4 ${
                  selectedId === proj.id ? 'nc-card-active' : ''
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-accent dark:text-cyan-300">
                      {proj.code}
                    </span>
                    <StatusText
                      label={proj.stage}
                      tone={
                        proj.stage === 'Entregue'
                          ? 'nominal'
                          : proj.stage === 'Revisão'
                            ? 'attention'
                            : 'neutral'
                      }
                    />
                  </div>

                  <div>
                    <h3 className="font-display text-base font-semibold text-ink leading-snug">
                      {proj.name}
                    </h3>
                    <p className="text-xs text-ink-subtle mt-1 truncate">{proj.clientName}</p>
                    {(proj.hermesProjectId) && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent dark:text-cyan-300">
                        <FolderGit2 className="w-3 h-3" />
                        <span className="truncate">
                          Hermes: {proj.hermesProjectId}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-subtle">
                        Progresso ({doneCount}/{proj.deliverables.length} marcos)
                      </span>
                      <span className="font-mono font-semibold text-ink tabular-nums">
                        {proj.progress}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface-subtle overflow-hidden">
                      <div
                        className="h-full bg-accent dark:bg-cyan-400 rounded-full transition-all"
                        style={{ width: `${proj.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-line">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0 text-ink-muted">
                      <UserAvatar name={proj.ownerName} src={proj.ownerAvatar} />
                      <span className="truncate">{proj.ownerName}</span>
                    </div>
                    <span className="font-mono text-ink-subtle tabular-nums shrink-0">
                      Prazo {formatDateBR(proj.endDate)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="font-mono text-xs font-semibold text-ink tabular-nums">
                      {formatBRL(proj.budgetBRL)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openProjectDrawer(proj, true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line-strong bg-surface-subtle/60 hover:bg-surface-blue text-xs font-medium text-ink transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      {nextStage && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStageChange(proj.id, nextStage);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent-soft hover:bg-accent/20 text-xs font-semibold text-accent-ink dark:text-cyan-200 transition-colors cursor-pointer"
                          title={`Avançar para ${nextStage}`}
                        >
                          <span>{nextStage}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
          {STAGES.map((stage) => {
            const items = projects.filter((p) => p.stage === stage);
            return (
              <div key={stage} className="space-y-3">
                <div className="flex items-center justify-between px-1 pb-2 border-b border-line">
                  <span className="text-xs font-semibold text-ink">{stage}</span>
                  <span className="text-xs font-mono tabular-nums text-highlight font-semibold">
                    {items.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map((proj) => (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => openProjectDrawer(proj, false)}
                      className={`nc-card w-full text-left p-4 rounded-xl cursor-pointer space-y-3 ${
                        selectedId === proj.id ? 'nc-card-active' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-ink-subtle">
                        <span className="font-mono font-semibold text-accent dark:text-cyan-300">
                          {proj.code}
                        </span>
                        <span className="font-mono tabular-nums text-ink">{proj.progress}%</span>
                      </div>

                      <div>
                        <div className="text-sm font-semibold text-ink leading-snug">
                          {proj.name}
                        </div>
                        <div className="text-xs text-ink-subtle mt-1 truncate">
                          {proj.clientName}
                        </div>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-surface-subtle overflow-hidden">
                        <div
                          className="h-full bg-accent dark:bg-cyan-400 rounded-full transition-all"
                          style={{ width: `${proj.progress}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1 text-xs text-ink-muted">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar name={proj.ownerName} src={proj.ownerAvatar} />
                          <span className="truncate">{proj.ownerName}</span>
                        </div>
                        <span className="font-mono text-[11px] text-ink-subtle shrink-0">
                          {formatDateBR(proj.endDate)}
                        </span>
                      </div>
                    </button>
                  ))}
                  {items.length === 0 && (
                    <div className="p-4 rounded-xl border border-dashed border-line text-xs text-ink-subtle text-center">
                      Nenhum projeto neste estágio
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'cronograma' && (
        <section className="rounded-2xl nc-card overflow-hidden">
          <div className="grid grid-cols-12 px-6 py-3 border-b border-line bg-surface-subtle/40 text-[11px] font-semibold text-ink-subtle">
            <div className="col-span-4">Projeto / Cliente</div>
            <div className="col-span-8 grid grid-cols-6 text-center font-mono">
              <span>Ago/26</span>
              <span>Set/26</span>
              <span>Out/26</span>
              <span>Nov/26</span>
              <span>Dez/26</span>
              <span>Jan/27</span>
            </div>
          </div>

          <div className="divide-y divide-line">
            {projects.map((proj) => {
              const span = getTimelineSpan(proj.startDate, proj.endDate);
              return (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => openProjectDrawer(proj, false)}
                  className="w-full grid grid-cols-12 items-center px-6 py-4 text-left hover:bg-surface-blue/40 transition-colors cursor-pointer"
                >
                  <div className="col-span-12 sm:col-span-4 pr-4 min-w-0 mb-2 sm:mb-0">
                    <div className="text-sm font-medium text-ink truncate">
                      {proj.code} · {proj.name}
                    </div>
                    <div className="text-xs text-ink-subtle truncate">
                      {proj.clientName} · {proj.stage}
                    </div>
                  </div>

                  <div className="col-span-12 sm:col-span-8 relative h-7 bg-surface-subtle/70 rounded-lg overflow-hidden">
                    <div
                      className="absolute top-1 bottom-1 rounded-md bg-accent-soft border border-accent/50 flex items-center px-2.5 overflow-hidden"
                      style={{ left: span.left, width: span.width }}
                    >
                      <span className="text-[11px] font-mono font-semibold text-accent-ink dark:text-white truncate tabular-nums">
                        {proj.progress}% · {formatDateBR(proj.endDate)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <SlideDrawer
        open={Boolean(selectedProject)}
        onClose={() => {
          setSelectedId(null);
          setEditMode(false);
        }}
        subtitle={selectedProject ? `${selectedProject.code} · ${selectedProject.clientName}` : undefined}
        title={selectedProject?.name || ''}
      >
        {selectedProject && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-2">
              <StatusText
                label={selectedProject.stage}
                tone={
                  selectedProject.stage === 'Entregue'
                    ? 'nominal'
                    : selectedProject.stage === 'Revisão'
                      ? 'attention'
                      : 'neutral'
                }
              />
              <button
                type="button"
                onClick={() => setEditMode(!editMode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-subtle cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{editMode ? 'Cancelar edição' : 'Editar projeto'}</span>
              </button>
            </div>

            {editMode ? (
              <form onSubmit={handleSaveEdit} className="space-y-4 p-4 rounded-xl bg-surface-subtle/50 border border-line-strong">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Nome do projeto</label>
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
                    <label className="block text-xs font-medium text-ink-muted mb-1">Responsável</label>
                    <input
                      type="text"
                      value={editForm.ownerName}
                      onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Prazo final</label>
                    <input
                      type="date"
                      value={editForm.endDate}
                      onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Orçamento (R$)</label>
                    <input
                      type="number"
                      min={1000}
                      value={editForm.budgetBRL}
                      onChange={(e) => setEditForm({ ...editForm, budgetBRL: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">Realizado (R$)</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.spentBRL}
                      onChange={(e) => setEditForm({ ...editForm, spentBRL: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Estágio</label>
                  <select
                    value={editForm.stage}
                    onChange={(e) => setEditForm({ ...editForm, stage: e.target.value as ProjectStage })}
                    className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                  >
                    {STAGES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">
                    Vínculo com Projeto Operacional Hermes (opcional)
                  </label>
                  <select
                    value={editForm.hermesProjectId}
                    onChange={(e) => setEditForm({ ...editForm, hermesProjectId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                  >
                    <option value="">Sem vínculo operacional</option>
                    {hermesProjects.map((pp) => (
                      <option key={pp.id} value={pp.id}>
                        {pp.name} ({pp.status || 'Ativo'})
                      </option>
                    ))}
                    {editForm.hermesProjectId &&
                      !hermesProjects.some((pp) => pp.id === editForm.hermesProjectId) && (
                        <option value={editForm.hermesProjectId}>
                          {editForm.hermesProjectId}
                        </option>
                      )}
                  </select>
                  {hermesProjects.length === 0 && (
                    <p className="text-[11px] text-ink-subtle mt-1">
                      Projetos operacionais Hermes aparecerão aqui quando a instância estiver conectada.
                    </p>
                  )}
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
                <div className="space-y-2">
                  <label className="text-xs font-medium text-ink-subtle block">Estágio atual</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {STAGES.map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={saving}
                        onClick={() => handleStageChange(selectedProject.id, st)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          selectedProject.stage === st
                            ? 'nc-tab-active'
                            : 'bg-surface border-line text-ink-muted hover:text-ink'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-line text-sm">
                  <div>
                    <div className="text-xs text-ink-subtle">Responsável</div>
                    <div className="font-medium text-ink mt-0.5">{selectedProject.ownerName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-subtle">Previsão de entrega</div>
                    <div className="font-mono text-ink mt-0.5 inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-ink-subtle" />
                      <span>{formatDateBR(selectedProject.endDate)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-subtle">Orçamento aprovado</div>
                    <div className="font-mono tabular-nums text-ink mt-0.5">
                      {formatBRL(selectedProject.budgetBRL)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-subtle">Realizado até hoje</div>
                    <div className="font-mono tabular-nums text-highlight mt-0.5">
                      {formatBRL(selectedProject.spentBRL)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-ink-subtle">Projeto Operacional Hermes (vínculo opcional)</div>
                    <div className="text-xs font-medium text-ink mt-0.5">
                      {selectedProject.hermesProjectId || 'Nenhum vínculo operacional associado'}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Deliverables Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">Entregas & Marcos</h3>
                <span className="text-xs font-mono tabular-nums text-accent dark:text-cyan-300">
                  {selectedProject.progress}% concluído
                </span>
              </div>
              <div className="divide-y divide-line border border-line rounded-xl overflow-hidden">
                {selectedProject.deliverables.map((del) => (
                  <button
                    key={del.id}
                    type="button"
                    onClick={() => handleToggleDeliverable(selectedProject.id, del.id, !del.done)}
                    className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-surface-subtle/50 transition-colors cursor-pointer"
                  >
                    {del.done ? (
                      <CheckSquare className="w-4 h-4 text-accent dark:text-cyan-300 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-4 h-4 text-ink-subtle shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm ${del.done ? 'line-through text-ink-subtle' : 'text-ink font-medium'}`}>
                        {del.title}
                      </div>
                      <div className="text-xs text-ink-subtle mt-0.5">
                        {del.owner} · Prazo {formatDateBR(del.dueDate)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Activity History + Add Note */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Histórico de Atividades</h3>
              <form onSubmit={handleAddNote} className="flex gap-2">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Registrar atualização ou decisão..."
                  className="flex-1 px-3 py-2 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
                />
                <button
                  type="submit"
                  disabled={saving || !noteInput.trim()}
                  className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Registrar
                </button>
              </form>

              <div className="space-y-3 pt-2">
                {selectedProject.activities.map((act) => (
                  <div key={act.id} className="text-sm border-b border-line pb-3 last:border-none">
                    <div className="text-xs text-ink-subtle">
                      {act.author} · {act.date}
                    </div>
                    <p className="text-ink-muted mt-0.5">{act.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SlideDrawer>

      <SlideDrawer
        open={isCreateOpen}
        onClose={closeCreate}
        title="Novo Projeto Empresarial"
        subtitle="Defina cliente, responsável e orçamento inicial"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Nome do projeto</label>
            <input
              type="text"
              required
              value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              placeholder="Ex.: Integração Fiscal & Portal de Fornecedores"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Cliente</label>
            <select
              value={newForm.clientId}
              onChange={(e) => setNewForm({ ...newForm, clientId: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Responsável</label>
              <input
                type="text"
                value={newForm.ownerName}
                onChange={(e) => setNewForm({ ...newForm, ownerName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Orçamento (R$)</label>
              <input
                type="number"
                min={1000}
                value={newForm.budgetBRL}
                onChange={(e) => setNewForm({ ...newForm, budgetBRL: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Estágio inicial</label>
              <select
                value={newForm.stage}
                onChange={(e) => setNewForm({ ...newForm, stage: e.target.value as ProjectStage })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink"
              >
                {STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Previsão de término</label>
              <input
                type="date"
                value={newForm.endDate}
                onChange={(e) => setNewForm({ ...newForm, endDate: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-strong bg-canvas text-sm text-ink font-mono"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeCreate}
              className="px-4 py-2 rounded-lg border border-line-strong text-xs font-medium text-ink-muted hover:text-ink cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="nc-primary-btn px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
            >
              {saving ? 'Salvando...' : 'Criar projeto'}
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
};
