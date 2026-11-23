import React, { useCallback, useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { CommandPalette } from './components/Common/CommandPalette';
import { AppShell } from './components/Layout/AppShell';
import { AdminView } from './modules/admin/AdminView';
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

// --- Força de trabalho IA (integração definitiva com o Paperclip) ---
import { DashboardPage } from './modules/ai-workforce/pages/DashboardPage';
import { InboxPage } from './modules/ai-workforce/pages/InboxPage';
import { ChatPage } from './modules/ai-workforce/pages/ChatPage';
import { AgentsPage } from './modules/ai-workforce/pages/AgentsPage';
import { AgentDetailPage } from './modules/ai-workforce/pages/AgentDetailPage';
import { OrganizationPage } from './modules/ai-workforce/pages/OrganizationPage';
import { TasksPage } from './modules/ai-workforce/pages/TasksPage';
import { TaskDetailPage } from './modules/ai-workforce/pages/TaskDetailPage';
import { ProjectsPage as WorkforceProjectsPage } from './modules/ai-workforce/pages/ProjectsPage';
import { GoalsPage } from './modules/ai-workforce/pages/GoalsPage';
import { RunsPage } from './modules/ai-workforce/pages/RunsPage';
import { RoutinesPage } from './modules/ai-workforce/pages/RoutinesPage';
import { ApprovalsPage } from './modules/ai-workforce/pages/ApprovalsPage';
import { ApprovalDetailPage } from './modules/ai-workforce/pages/ApprovalDetailPage';
import { CostsPage } from './modules/ai-workforce/pages/CostsPage';
import { ActivityPage } from './modules/ai-workforce/pages/ActivityPage';
import { SkillsPage } from './modules/ai-workforce/pages/SkillsPage';
import { ConnectorsPage } from './modules/ai-workforce/pages/ConnectorsPage';
import { ArtifactsPage } from './modules/ai-workforce/pages/ArtifactsPage';

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

  // Detalhes de recursos (navegação contextual a partir das listagens da força de trabalho)
  const [detailAgentId, setDetailAgentId] = useState<string | null>(null);
  const [detailIssueId, setDetailIssueId] = useState<string | null>(null);
  const [detailApprovalId, setDetailApprovalId] = useState<string | null>(null);

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
        if (appUser.email === 'olfnetto@gmail.com' && !appUser.isPlatformAdmin) {
          try {
            const res = await AuthApi.bootstrapAdmin();
            if (res.ok && res.claimed) {
              setUser({ ...appUser, isPlatformAdmin: true, platformRole: 'platform_admin' });
            }
          } catch {
            // Erro tratado na propria tela de login via AuthApi.
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
    activeSection === 'ia-inbox' ||
    activeSection === 'ia-chat' ||
    activeSection === 'ia-agentes' ||
    activeSection === 'ia-agente-detalhe' ||
    activeSection === 'ia-equipes' ||
    activeSection === 'ia-tarefas' ||
    activeSection === 'ia-tarefa-detalhe' ||
    activeSection === 'ia-execucoes' ||
    activeSection === 'ia-rotinas' ||
    activeSection === 'ia-aprovacoes' ||
    activeSection === 'ia-aprovacao-detalhe' ||
    activeSection === 'ia-custos' ||
    activeSection === 'ia-metas' ||
    activeSection === 'ia-skills' ||
    activeSection === 'ia-conectores' ||
    activeSection === 'ia-atividade' ||
    activeSection === 'ia-artefatos';

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

  // Navegação contextual: suporta detalhes de recursos (agente, tarefa, aprovacao)
  const handleNavigate = useCallback(
    (id: string) => {
      if (id.startsWith('ia-agente-detalhe:')) {
        setDetailAgentId(id.slice('ia-agente-detalhe:'.length));
        setActiveSection('ia-agente-detalhe');
        return;
      }
      if (id.startsWith('ia-tarefa-detalhe:')) {
        setDetailIssueId(id.slice('ia-tarefa-detalhe:'.length));
        setActiveSection('ia-tarefa-detalhe');
        return;
      }
      if (id.startsWith('ia-aprovacao-detalhe:')) {
        setDetailApprovalId(id.slice('ia-aprovacao-detalhe:'.length));
        setActiveSection('ia-aprovacao-detalhe');
        return;
      }
      setDetailAgentId(null);
      setDetailIssueId(null);
      setDetailApprovalId(null);
      setActiveSection(id as NavSectionId);
    },
    [],
  );

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
        onSelectSection={handleNavigate}
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
                paperclip={paperclip}
                onNavigate={handleNavigate}
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
                onNavigate={handleNavigate}
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

            {/* ======================================================================== */}
            {/* FORÇA DE TRABALHO IA — páginas independentes integradas ao Paperclip     */}
            {/* ======================================================================== */}
            {activeSection === 'ia-visao' && (
              <DashboardPage
                onRefresh={loadAll}
                onNavigate={handleNavigate}
                onToast={showToast}
              />
            )}
            {activeSection === 'ia-inbox' && (
              <InboxPage onNavigate={handleNavigate} onToast={showToast} />
            )}
            {activeSection === 'ia-chat' && (
              <ChatPage onNavigate={handleNavigate} onToast={showToast} />
            )}
            {activeSection === 'ia-agentes' && (
              <AgentsPage onNavigate={handleNavigate} onToast={showToast} />
            )}
            {activeSection === 'ia-agente-detalhe' && detailAgentId && (
              <AgentDetailPage
                agentId={detailAgentId}
                onNavigate={handleNavigate}
                onToast={showToast}
              />
            )}
            {activeSection === 'ia-equipes' && (
              <OrganizationPage onNavigate={handleNavigate} onToast={showToast} />
            )}
            {activeSection === 'ia-tarefas' && (
              <TasksPage onNavigate={handleNavigate} onToast={showToast} />
            )}
            {activeSection === 'ia-tarefa-detalhe' && detailIssueId && (
              <TaskDetailPage
                issueId={detailIssueId}
                onNavigate={handleNavigate}
                onToast={showToast}
              />
            )}
            {activeSection === 'ia-execucoes' && (
              <RunsPage onNavigate={handleNavigate} onToast={showToast} />
            )}
            {activeSection === 'ia-rotinas' && (
              <RoutinesPage onNavigate={handleNavigate} onToast={showToast} />
            )}
            {activeSection === 'ia-aprovacoes' && (
              <ApprovalsPage onNavigate={handleNavigate} onToast={showToast} />
            )}
            {activeSection === 'ia-aprovacao-detalhe' && detailApprovalId && (
              <ApprovalDetailPage
                approvalId={detailApprovalId}
                onNavigate={handleNavigate}
                onToast={showToast}
              />
            )}
            {activeSection === 'ia-custos' && (
              <CostsPage onNavigate={handleNavigate} onToast={showToast} />
            )}
            {activeSection === 'ia-metas' && (
              <GoalsPage onNavigate={handleNavigate} onToast={showToast} />
            )}
            {activeSection === 'ia-skills' && (
              <SkillsPage onNavigate={handleNavigate} onToast={showToast} />
            )}
            {activeSection === 'ia-conectores' && (
              <ConnectorsPage onNavigate={handleNavigate} onToast={showToast} />
            )}
            {activeSection === 'ia-atividade' && (
              <ActivityPage onNavigate={handleNavigate} onToast={showToast} />
            )}
            {activeSection === 'ia-artefatos' && (
              <ArtifactsPage onNavigate={handleNavigate} onToast={showToast} />
            )}
          </>
        )}

        {enterprise && paperclip && (
          <CommandPalette
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            enterprise={enterprise}
            agents={paperclip.agents}
            issues={paperclip.issues}
            projects={paperclip.projects}
            onNavigate={handleNavigate}
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
      </AppShell>
    </>
  );
}
