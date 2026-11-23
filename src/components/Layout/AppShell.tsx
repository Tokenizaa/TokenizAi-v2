import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  Compass,
  CreditCard,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  ListTodo,
  Menu,
  MessageSquare,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
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
  // A. Gestão Empresarial
  { id: 'executivo', label: 'Visão Executiva', group: 'Gestão Empresarial', icon: LayoutDashboard },
  { id: 'projetos', label: 'Projetos', group: 'Gestão Empresarial', icon: FolderKanban },
  { id: 'clientes', label: 'Clientes & CRM', group: 'Gestão Empresarial', icon: Building2 },
  { id: 'comercial', label: 'Comercial & Vendas', group: 'Gestão Empresarial', icon: Briefcase },
  { id: 'produtos', label: 'Produtos & Serviços', group: 'Gestão Empresarial', icon: Package },
  { id: 'assinaturas', label: 'Assinaturas', group: 'Gestão Empresarial', icon: CreditCard },
  { id: 'financeiro', label: 'Financeiro', group: 'Gestão Empresarial', icon: Wallet },
  { id: 'relatorios', label: 'Relatórios', group: 'Gestão Empresarial', icon: BarChart3 },

  // B. Operações de IA (Paperclip)
  { id: 'ia-visao', label: 'Visão Geral & Projetos', group: 'Operações de IA', icon: Compass },
  { id: 'ia-chat', label: 'Chat com Agentes', group: 'Operações de IA', icon: MessageSquare },
  { id: 'ia-agentes', label: 'Agentes', group: 'Operações de IA', icon: Bot },
  { id: 'ia-equipes', label: 'Equipes & Diretoria', group: 'Operações de IA', icon: GitBranch },
  { id: 'ia-tarefas', label: 'Tasks & Delegações', group: 'Operações de IA', icon: ListTodo },
  { id: 'ia-execucoes', label: 'Execuções', group: 'Operações de IA', icon: Activity },
  { id: 'ia-rotinas', label: 'Automações & Rotinas', group: 'Operações de IA', icon: Clock },
  { id: 'ia-aprovacoes', label: 'Aprovações', group: 'Operações de IA', icon: CheckCircle2 },
  { id: 'ia-custos', label: 'Custos & Atividade', group: 'Operações de IA', icon: Coins },

  // C. Biblioteca
  { id: 'biblioteca', label: 'Especialistas Agency', group: 'Biblioteca', icon: BookOpen },

  // D. Administração
  { id: 'admin', label: 'Administração', group: 'Administração', icon: Settings },
];

const GROUPS: NavGroup[] = [
  'Gestão Empresarial',
  'Operações de IA',
  'Biblioteca',
  'Administração',
];

interface AppShellProps {
  activeSection: NavSectionId;
  onSelectSection: (id: NavSectionId) => void;
  onOpenSearch: () => void;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
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
  children,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentItem = NAV_ITEMS.find((i) => i.id === activeSection) ?? NAV_ITEMS[0];

  const renderSidebarBody = (collapsed: boolean) => (
    <div className="flex flex-col h-full bg-surface/95 backdrop-blur-md border-r border-line select-none shadow-[1px_0_24px_-14px_rgba(37,99,235,0.28)]">
      {/* Brand Header */}
      <div className={`h-16 border-b border-line flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        <button
          type="button"
          onClick={() => {
            onSelectSection('executivo');
            setMobileOpen(false);
          }}
          className="flex items-center gap-2.5 text-left cursor-pointer min-w-0"
          title="TokenizAi — Início"
        >
          <span className="w-8 h-8 rounded-lg nc-glow-panel flex items-center justify-center shrink-0">
            <span className="font-display font-bold text-sm text-accent dark:text-cyan-300">T</span>
          </span>
          {!collapsed && (
            <span className="font-display font-bold text-base tracking-tight text-ink whitespace-nowrap truncate">
              TokenizAi
            </span>
          )}
        </button>

        {!collapsed && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            className="hidden lg:inline-flex p-1.5 rounded-lg text-ink-subtle hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer"
            aria-label="Recolher menu lateral"
            title="Recolher menu"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-ink-subtle hover:text-ink cursor-pointer"
          aria-label="Fechar navegação"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Groups */}
      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        {GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((i) => i.group === group);
          return (
            <div key={group} className="space-y-1">
              {!collapsed && (
                <div className="px-2.5 pb-1 text-[11px] font-semibold text-ink-subtle tracking-wide truncate">
                  {group}
                </div>
              )}
              {items.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeSection;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={() => {
                      onSelectSection(item.id);
                      setMobileOpen(false);
                    }}
                    className={`nc-nav-item w-full flex items-center ${
                      collapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
                    } py-2 rounded-xl text-sm cursor-pointer ${
                      active ? 'nc-nav-active font-semibold' : 'font-medium'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-accent dark:text-cyan-300' : 'text-ink-subtle'
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Expand toggle when collapsed */}
      {collapsed && (
        <div className="p-3 border-t border-line hidden lg:flex justify-center">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="p-2 rounded-lg text-ink-subtle hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer"
            aria-label="Expandir menu lateral"
            title="Expandir menu"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex bg-canvas text-ink">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[252px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderSidebarBody(sidebarCollapsed)}</div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/55 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[264px] max-w-[85vw] h-full">
            {renderSidebarBody(false)}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Minimalist Header */}
        <header className="sticky top-0 z-30 h-16 bg-surface/85 backdrop-blur-md border-b border-line px-4 sm:px-8 flex items-center justify-between gap-4">
          {/* Left: Mobile Trigger + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-line-strong text-ink-muted hover:text-ink cursor-pointer"
              aria-label="Abrir navegação"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-ink-subtle hidden sm:inline truncate">{currentItem.group}</span>
              <span className="text-ink-subtle hidden sm:inline" aria-hidden="true">/</span>
              <span className="font-display font-semibold text-ink truncate">{currentItem.label}</span>
            </div>
          </div>

          {/* Right: Contextual Search, Theme Toggle & 1 Primary Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenSearch}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line-strong bg-surface-subtle/70 hover:bg-surface-subtle text-xs text-ink-muted hover:text-ink transition-colors cursor-pointer whitespace-nowrap"
              aria-label="Pesquisar na plataforma"
            >
              <Search className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
              <span className="hidden sm:inline">Buscar</span>
              <kbd className="hidden md:inline font-mono text-[10px] text-ink-subtle">⌘K</kbd>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
              title={isDark ? 'Modo claro' : 'Modo escuro'}
              className="p-2 rounded-lg border border-line-strong text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4 text-highlight" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onPrimaryAction}
              className="nc-primary-btn nc-border-run px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              {primaryActionLabel}
            </button>
          </div>
        </header>

        {/* Viewport Workspace */}
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-8 py-7 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
};
