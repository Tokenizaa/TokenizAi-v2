import React, { useMemo, useState } from 'react';
import { AlertCircle, BookOpen, Plus, Search } from 'lucide-react';
import {
  PageHeader,
  SegmentedTabs,
  SlideDrawer,
  StatusText,
} from '../../components/ui/Primitives';
import { AGENCY_SPECIALISTS, SPECIALIST_DIVISIONS } from '../../data/agencyCatalog';
import { PaperclipApi } from '../../services/api';
import type {
  AgencySpecialist,
  HermesOverviewBundle,
  SpecialistDivision,
} from '../../types/platform';

interface AgencyLibraryViewProps {
  hermes: HermesOverviewBundle;
  onRefresh: () => Promise<void>;
  onToast: (msg: string) => void;
}

export const AgencyLibraryView: React.FC<AgencyLibraryViewProps> = ({
  hermes,
  onRefresh,
  onToast,
}) => {
  const [viewMode, setViewMode] = useState<'cartoes' | 'tabela'>('cartoes');
  const [search, setSearch] = useState('');
  const [division, setDivision] = useState<'Todas' | SpecialistDivision>('Todas');
  const [allocationFilter, setAllocationFilter] = useState<'todos' | 'alocados'>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hiring, setHiring] = useState(false);

  const isConnected = hermes.status.configured && hermes.status.connected;

  const canManageAgents = useMemo(() => {
    const cap = hermes.status.availableCapabilities.find((c) => c.key === 'agents:manage');
    return isConnected && cap?.available !== false;
  }, [isConnected, hermes.status.availableCapabilities]);

  const allocatedIds = useMemo(() => {
    const set = new Set<string>();
    for (const ag of hermes.bots) {
      set.add(ag.name.toLowerCase());
      if (ag.title) set.add(ag.title.toLowerCase());
    }
    return set;
  }, [hermes.bots]);

  const isAllocated = (sp: AgencySpecialist) =>
    isConnected &&
    (allocatedIds.has(sp.id) ||
      allocatedIds.has(sp.slug.toLowerCase()) ||
      allocatedIds.has(sp.name.toLowerCase()));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AGENCY_SPECIALISTS.filter((sp) => {
      if (division !== 'Todas' && sp.division !== division) return false;
      if (allocationFilter === 'alocados' && !isAllocated(sp)) return false;
      if (!q) return true;
      return (
        sp.name.toLowerCase().includes(q) ||
        sp.division.toLowerCase().includes(q) ||
        sp.competencies.some((c) => c.toLowerCase().includes(q)) ||
        sp.skills.some((s) => s.toLowerCase().includes(q)) ||
        sp.tools.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [search, division, allocationFilter, allocatedIds, isConnected]);

  const selected = useMemo(
    () => AGENCY_SPECIALISTS.find((s) => s.id === selectedId) || null,
    [selectedId],
  );

  const handleAllocate = async (sp: AgencySpecialist) => {
    if (!canManageAgents) {
      onToast(`Alocação bloqueada: Paperclip em estado "${hermes.status.connectionLabel}".`);
      return;
    }
    setHiring(true);
    try {
      await PaperclipApi.hireSpecialist({
        specialistId: sp.id,
        slug: sp.slug,
        name: sp.name,
        division: sp.division,
        adapter: sp.recommendedAdapter,
        monthlyBudgetBRL: 1200,
        team: sp.division,
      });
      await onRefresh();
      onToast(`Especialista "${sp.name}" criado no Paperclip.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Não foi possível alocar especialista.');
    } finally {
      setHiring(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Biblioteca de Especialistas Agency Agents"
        subtitle="Catálogo consultivo de perfis, competências, ferramentas e runbooks separado dos agentes ativos do Paperclip."
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

      {!isConnected && (
        <div className="rounded-2xl nc-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-amber-500/30">
          <div className="flex items-start gap-2.5 text-xs text-ink-muted">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-ink">
                Paperclip: {hermes.status.connectionLabel}.
              </span>{' '}
              A biblioteca Agency Agents permanece acessível para consulta de perfis e runbooks. A alocação para o runtime operacional exige conexão ativa com o Paperclip.
            </div>
          </div>
          <StatusText label={hermes.status.connectionLabel} tone="attention" />
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-ink-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por especialidade, competência, skill ou ferramenta..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-line-strong bg-surface text-sm text-ink"
            />
          </div>

          <select
            value={division}
            onChange={(e) => setDivision(e.target.value as 'Todas' | SpecialistDivision)}
            aria-label="Filtrar por especialidade"
            className="px-3.5 py-2 rounded-xl border border-line-strong bg-surface text-xs font-medium text-ink"
          >
            <option value="Todas">Todas as divisões (283 perfis indexados)</option>
            {SPECIALIST_DIVISIONS.map((d) => (
              <option key={d.division} value={d.division}>
                {d.division} ({d.totalInCatalog})
              </option>
            ))}
          </select>
        </div>

        <SegmentedTabs
          active={allocationFilter}
          onChange={setAllocationFilter}
          tabs={[
            { id: 'todos', label: 'Catálogo', count: filtered.length },
            {
              id: 'alocados',
              label: 'Já alocados no Paperclip',
              count: isConnected ? AGENCY_SPECIALISTS.filter((s) => isAllocated(s)).length : 0,
            },
          ]}
        />
      </div>

      {viewMode === 'cartoes' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((sp) => {
            const allocated = isAllocated(sp);
            return (
              <div
                key={sp.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(sp.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedId(sp.id);
                  }
                }}
                className={`nc-card rounded-2xl p-5 text-left cursor-pointer flex flex-col justify-between gap-4 ${
                  selectedId === sp.id ? 'nc-card-active' : ''
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-accent dark:text-cyan-300">
                      <BookOpen className="w-3.5 h-3.5" />
                      {sp.code}
                    </span>
                    <StatusText
                      label={allocated ? 'Alocado no Paperclip' : 'Catálogo'}
                      tone={allocated ? 'nominal' : 'neutral'}
                    />
                  </div>

                  <div>
                    <h3 className="font-display text-base font-semibold text-ink leading-snug">
                      {sp.name}
                    </h3>
                    <div className="text-xs text-highlight font-medium mt-0.5">
                      {sp.division} · {sp.archetype}
                    </div>
                  </div>

                  <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                    {sp.summary}
                  </p>

                  <div className="p-2.5 rounded-xl bg-surface-subtle/55 border border-line text-[11px] text-ink-muted space-y-1">
                    <div className="font-semibold text-ink">Competências-chave</div>
                    <div className="truncate">{sp.competencies.slice(0, 3).join(' · ')}</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-ink-subtle">
                    Adapter: {sp.recommendedAdapter}
                  </span>
                  {!allocated ? (
                    <button
                      type="button"
                      disabled={hiring || !canManageAgents}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAllocate(sp);
                      }}
                      title={
                        canManageAgents
                          ? 'Criar agente no Paperclip a partir deste blueprint'
                          : `Requer conexão ativa com o Paperclip (${hermes.status.connectionLabel})`
                      }
                      className="nc-primary-btn inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{canManageAgents ? 'Alocar' : 'Offline'}</span>
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Ativo no runtime
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-2xl nc-card p-10 text-center text-sm text-ink-subtle">
              Nenhum especialista encontrado para os critérios aplicados.
            </div>
          )}
        </div>
      ) : (
        <section className="rounded-2xl nc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-[11px] font-semibold text-ink-subtle bg-surface-subtle/40">
                  <th className="py-3 px-6">Código</th>
                  <th className="py-3 px-4">Especialista</th>
                  <th className="py-3 px-4">Divisão</th>
                  <th className="py-3 px-4">Competências Principais</th>
                  <th className="py-3 px-6 text-right">Vínculo Paperclip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {filtered.map((sp) => {
                  const allocated = isAllocated(sp);
                  return (
                    <tr
                      key={sp.id}
                      onClick={() => setSelectedId(sp.id)}
                      className="hover:bg-surface-blue/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-6 font-mono text-xs text-ink-subtle whitespace-nowrap">
                        {sp.code}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-ink">{sp.name}</div>
                        <div className="text-xs text-ink-subtle line-clamp-1">{sp.summary}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-ink-muted whitespace-nowrap">
                        {sp.division}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-ink-subtle">
                        {sp.competencies.slice(0, 3).join(' · ')}
                      </td>
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        {allocated ? (
                          <StatusText label="Alocado no Paperclip" tone="nominal" />
                        ) : (
                          <span className="text-xs text-ink-subtle">Disponível</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SPECIALIST PROFILE DRAWER */}
      <SlideDrawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        wide
        subtitle={selected ? `${selected.code} · ${selected.division} · ${selected.archetype}` : undefined}
        title={selected?.name || ''}
        footer={
          selected && !isAllocated(selected) ? (
            <button
              type="button"
              disabled={hiring || !canManageAgents}
              onClick={() => handleAllocate(selected)}
              className="nc-primary-btn px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {!canManageAgents
                ? `Paperclip offline (${hermes.status.connectionLabel})`
                : hiring
                  ? 'Alocando...'
                  : 'Alocar especialista no Paperclip'}
            </button>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex items-center justify-between py-3 border-y border-line text-xs">
              <span className="text-ink-subtle">
                Adapter recomendado: <strong className="font-mono text-ink">{selected.recommendedAdapter}</strong>
              </span>
              <StatusText
                label={isAllocated(selected) ? 'Alocado no Paperclip' : 'Perfil de catálogo'}
                tone={isAllocated(selected) ? 'nominal' : 'neutral'}
              />
            </div>

            <div>
              <h3 className="text-xs font-semibold text-ink-subtle mb-1.5">Descrição & Escopo</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{selected.summary}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <h3 className="text-xs font-semibold text-ink-subtle mb-2">Competências</h3>
                <ul className="space-y-1 text-sm text-ink">
                  {selected.competencies.map((c) => (
                    <li key={c}>· {c}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-ink-subtle mb-2">Áreas de Conhecimento</h3>
                <ul className="space-y-1 text-sm text-ink">
                  {selected.knowledgeAreas.map((k) => (
                    <li key={k}>· {k}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-line">
              <div>
                <h3 className="text-xs font-semibold text-ink-subtle mb-2">Skills</h3>
                <div className="text-xs font-mono text-ink-muted space-y-1">
                  {selected.skills.map((s) => (
                    <div key={s}>{s}</div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-ink-subtle mb-2">Ferramentas</h3>
                <div className="text-xs font-mono text-ink-muted space-y-1">
                  {selected.tools.map((t) => (
                    <div key={t}>{t}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-line space-y-2">
              <h3 className="text-xs font-semibold text-ink-subtle">Documentação & Runbook Operacional</h3>
              <ol className="space-y-1.5 text-sm text-ink-muted">
                {selected.runbook.map((step, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs text-highlight mr-2">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className="pt-2 border-t border-line space-y-2">
              <h3 className="text-xs font-semibold text-ink-subtle">Limites & Governança</h3>
              <ul className="space-y-1 text-sm text-ink-muted">
                {selected.limitations.map((lim, i) => (
                  <li key={i}>· {lim}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </SlideDrawer>
    </div>
  );
};
