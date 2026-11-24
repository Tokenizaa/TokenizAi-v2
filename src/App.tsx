import React, { useCallback, useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from 'react-router-dom';
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
import type { EnterpriseDataState, NavSectionId, PaperclipOverviewBundle } from './types/platform.ts';

import { DashboardPage } from './modules/ai-workforce/pages/DashboardPage';
import { InboxPage } from './modules/ai-workforce/pages/InboxPage';
import { ChatPage } from './modules/ai-workforce/pages/ChatPage';
import { AgentsPage } from './modules/ai-workforce/pages/AgentsPage';
import { AgentDetailPage } from './modules/ai-workforce/pages/AgentDetailPage';
import { OrganizationPage } from './modules/ai-workforce/pages/OrganizationPage';
import { TasksPage } from './modules/ai-workforce/pages/TasksPage';
import { TaskDetailPage } from './modules/ai-workforce/pages/TaskDetailPage';
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

const WORKFORCE_ROUTES: Record<string, NavSectionId> = {
  '/ia-visao': 'ia-visao',
  '/ia-inbox': 'ia-inbox',
  '/ia-chat': 'ia-chat',
  '/ia-agentes': 'ia-agentes',
  '/ia-equipes': 'ia-equipes',
  '/ia-tarefas': 'ia-tarefas',
  '/ia-execucoes': 'ia-execucoes',
  '/ia-rotinas': 'ia-rotinas',
  '/ia-aprovacoes': 'ia-aprovacoes',
  '/ia-custos': 'ia-custos',
  '/ia-metas': 'ia-metas',
  '/ia-skills': 'ia-skills',
  '/ia-conectores': 'ia-conectores',
  '/ia-atividade': 'ia-atividade',
  '/ia-artefatos': 'ia-artefatos',
};

const ENTERPRISE_ROUTES: Record<string, NavSectionId> = {
  '/executivo': 'executivo',
  '/projetos': 'projetos',
  '/clientes': 'clientes',
  '/comercial': 'comercial',
  '/produtos': 'produtos',
  '/assinaturas': 'assinaturas',
  '/financeiro': 'financeiro',
  '/relatorios': 'relatorios',
  '/biblioteca': 'biblioteca',
  '/admin': 'admin',
};

interface AppContentProps {
  user: AppUser;
  enterprise: EnterpriseDataState | null;
  paperclip: PaperclipOverviewBundle | null;
  loading: boolean;
  error: string | null;
  isDark: boolean;
  reducedMotion: boolean;
  onToggleTheme: () => void;
  onToggleReducedMotion: () => void;
  onLogout: () => void;
}

function AppContent({
  user,
  enterprise,
  paperclip,
  loading,
  error,
  isDark,
  reducedMotion,
  onToggleTheme,
  onToggleReducedMotion,
  onLogout,
}: AppContentProps) {
  const loc = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [createProjectModal, setCreateProjectModal] = useState(false);

  const activeSection: NavSectionId | null =
    WORKFORCE_ROUTES[loc.pathname] ??
    ENTERPRISE_ROUTES[loc.pathname] ??
    (() => {
      if (/^\/ia-agentes\//.test(loc.pathname)) return 'ia-agentes';
      if (/^\/ia-tarefas\//.test(loc.pathname)) return 'ia-tarefas';
      if (/^\/ia-aprovacoes\//.test(loc.pathname)) return 'ia-aprovacoes';
      return null;
    })() ??
    (loc.pathname === '/' ? 'executivo' : null);

  const handleNavigate = useCallback(
    (to: string) => {
      if (to.startsWith('ia-agente-detalhe:')) {
        navigate(`/ia-agentes/${to.slice('ia-agente-detalhe:'.length)}`);
        return;
      }
      if (to.startsWith('ia-tarefa-detalhe:')) {
        navigate(`/ia-tarefas/${to.slice('ia-tarefa-detalhe:'.length)}`);
        return;
      }
      if (to.startsWith('ia-aprovacao-detalhe:')) {
        navigate(`/ia-aprovacoes/${to.slice('ia-aprovacao-detalhe:'.length)}`);
        return;
      }
      const routeMap: Record<string, string> = {
        'ia-visao': '/ia-visao',
        'ia-inbox': '/ia-inbox',
        'ia-chat': '/ia-chat',
        'ia-agentes': '/ia-agentes',
        'ia-equipes': '/ia-equipes',
        'ia-tarefas': '/ia-tarefas',
        'ia-execucoes': '/ia-execucoes',
        'ia-rotinas': '/ia-rotinas',
        'ia-aprovacoes': '/ia-aprovacoes',
        'ia-custos': '/ia-custos',
        'ia-metas': '/ia-metas',
        'ia-skills': '/ia-skills',
        'ia-conectores': '/ia-conectores',
        'ia-atividade': '/ia-atividade',
        'ia-artefatos': '/ia-artefatos',
        executivo: '/executivo',
        projetos: '/projetos',
        clientes: '/clientes',
        comercial: '/comercial',
        produtos: '/produtos',
        assinaturas: '/assinaturas',
        financeiro: '/financeiro',
        relatorios: '/relatorios',
        biblioteca: '/biblioteca',
        admin: '/admin',
      };
      navigate(routeMap[to] ?? to);
    },
    [],
  );

  const showToast = useCallback((msg: string) => {
    // eslint-disable-next-line no-console
    console.log('[toast]', msg);
  }, []);

  const mainContent = !error ? (
    <>
      {loc.pathname.startsWith('/executivo') && (
        <div
          role="note"
          className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <strong className="font-semibold">Base empresarial demonstrativa.</strong>{' '}
          Os cadastros e indicadores desta área são inicializados em memória e podem ser
          reiniciados com o servidor. Não utilize esses valores como dados financeiros ou
          operacionais oficiais.
        </div>
      )}
      <Routes>
        <Route path="/executivo" element={<ExecutiveView paperclip={paperclip!} onNavigate={handleNavigate} />} />
        <Route path="/projetos" element={
          <ProjectsView
            projects={enterprise?.projects || []}
            clients={enterprise?.clients || []}
            paperclipProjects={paperclip?.projects || []}
            onRefresh={async () => { window.location.reload(); }}
            onToast={showToast}
            createOpenExternal={createProjectModal}
            onCloseCreateExternal={() => setCreateProjectModal(false)}
          />
        } />
        <Route path="/clientes" element={
          <CustomersView
            clients={enterprise?.clients || []}
            projects={enterprise?.projects || []}
            deals={enterprise?.deals || []}
            subscriptions={enterprise?.subscriptions || []}
            onRefresh={async () => { window.location.reload(); }}
            onToast={showToast}
          />
        } />
        <Route path="/comercial" element={
          <CommercialView
            deals={enterprise?.deals || []}
            clients={enterprise?.clients || []}
            onRefresh={async () => { window.location.reload(); }}
            onToast={showToast}
          />
        } />
        <Route path="/produtos" element={
          <ProductsView
            products={enterprise?.products || []}
            onRefresh={async () => { window.location.reload(); }}
            onToast={showToast}
            onNavigate={handleNavigate}
          />
        } />
        <Route path="/assinaturas" element={
          <SubscriptionsView
            subscriptions={enterprise?.subscriptions || []}
            onRefresh={async () => { window.location.reload(); }}
            onToast={showToast}
          />
        } />
        <Route path="/financeiro" element={
          <FinanceView
            entries={enterprise?.financeEntries || []}
            onRefresh={async () => { window.location.reload(); }}
            onToast={showToast}
          />
        } />
        <Route path="/relatorios" element={<ReportsView enterprise={enterprise!} paperclip={paperclip!} onToast={showToast} />} />
        <Route path="/biblioteca" element={
          <AgencyLibraryView paperclip={paperclip!} onRefresh={async () => { window.location.reload(); }} onToast={showToast} />
        } />
        <Route path="/admin" element={
          <AdminView
            enterprise={enterprise!}
            paperclipStatus={paperclip?.status}
            isDark={isDark}
            onToggleTheme={onToggleTheme}
            reducedMotion={reducedMotion}
            onToggleReducedMotion={onToggleReducedMotion}
            onRefresh={async () => { window.location.reload(); }}
            onToast={showToast}
          />
        } />

        {/* WORKFORCE IA */}
        <Route path="/ia-visao" element={<DashboardPage onRefresh={async () => { window.location.reload(); }} onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-inbox" element={<InboxPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-chat" element={<ChatPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-agentes" element={<AgentsPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-agentes/:agentId" element={<AgentDetailPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-equipes" element={<OrganizationPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-tarefas" element={<TasksPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-tarefas/:taskId" element={<TaskDetailPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-execucoes" element={<RunsPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-rotinas" element={<RoutinesPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-aprovacoes" element={<ApprovalsPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-aprovacoes/:approvalId" element={<ApprovalDetailPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-custos" element={<CostsPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-metas" element={<GoalsPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-skills" element={<SkillsPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-conectores" element={<ConnectorsPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-atividade" element={<ActivityPage onNavigate={handleNavigate} onToast={showToast} />} />
        <Route path="/ia-artefatos" element={<ArtifactsPage onNavigate={handleNavigate} onToast={showToast} />} />

        <Route path="/" element={<Navigate to="/executivo" replace />} />
        <Route path="*" element={
          <div className="rounded-2xl nc-card p-12 text-center space-y-4">
            <h2 className="font-display text-xl font-semibold text-ink">Página não encontrada</h2>
            <p className="text-sm text-ink-muted">O caminho {loc.pathname} não existe na TokenizAi.</p>
            <button type="button" onClick={() => handleNavigate('executivo')} className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">Voltar ao cockpit</button>
          </div>
        } />
      </Routes>
    </>
  ) : null;

  const errorContent = !loading && error ? (
    <div className="rounded-2xl nc-card p-8 text-center space-y-3">
      <h2 className="font-display text-lg font-semibold text-ink">
        Não foi possível carregar o ambiente TokenizAi
      </h2>
      <p className="text-sm text-ink-muted">{error}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
      >
        Tentar novamente
      </button>
    </div>
  ) : null;

  const loadingContent = loading ? (
    <div className="space-y-6 animate-pulse">
      <div className="h-16 rounded-xl bg-surface border border-line" />
      <div className="h-28 rounded-2xl bg-surface border border-line" />
      <div className="h-72 rounded-2xl bg-surface border border-line" />
    </div>
  ) : null;

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <AppShell
        activeSection={activeSection ?? 'executivo'}
        onSelectSection={handleNavigate}
        onOpenSearch={() => setSearchOpen(true)}
        primaryActionLabel={
          loc.pathname.startsWith('/ia-')
            ? 'Biblioteca Agency'
            : loc.pathname === '/biblioteca'
              ? 'Ver Operação Paperclip'
              : 'Novo Projeto'
        }
        onPrimaryAction={() => {}}
        isDark={isDark}
        onToggleTheme={onToggleTheme}
        user={user}
        onLogout={onLogout}
      >
        {loadingContent}
        {errorContent}
        {mainContent}
        {!error && (
          <CommandPalette
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            enterprise={enterprise!}
            agents={paperclip?.agents || []}
            issues={paperclip?.issues || []}
            projects={paperclip?.projects || []}
            onNavigate={handleNavigate}
          />
        )}
      </AppShell>
    </div>
  );
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : localStorage.getItem('tokenizai-theme') === 'dark',
  );
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : localStorage.getItem('tokenizai-reduced-motion') === 'true',
  );
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
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
    const initSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          setUser(mapSupabaseUser(data.session.user));
        }
      } catch {
        // sessao nao recuperada
      } finally {
        setAuthLoading(false);
      }
    };
    initSession();
  }, []);

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
            // erro tratado na UI
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
    loadAll();
  }, [user, loadAll]);

  if (!user || authLoading) {
    return (
      <BrowserRouter>
        <div className="min-h-screen bg-canvas">
          <AuthPage
            onAuthenticated={(appUser) => {
              setUser(appUser);
              if (appUser.email === 'olfnetto@gmail.com' && !appUser.isPlatformAdmin) {
                AuthApi.bootstrapAdmin().catch(() => {
                  // erro tratado na UI
                });
              }
            }}
          />
        </div>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <AppContent
        user={user}
        enterprise={enterprise}
        paperclip={paperclip}
        loading={loading}
        error={error}
        isDark={isDark}
        reducedMotion={reducedMotion}
        onToggleTheme={() => setIsDark((d) => !d)}
        onToggleReducedMotion={() => setReducedMotion((r) => !r)}
        onLogout={handleLogout}
      />
    </BrowserRouter>
  );
}