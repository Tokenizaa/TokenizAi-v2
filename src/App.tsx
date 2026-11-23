import React, { useCallback, useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
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
import { AuthPage } from './pages/AuthPage';
import { supabase, mapSupabaseUser } from './lib/supabase.ts';
import { AuthApi } from './services/api.ts';
import { PaperclipApi, PlatformApi } from './services/api';
import type {
  EnterpriseDataState,
  NavSectionId,
  PaperclipOverviewBundle,
} from './types/platform.ts';

type AppUser = {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
  platformRole: string | null;
  isPlatformAdmin: boolean;
  appMetadata: Record<string, unknown>;
};

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

  // Aplica o tema ao documento e persiste a escolha no localStorage.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('tokenizai-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [enterprise, setEnterprise] = useState<EnterpriseDataState | null>(null);
  const [paperclip, setPaperclip] = useState<PaperclipOverviewBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Recupera a sessao persistida do Supabase ao carregar a aplicacao.
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          setUser(mapSupabaseUser(data.session.user));
        }
      } catch {
        // Sessao nao recuperada; usuario permanece nao autenticado.
      } finally {
        setAuthLoading(false);
      }
    };
    initSession();
  }, []);

  // Escuta mudanças de autenticacao (login, logout, renovacao de token).
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const appUser = mapSupabaseUser(session.user);
        setUser(appUser);
        // Executa o bootstrap do primeiro administrador quando for a identidade elegível.
        if (appUser.email === 'olfnetto@gmail.com' && !appUser.isPlatformAdmin) {
          try {
            const res = await AuthApi.bootstrapAdmin();
            if (res.ok && res.claimed) {
              setUser({ ...appUser, isPlatformAdmin: true, platformRole: 'platform_admin' });
            }
          } catch {
            // Erro tratado na propria tela de login via AuthApi; aqui apenas evitamos quebrar o fluxo.
          }
        }
      } else {
        setUser(null);
      }
    });
    return () => sub.subscription?.unsubscribe();
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
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
    if (user) loadAll();
  }, [user, loadAll]);

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

  // Antes da autenticacao, exibe apenas a pagina de login/cadastro.
  if (!user || authLoading) {
    return (
      <div className="min-h-screen bg-canvas">
        <AuthPage
          onAuthenticated={(appUser) => {
            setUser(appUser);
            if (
              appUser.email === 'olfnetto@gmail.com' &&
              !appUser.isPlatformAdmin
            ) {
              AuthApi.bootstrapAdmin().catch(() => {
                // Erro tratado na UI de login.
              });
            }
          }}
        />
      </div>
    );
  }

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
        user={user}
        onLogout={handleLogout}
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
