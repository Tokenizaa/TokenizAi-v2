import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Search, User, Clock, Zap, RefreshCw, MessageSquare, Play, Pause, Plus, X, Layers, Mail, Building, Users } from 'lucide-react';
import { PageHeader, SegmentedTabs, StatusText, SlideDrawer } from '../../../components/ui/Primitives';
import { CollectionToolbar, SectionTitle, StatusBadge, EmptyState, ErrorState, LoadingState } from '../../ai-workforce/components';
import { HermesApi } from '../../../services/api';
import type { HermesBotDto, Departamento, AgenteEmpresarial, Equipe } from '../../../types/platform';

interface OrganizationPageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

const statusTone = (st: string) => {
  const s = st.toLowerCase();
  if (s === 'running' || s === 'active' || s === 'idle' || s === 'ready') return 'nominal';
  if (s === 'error' || s === 'failed' || s === 'terminated') return 'critical';
  return 'attention';
};

export const OrganizationPage: React.FC<OrganizationPageProps> = ({ onNavigate, onToast }) => {
  const [tab, setTab] = useState<'departamentos' | 'equipes' | 'agentes'>('departamentos');
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [agentesEmpresariais, setAgentesEmpresariais] = useState<AgenteEmpresarial[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  // Modal states
  const [deptDrawer, setDeptDrawer] = useState(false);
  const [equipeDrawer, setEquipeDrawer] = useState(false);
  const [agenteDrawer, setAgenteDrawer] = useState(false);
  const [editingDept, setEditingDept] = useState<Departamento | null>(null);
  const [editingEquipe, setEditingEquipe] = useState<Equipe | null>(null);
  const [editingAgente, setEditingAgente] = useState<AgenteEmpresarial | null>(null);

  // Form states
  const [deptForm, setDeptForm] = useState({ nome: '', codigo: '', descricao: '', departamentoPaiId: '' as string });
  const [equipeForm, setEquipeForm] = useState({ nome: '', descricao: '', departamentoId: '' as string, liderId: '' as string, integrantes: [] as string[] });
  const [agenteForm, setAgenteForm] = useState<{ nome: string; slug: string; divisao: string; papel: string; departamentoId: string; hermesAgentId: string; status: 'ativo' | 'inativo' | 'suspenso' }>({ nome: '', slug: '', divisao: '', papel: '', departamentoId: '', hermesAgentId: '', status: 'ativo' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dRes, aRes, eRes] = await Promise.all([
        fetch('/api/empresariais/departamentos').then((r) => r.json()),
        fetch('/api/empresariais/agentes').then((r) => r.json()),
        fetch('/api/empresariais/equipes').then((r) => r.json()),
      ]);
      setDepartamentos(dRes.departamentos || []);
      setAgentesEmpresariais(aRes.agentes || []);
      setEquipes(eRes.equipes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados organizacionais.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deptoPorId = useMemo(() => {
    const map = new Map<string, Departamento>();
    departamentos.forEach((d) => map.set(d.id, d));
    return map;
  }, [departamentos]);

  const agentePorId = useMemo(() => {
    const map = new Map<string, AgenteEmpresarial>();
    agentesEmpresariais.forEach((a) => map.set(a.id, a));
    return map;
  }, [agentesEmpresariais]);

  const handleCreateDepartamento = async () => {
    if (!deptForm.nome || !deptForm.codigo) {
      onToast('Nome e código são obrigatórios.');
      return;
    }
    setBusy((prev) => ({ ...prev, dept: true }));
    try {
      const res = await fetch('/api/empresariais/departamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: deptForm.nome.trim(),
          codigo: deptForm.codigo.trim(),
          descricao: deptForm.descricao.trim() || undefined,
          departamentoPaiId: deptForm.departamentoPaiId || undefined,
        }),
      });
      if (!res.ok) throw new Error('Falha ao criar departamento.');
      setDeptDrawer(false);
      setDeptForm({ nome: '', codigo: '', descricao: '', departamentoPaiId: '' });
      await load();
      onToast('Departamento criado com sucesso.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha ao criar departamento.');
    } finally {
      setBusy((prev) => ({ ...prev, dept: false }));
    }
  };

  const handleCreateEquipe = async () => {
    if (!equipeForm.nome) {
      onToast('Nome da equipe é obrigatório.');
      return;
    }
    setBusy((prev) => ({ ...prev, equipe: true }));
    try {
      const res = await fetch('/api/empresariais/equipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: equipeForm.nome.trim(),
          descricao: equipeForm.descricao.trim() || undefined,
          departamentoId: equipeForm.departamentoId || undefined,
          liderId: equipeForm.liderId || undefined,
          integrantes: equipeForm.integrantes,
        }),
      });
      if (!res.ok) throw new Error('Falha ao criar equipe.');
      setEquipeDrawer(false);
      setEquipeForm({ nome: '', descricao: '', departamentoId: '', liderId: '', integrantes: [] });
      await load();
      onToast('Equipe criada com sucesso.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha ao criar equipe.');
    } finally {
      setBusy((prev) => ({ ...prev, equipe: false }));
    }
  };

  const handleSaveAgenteEmpresarial = async () => {
    if (!agenteForm.nome || !agenteForm.slug) {
      onToast('Nome e slug são obrigatórios.');
      return;
    }
    setBusy((prev) => ({ ...prev, agente: true }));
    try {
      const id = editingAgente?.id;
      const res = await fetch(id ? `/api/empresariais/agentes/${id}` : '/api/empresariais/agentes', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: agenteForm.nome.trim(),
          slug: agenteForm.slug.trim(),
          divisao: agenteForm.divisao.trim() || undefined,
          papel: agenteForm.papel.trim() || undefined,
          departamentoId: agenteForm.departamentoId || undefined,
          hermesAgentId: agenteForm.hermesAgentId.trim() || undefined,
          status: agenteForm.status,
        }),
      });
      if (!res.ok) throw new Error('Falha ao salvar agente.');
      setAgenteDrawer(false);
      setAgenteForm({ nome: '', slug: '', divisao: '', papel: '', departamentoId: '', hermesAgentId: '', status: 'ativo' });
      setEditingAgente(null);
      await load();
      onToast(id ? 'Agente atualizado.' : 'Agente empresarial criado.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha ao salvar agente.');
    } finally {
      setBusy((prev) => ({ ...prev, agente: false }));
    }
  };

  const renderDepartamentosTree = () => {
    const roots = departamentos.filter((d) => !d.departamentoPaiId);
    const renderNode = (depto: Departamento, depth = 0): React.ReactNode => {
      const filhos = departamentos.filter((d) => d.departamentoPaiId === depto.id);
      const agentesNoDept = agentesEmpresariais.filter((a) => a.departamentoId === depto.id);
      return (
        <div key={depto.id} className="space-y-2.5">
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setEditingDept(depto);
              setDeptForm({
                nome: depto.nome,
                codigo: depto.codigo,
                descricao: depto.descricao || '',
                departamentoPaiId: depto.departamentoPaiId || '',
              });
              setDeptDrawer(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setEditingDept(depto);
                setDeptDrawer(true);
              }
            }}
            className={`nc-card rounded-2xl p-4 flex flex-row sm:flex-row sm:items-center justify-between gap-3 ${
              depth > 0 ? 'pl-8' : ''
            } border border-line cursor-pointer`}
            style={{ marginLeft: `${depth * 20}px` }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building className="w-4 h-4 text-ink-subtle shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-ink truncate">{depto.nome}</div>
                <div className="text-xs text-ink-subtle truncate">{depto.codigo} · {agentesNoDept.length} agente(s)</div>
              </div>
            </div>
            <div className="text-xs font-mono text-ink-muted">
              {filhos.length > 0 ? `${filhos.length} subdepto(s)` : ''}
            </div>
          </div>
          {filhos.length > 0 && (
            <div className="pl-8 border-l border-line/30 mt-2">
              {filhos.map((f) => renderNode(f, depth + 1))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-4">
        {roots.length === 0 && (
          <div className="nc-card rounded-2xl p-10 text-center text-xs text-ink-subtle">
            <Building className="w-6 h-6 text-accent dark:text-cyan-300 mx-auto mb-3" />
            <div>Nenhum departamento cadastrado.</div>
          </div>
        )}
        {roots.map((r) => renderNode(r))}
      </div>
    );
  };

  const renderAgentesTable = () => {
    const agentesComDepartamento = agentesEmpresariais.map((a) => ({
      ...a,
      departamentoNome: a.departamentoId ? deptoPorId.get(a.departamentoId)?.nome : 'Sem departamento',
    }));

    if (agentesComDepartamento.length === 0) {
      return (
        <div className="nc-card rounded-2xl p-10 text-center text-xs text-ink-subtle">
          <Bot className="w-6 h-6 text-accent dark:text-cyan-300 mx-auto mb-3" />
          <div>Nenhum agente empresarial cadastrado.</div>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line text-[11px] font-semibold text-ink-subtle bg-surface-subtle/40">
              <th className="py-3.5 px-6">Nome</th>
              <th className="py-3.5 px-4">Slug</th>
              <th className="py-3.5 px-4">Departamento</th>
              <th className="py-3.5 px-4">Papel</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-sm">
            {agentesComDepartamento.map((a) => (
              <tr key={a.id} className="hover:bg-surface-blue/40 transition-colors">
                <td className="py-3.5 px-6 font-medium text-ink">{a.nome}</td>
                <td className="py-3.5 px-4 font-mono text-xs text-ink-subtle">{a.slug}</td>
                <td className="py-3.5 px-4 text-xs text-ink-subtle">{a.departamentoNome}</td>
                <td className="py-3.5 px-4 text-xs text-ink">{a.papel || '—'}</td>
                <td className="py-3.5 px-4">
                  <StatusBadge status={a.status} size="sm" />
                </td>
                <td className="py-3.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAgente(a);
                      setAgenteForm({
                        nome: a.nome,
                        slug: a.slug,
                        divisao: a.divisao || '',
                        papel: a.papel || '',
                        departamentoId: a.departamentoId || '',
                        hermesAgentId: a.hermesAgentId || '',
                        status: a.status,
                      });
                      setAgenteDrawer(true);
                    }}
                    className="p-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
                    title="Editar agente"
                  >
                    <Mail className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderEquipesTable = () => {
    if (equipes.length === 0) {
      return (
        <div className="nc-card rounded-2xl p-10 text-center text-xs text-ink-subtle">
          <Users className="w-6 h-6 text-accent dark:text-cyan-300 mx-auto mb-3" />
          <div>Nenhuma equipe cadastrada.</div>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line text-[11px] font-semibold text-ink-subtle bg-surface-subtle/40">
              <th className="py-3.5 px-6">Nome</th>
              <th className="py-3.5 px-4">Departamento</th>
              <th className="py-3.5 px-4">Líder</th>
              <th className="py-3.5 px-4">Integrantes</th>
              <th className="py-3.5 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-sm">
            {equipes.map((eq) => {
              const deptoNome = eq.departamentoId ? deptoPorId.get(eq.departamentoId)?.nome : '—';
              const liderNome = eq.liderId ? agentePorId.get(eq.liderId)?.nome : '—';
              const integrantesNomes = eq.integrantes.map((id) => agentePorId.get(id)?.nome || id).join(', ');
              return (
                <tr key={eq.id} className="hover:bg-surface-blue/40 transition-colors">
                  <td className="py-3.5 px-6 font-medium text-ink">{eq.nome}</td>
                  <td className="py-3.5 px-4 text-xs text-ink-subtle">{deptoNome}</td>
                  <td className="py-3.5 px-4 text-xs text-ink">{liderNome}</td>
                  <td className="py-3.5 px-4 text-xs text-ink-subtle">{integrantesNomes}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEquipe(eq);
                        setEquipeForm({
                          nome: eq.nome,
                          descricao: eq.descricao || '',
                          departamentoId: eq.departamentoId || '',
                          liderId: eq.liderId || '',
                          integrantes: eq.integrantes,
                        });
                        setEquipeDrawer(true);
                      }}
                      className="p-1.5 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer"
                      title="Editar equipe"
                    >
                      <Mail className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const headers: Record<string, { title: string; subtitle: string }> = {
    departamentos: {
      title: 'Departamentos',
      subtitle: 'Estrutura organizacional da empresa com hierarquia de subordinação.',
    },
    equipes: {
      title: 'Equipes',
      subtitle: 'Agrupamentos organizacionais de agentes com líderes e integrantes.',
    },
    agentes: {
      title: 'Agentes Empresariais',
      subtitle: 'Cadastro de agentes vinculados à empresa e ao runtime Hermes.',
    },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={headers[tab].title}
        subtitle={headers[tab].subtitle}
        actions={
          <>
            <SegmentedTabs
              active={tab}
              onChange={setTab}
              tabs={[
                { id: 'departamentos', label: 'Departamentos' },
                { id: 'equipes', label: 'Equipes' },
                { id: 'agentes', label: 'Agentes Empresariais' },
              ]}
            />
            <button
              type="button"
              onClick={() => {
                if (tab === 'departamentos') {
                  setDeptForm({ nome: '', codigo: '', descricao: '', departamentoPaiId: '' });
                  setEditingDept(null);
                  setDeptDrawer(true);
                } else if (tab === 'equipes') {
                  setEquipeForm({ nome: '', descricao: '', departamentoId: '', liderId: '', integrantes: [] });
                  setEditingEquipe(null);
                  setEquipeDrawer(true);
                } else {
                  setAgenteForm({ nome: '', slug: '', divisao: '', papel: '', departamentoId: '', hermesAgentId: '', status: 'ativo' });
                  setEditingAgente(null);
                  setAgenteDrawer(true);
                }
              }}
              className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold text-ink cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo
            </button>
          </>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState title="Não foi carregar dados organizacionais" message={error} onRetry={load} />
      ) : tab === 'departamentos' ? (
        renderDepartamentosTree()
      ) : tab === 'equipes' ? (
        renderEquipesTable()
      ) : (
        renderAgentesTable()
      )}

      {/* Departamento drawer */}
      <SlideDrawer
        open={deptDrawer}
        onClose={() => setDeptDrawer(false)}
        title={editingDept ? 'Editar Departamento' : 'Novo Departamento'}
        subtitle="Estrutura organizacional da empresa"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-subtle mb-1">Nome *</label>
              <input
                type="text"
                value={deptForm.nome}
                onChange={(e) => setDeptForm((prev) => ({ ...prev, nome: e.target.value }))}
                className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-subtle mb-1">Código *</label>
              <input
                type="text"
                value={deptForm.codigo}
                onChange={(e) => setDeptForm((prev) => ({ ...prev, codigo: e.target.value }))}
                placeholder="Ex: ENG"
                className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs font-mono text-ink"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-subtle mb-1">Descrição</label>
            <input
              type="text"
              value={deptForm.descricao}
              onChange={(e) => setDeptForm((prev) => ({ ...prev, descricao: e.target.value }))}
              className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-subtle mb-1">Departamento Pai</label>
            <select
              value={deptForm.departamentoPaiId}
              onChange={(e) => setDeptForm((prev) => ({ ...prev, departamentoPaiId: e.target.value }))}
              className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
            >
              <option value="">Nenhum (nível raiz)</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome} ({d.codigo})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeptDrawer(false)}
              className="px-4 py-2 rounded-lg border border-line-strong bg-surface text-xs font-semibold text-ink-muted hover:bg-surface-blue cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy.dept || !deptForm.nome || !deptForm.codigo}
              onClick={handleCreateDepartamento}
              className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold text-ink cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {busy.dept ? 'Salvando...' : editingDept ? 'Atualizar' : 'Criar Departamento'}
            </button>
          </div>
        </div>
      </SlideDrawer>

      {/* Equipe drawer */}
      <SlideDrawer
        open={equipeDrawer}
        onClose={() => setEquipeDrawer(false)}
        title={editingEquipe ? 'Editar Equipe' : 'Nova Equipe'}
        subtitle="Agrupamento organizacional de agentes"
      >
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-ink-subtle mb-1">Nome *</label>
            <input
              type="text"
              value={equipeForm.nome}
              onChange={(e) => setEquipeForm((prev) => ({ ...prev, nome: e.target.value }))}
              className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-subtle mb-1">Descrição</label>
            <input
              type="text"
              value={equipeForm.descricao}
              onChange={(e) => setEquipeForm((prev) => ({ ...prev, descricao: e.target.value }))}
              className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-subtle mb-1">Departamento</label>
              <select
                value={equipeForm.departamentoId}
                onChange={(e) => setEquipeForm((prev) => ({ ...prev, departamentoId: e.target.value }))}
                className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
              >
                <option value="">Sem departamento</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome} ({d.codigo})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-subtle mb-1">Líder</label>
              <select
                value={equipeForm.liderId}
                onChange={(e) => setEquipeForm((prev) => ({ ...prev, liderId: e.target.value }))}
                className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
              >
                <option value="">Sem líder</option>
                {agentesEmpresariais.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} ({a.slug})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-subtle mb-1">Integrantes</label>
            <select
              multiple
              size={4}
              value={equipeForm.integrantes}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                setEquipeForm((prev) => ({ ...prev, integrantes: selected }));
              }}
              className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
            >
              {agentesEmpresariais.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome} ({a.slug})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end justify-end gap-2">
            <button
              type="button"
              onClick={() => setEquipeDrawer(false)}
              className="px-4 py-2 rounded-lg border border-line-strong bg-surface text-xs font-semibold text-ink-muted hover:bg-surface-blue cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy.equipe || !equipeForm.nome}
              onClick={handleCreateEquipe}
              className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold text-ink cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {busy.equipe ? 'Salvando...' : editingEquipe ? 'Atualizar' : 'Criar Equipe'}
            </button>
          </div>
        </div>
      </SlideDrawer>

      {/* Agente empresarial drawer */}
      <SlideDrawer
        open={agenteDrawer}
        onClose={() => setAgenteDrawer(false)}
        title={editingAgente ? 'Editar Agente Empresarial' : 'Novo Agente Empresarial'}
        subtitle="Cadastro vinculado ao runtime Hermes"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-subtle mb-1">Nome *</label>
              <input
                type="text"
                value={agenteForm.nome}
                onChange={(e) => setAgenteForm((prev) => ({ ...prev, nome: e.target.value }))}
                className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-subtle mb-1">Slug *</label>
              <input
                type="text"
                value={agenteForm.slug}
                onChange={(e) => setAgenteForm((prev) => ({ ...prev, slug: e.target.value }))}
                className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs font-mono text-ink"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-subtle mb-1">Divisão</label>
              <input
                type="text"
                value={agenteForm.divisao}
                onChange={(e) => setAgenteForm((prev) => ({ ...prev, divisao: e.target.value }))}
                className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-subtle mb-1">Papel</label>
              <input
                type="text"
                value={agenteForm.papel}
                onChange={(e) => setAgenteForm((prev) => ({ ...prev, papel: e.target.value }))}
                className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-subtle mb-1">Departamento</label>
              <select
                value={agenteForm.departamentoId}
                onChange={(e) => setAgenteForm((prev) => ({ ...prev, departamentoId: e.target.value }))}
                className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
              >
                <option value="">Sem departamento</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome} ({d.codigo})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-subtle mb-1">Status</label>
              <select
                value={agenteForm.status}
                onChange={(e) => setAgenteForm((prev) => ({ ...prev, status: e.target.value as 'ativo' | 'inativo' | 'suspenso' }))}
                className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="suspenso">Suspenso</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-subtle mb-1">Hermes Agent ID</label>
            <input
              type="text"
              value={agenteForm.hermesAgentId}
              onChange={(e) => setAgenteForm((prev) => ({ ...prev, hermesAgentId: e.target.value }))}
              placeholder="ID do perfil no Hermes (opcional)"
              className="w-full pl-3 pr-3 py-2 rounded-xl border border-line-strong bg-surface text-xs text-ink"
            />
          </div>
          <div className="flex items-end justify-end gap-2">
            <button
              type="button"
              onClick={() => setAgenteDrawer(false)}
              className="px-4 py-2 rounded-lg border border-line-strong bg-surface text-xs font-semibold text-ink-muted hover:bg-surface-blue cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy.agente || !agenteForm.nome || !agenteForm.slug}
              onClick={handleSaveAgenteEmpresarial}
              className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold text-ink cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {busy.agente ? 'Salvando...' : editingAgente ? 'Atualizar' : 'Criar Agente'}
            </button>
          </div>
        </div>
      </SlideDrawer>
    </div>
  );
};
