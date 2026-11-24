import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ChevronDown,
  ChevronRight,
  Coins,
  CreditCard,
  FileText,
  FolderKanban,
  GitBranch,
  Inbox,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Search,
  Settings,
  Sparkles,
  Sun,
  Target,
  Wallet,
  X,
} from 'lucide-react';
import type { NavGroup, NavSectionId } from '../../types/platform';

export interface NavItemConfig {
  id: NavSectionId;
  label: string;
  group: NavGroup;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItemConfig[] = [
  { id: 'executivo', label: 'Cockpit executivo', group: 'Empresa', icon: LayoutDashboard },
  { id: 'produtos', label: 'Produtos', group: 'Portfólio', icon: Package },
  { id: 'projetos', label: 'Projetos e entregas', group: 'Portfólio', icon: FolderKanban },
  { id: 'clientes', label: 'Clientes e CRM', group: 'Mercado', icon: Building2 },
  { id: 'comercial', label: 'Comercial e vendas', group: 'Mercado', icon: Briefcase },
  { id: 'assinaturas', label: 'Assinaturas', group: 'Mercado', icon: CreditCard },
  { id: 'financeiro', label: 'Financeiro', group: 'Gestão', icon: Wallet },
  { id: 'relatorios', label: 'Indicadores e relatórios', group: 'Gestão', icon: BarChart3 },

  { id: 'ia-visao', label: 'Visão geral', group: 'Operações de IA', icon: LayoutDashboard },
  { id: 'ia-chat', label: 'Central de comunicação', group: 'Operações de IA', icon: MessageSquare },
  { id: 'ia-agentes', label: 'Agentes', group: 'Operações de IA', icon: Bot },
  { id: 'ia-equipes', label: 'Organização e equipes', group: 'Operações de IA', icon: GitBranch },
  { id: 'ia-tarefas', label: 'Tarefas e delegações', group: 'Operações de IA', icon: ListTodo },
  { id: 'ia-execucoes', label: 'Execuções', group: 'Operações de IA', icon: Activity },
  { id: 'ia-rotinas', label: 'Rotinas e automações', group: 'Operações de IA', icon: Clock },
  { id: 'ia-aprovacoes', label: 'Aprovações', group: 'Operações de IA', icon: CheckCircle2 },
  { id: 'ia-custos', label: 'Custos e orçamentos', group: 'Operações de IA', icon: Coins },
  { id: 'ia-inbox', label: 'Inbox / Decisões', group: 'Operações de IA', icon: Inbox },
  { id: 'ia-metas', label: 'Metas', group: 'Operações de IA', icon: Target },
  { id: 'ia-skills', label: 'Skills', group: 'Operações de IA', icon: Sparkles },
  { id: 'ia-conectores', label: 'Conectores', group: 'Operações de IA', icon: Plug },
  { id: 'ia-atividade', label: 'Atividade e auditoria', group: 'Operações de IA', icon: Activity },
  { id: 'ia-artefatos', label: 'Artefatos', group: 'Operações de IA', icon: FileText },

  { id: 'biblioteca', label: 'Biblioteca de especialistas', group: 'Conhecimento', icon: BookOpen },
  { id: 'admin', label: 'Configurações', group: 'Sistema', icon: Settings },
];

const DETAIL_LABELS: Record<string, string> = {
  'ia-agente-detalhe': 'Agente',
  'ia-tarefa-detalhe': 'Tarefa',
  'ia-aprovacao-detalhe': 'Aprovação',
};
const GROUPS: NavGroup[] = [
  'Empresa',
  'Portfólio',
  'Mercado',
  'Gestão',
  'Operações de IA',
  'Conhecimento',
  'Sistema',
];

const GROUP_LABELS: Record<NavGroup, string> = {
  Empresa: 'Empresa',
  Portfólio: 'Portfólio',
  Mercado: 'Mercado e relacionamento',
  Gestão: 'Gestão corporativa',
  'Operações de IA': 'Força de trabalho IA',
  Conhecimento: 'Conhecimento',
  Sistema: 'Sistema',
};

interface AppShellProps {
  activeSection: NavSectionId;
  onSelectSection: (id: NavSectionId) => void;
  onOpenSearch: () => void;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  user?: { email?: string | null };
  onLogout?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeSection,
  onSelectSection,
  onOpenSearch,
  primaryActionLabel,
  onPrimaryAction,
  isDark,
  onToggleTheme,
  user,
  onLogout,
  children,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<NavGroup[]>([]);
  const currentItem = NAV_ITEMS.find((item) => item.id === activeSection) ?? NAV_ITEMS[0];
  const [expandedGroups, setExpandedGroups] = useState<NavGroup[]>([currentItem.group]);

  useEffect(() => {
    setExpandedGroups((current) =>
      current.includes(currentItem.group) ? current : [...current, currentItem.group],
    );
  }, [activeSection, currentItem.group]);

  const toggleGroup = (group: NavGroup) => {
    setExpandedGroups((current) =>
      current.includes(group) ? current.filter((item) => item !== group) : [...current, group],
    );
  };

  useEffect(() => {
    setExpandedGroups((current) =>
      current.includes(currentItem.group)
        ? current
        : [...current, currentItem.group],
    );
  }, [activeSection, currentItem.group]);

  const toggleGroup = (group: NavGroup) => {
    setExpandedGroups((current) =>
      current.includes(group)
        ? current.filter((item) => item !== group)
        : [...current, group],
    );
  };

  const selectSection = (id: NavSectionId) => {
    onSelectSection(id);
    setMobileOpen(false);
  };

  const renderSidebarBody = (collapsed: boolean) => (
    <div className="flex h-full flex-col border-r border-line bg-surface select-none">
      <div className={`flex h-16 shrink-0 items-center border-b border-line ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        <button
          type="button"
          onClick={() => selectSection('executivo')}
          className="flex min-w-0 items-center gap-3 text-left"
          title="TokenizAi — Cockpit executivo"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
            <span className="font-display text-sm font-bold">T</span>
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate font-display text-[15px] font-bold tracking-tight text-ink">TokenizAi</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-ink-subtle">Company OS</span>
            </span>
          )}
        </button>
        {!collapsed && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            className="hidden rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-subtle hover:text-ink lg:inline-flex"
            aria-label="Recolher menu lateral"
            title="Recolher menu"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1.5 text-ink-subtle hover:bg-surface-subtle lg:hidden"
          aria-label="Fechar navegação"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group);
          const expanded = expandedGroups.includes(group);
          return (
            <section key={group} className="space-y-1">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  aria-expanded={expanded}
                  className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.08em] text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
                >
                  <span>{GROUP_LABELS[group]}</span>
                  {expanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                </button>
              )}
              {(collapsed || expanded) && items.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeSection;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={() => selectSection(item.id)}
                    className={`nc-nav-item flex w-full items-center rounded-lg py-2.5 text-sm ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${active ? 'nc-nav-active' : 'font-medium'}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </section>
          );
        })}
      </nav>

      {collapsed && (
        <div className="hidden justify-center border-t border-line p-3 lg:flex">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="rounded-md p-2 text-ink-subtle hover:bg-surface-subtle hover:text-ink"
            aria-label="Expandir menu lateral"
            title="Expandir menu"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}
      {!collapsed && (
        <div className="border-t border-line px-4 py-3">
          <p className="text-[11px] font-medium text-ink-muted">
            Uma empresa. Um fundador. Uma força de trabalho de IA.
          </p>
          <p className="mt-1 text-[10px] text-ink-subtle">Gestão integrada · TokenizAi</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <aside className={`hidden shrink-0 transition-[width] duration-150 lg:block ${sidebarCollapsed ? 'w-[68px]' : 'w-[320px]'}`}>
        <div className="sticky top-0 h-screen">{renderSidebarBody(sidebarCollapsed)}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          />
          <aside className="relative z-10 h-full w-[280px] max-w-[86vw]">
            {renderSidebarBody(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-line p-2 text-ink-muted hover:bg-surface-subtle lg:hidden"
              aria-label="Abrir navegação"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="hidden truncate text-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle sm:block">
                {GROUP_LABELS[currentItem.group]}
              </p>
              <h1 className="truncate font-display text-sm font-semibold text-ink">
                {currentItem?.label ?? DETAIL_LABELS[activeSection] ?? 'Detalhe'}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onOpenSearch}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
              aria-label="Pesquisar na plataforma"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Buscar</span>
              <kbd className="hidden rounded border border-line bg-surface-subtle px-1 py-0.5 font-mono text-xs text-ink-subtle md:inline">⌘K</kbd>
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
              title={isDark ? 'Modo claro' : 'Modo escuro'}
              className="rounded-lg border border-line p-2 text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onPrimaryAction}
              className="nc-primary-btn rounded-lg px-3 py-2 text-xs font-semibold sm:px-4"
            >
              {primaryActionLabel}
            </button>
            {user && onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line-strong bg-surface-subtle/50 hover:bg-surface-subtle text-xs text-ink-muted hover:text-ink transition-colors cursor-pointer whitespace-nowrap"
                aria-label="Sair da conta"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline truncate max-w-[140px]">
                  Sair ({user.email || 'conta'})
                </span>
              </button>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 sm:px-7 sm:py-7">
          {children}
        </main>
      </div>
    </div>
  );
};
