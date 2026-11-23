import React, { useCallback, useEffect, useState } from 'react';
import { CommandPalette } from './components/Common/CommandPalette';
import { AppShell } from './components/Layout/AppShell';
import { AdminView } from './modules/admin/AdminView';
import { AiOpsView, type AiOpsSectionId } from './modules/ai-ops/AiOpsView';
import { CommercialView } from './modules/commercial/CommercialView';
import { CustomersView } from './modules/customers/CustomersView';
import { ExecutiveView } from './modules/executive/ExecutiveView';
import { FinanceView } from './modules/finance/FinanceView';
import { AgencyLibraryView } from './modules/library/AgencyLibraryView';
import { ProductsView } from './modules/products/ProductsView';
import { ProjectsView } from './modules/projects/ProjectsView';
import { ReportsView } from './modules/reports/ReportsView';
import { SubscriptionsView } from './modules/subscriptions/SubscriptionsView';
import { PaperclipApi, PlatformApi } from './services/api';
import type {
  EnterpriseDataState,
  NavSectionId,
  PaperclipOverviewBundle,
} from './types/platform';

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSectionId>('executivo');
  const [searchOpen, setSearchOpen] = useState(false);
  const [createProjectModal, setCreateProjectModal] = useState(false);

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('tokenizai-theme') === 'dark';
  });

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('tokenizai-reduced-motion') === 'true';
  });

  const [enterprise, setEnterprise] = useState<EnterpriseDataState | null>(null);
  const [paperclip, setPaperclip] = useState<PaperclipOverviewBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('tokenizai-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
    localStorage.setItem('tokenizai-reduced-motion', String(reducedMotion));
  }, [reducedMotion]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3200);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setError(null);
      const [entRes, pcRes] = await Promise.all([
        PlatformApi.getEnterpriseState(),
        PaperclipApi.getOverviewBundle(),
      ]);
      setEnterprise(entRes.data);
      setPaperclip({
        status: pcRes.status,
        agents: pcRes.agents || [],
        issues: pcRes.issues || [],
        runs: pcRes.runs || [],
        projects: pcRes.projects || [],
        goals: pcRes.goals || [],
        approvals: pcRes.approvals || [],
        routines: pcRes.routines || [],
        costs: pcRes.costs || null,
        activity: pcRes.activity || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados da plataforma.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const isAiOpsSection =
    activeSection === 'ia-visao' ||
    activeSection === 'ia-chat' ||
    activeSection === 'ia-agentes' ||
    activeSection === 'ia-equipes' ||
    activeSection === 'ia-tarefas' ||
    activeSection === 'ia-execucoes' ||
    activeSection === 'ia-rotinas' ||
    activeSection === 'ia-aprovacoes' ||
    activeSection === 'ia-custos';

  const isEnterpriseSection = [
    'executivo',
    'projetos',
    'clientes',
    'comercial',
    'produtos',
    'assinaturas',
    'financeiro',
    'relatorios',
  ].includes(activeSection);

  const handlePrimaryAction = () => {
    if (isAiOpsSection) {
      setActiveSection('biblioteca');
      return;
    }
    if (activeSection === 'biblioteca') {
      setActiveSection('ia-visao');
      return;
    }
    setActiveSection('projetos');
    setCreateProjectModal(true);
  };

  const primaryActionLabel = isAiOpsSection
    ? 'Biblioteca Agency'
    : activeSection === 'biblioteca'
      ? 'Ver Operação Paperclip'
      : 'Novo Projeto';

  return (
    <>
      <AppShell
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onOpenSearch={() => setSearchOpen(true)}
        primaryActionLabel={primaryActionLabel}
        onPrimaryAction={handlePrimaryAction}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
      >
        {loading && (
          <div className="space-y-6 animate-pulse">
            <div className="h-16 rounded-xl bg-surface border border-line" />
            <div className="h-28 rounded-2xl bg-surface border border-line" />
            <div className="h-72 rounded-2xl bg-surface border border-line" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl nc-card p-8 text-center space-y-3">
            <h2 className="font-display text-lg font-semibold text-ink">
              Não foi possível carregar o ambiente TokenizAi
            </h2>
            <p className="text-sm text-ink-muted">{error}</p>
            <button
              type="button"
              onClick={loadAll}
              className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && enterprise && paperclip && (
          <>
            {isEnterpriseSection && (
              <div
                role="note"
                className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <strong className="font-semibold">Base empresarial demonstrativa.</strong>{' '}
                Os cadastros e indicadores desta área são inicializados em memória e podem ser reiniciados com o servidor. Não utilize esses valores como dados financeiros ou operacionais oficiais.
              </div>
            )}
            {activeSection === 'executivo' && (
              <ExecutiveView
                enterprise={enterprise}
                paperclip={paperclip}
                onNavigate={setActiveSection}
              />
            )}

            {activeSection === 'projetos' && (
              <ProjectsView
                projects={enterprise.projects}
                clients={enterprise.clients}
                paperclipProjects={paperclip.projects}
                onRefresh={loadAll}
                onToast={showToast}
                createOpenExternal={createProjectModal}
                onCloseCreateExternal={() => setCreateProjectModal(false)}
              />
            )}

            {activeSection === 'clientes' && (
              <CustomersView
                clients={enterprise.clients}
                projects={enterprise.projects}
                deals={enterprise.deals}
                subscriptions={enterprise.subscriptions}
                onRefresh={loadAll}
                onToast={showToast}
              />
            )}

            {activeSection === 'comercial' && (
              <CommercialView
                deals={enterprise.deals}
                clients={enterprise.clients}
                onRefresh={loadAll}
                onToast={showToast}
              />
            )}

            {activeSection === 'produtos' && (
              <ProductsView
                products={enterprise.products}
                onRefresh={loadAll}
                onToast={showToast}
                onNavigate={setActiveSection}
              />
            )}

            {activeSection === 'assinaturas' && (
              <SubscriptionsView
                subscriptions={enterprise.subscriptions}
                onRefresh={loadAll}
                onToast={showToast}
              />
            )}

            {activeSection === 'financeiro' && (
              <FinanceView
                entries={enterprise.financeEntries}
                onRefresh={loadAll}
                onToast={showToast}
              />
            )}

            {activeSection === 'relatorios' && (
              <ReportsView
                enterprise={enterprise}
                paperclip={paperclip}
                onToast={showToast}
              />
            )}

            {isAiOpsSection && (
              <AiOpsView
                section={activeSection as AiOpsSectionId}
                bundle={paperclip}
                onRefresh={loadAll}
                onNavigate={setActiveSection}
                onToast={showToast}
              />
            )}

            {activeSection === 'biblioteca' && (
              <AgencyLibraryView
                paperclip={paperclip}
                onRefresh={loadAll}
                onToast={showToast}
              />
            )}

            {activeSection === 'admin' && (
              <AdminView
                enterprise={enterprise}
                paperclipStatus={paperclip.status}
                isDark={isDark}
                onToggleTheme={() => setIsDark((d) => !d)}
                reducedMotion={reducedMotion}
                onToggleReducedMotion={() => setReducedMotion((r) => !r)}
                onRefresh={loadAll}
                onToast={showToast}
              />
            )}
          </>
        )}
      </AppShell>

      {enterprise && paperclip && (
        <CommandPalette
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          enterprise={enterprise}
          agents={paperclip.agents}
          issues={paperclip.issues}
          projects={paperclip.projects}
          onNavigate={setActiveSection}
        />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl nc-glow-panel text-xs font-medium text-ink shadow-xl"
        >
          {toast}
        </div>
      )}
    </>
  );
}
