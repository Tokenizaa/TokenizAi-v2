import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, PauseCircle, X } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-line">
    <div className="space-y-1 min-w-0">
      <h1 className="font-display text-2xl sm:text-[1.75rem] font-semibold text-ink tracking-tight text-balance">
        {title}
      </h1>
      <p className="text-sm text-ink-muted max-w-2xl">{subtitle}</p>
    </div>
    {actions && <div className="flex items-center gap-3 shrink-0 flex-wrap">{actions}</div>}
  </div>
);

interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export function SegmentedTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-surface-subtle/90 border border-line-strong max-w-full overflow-x-auto"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              isActive
                ? 'nc-tab-active font-semibold'
                : 'text-ink-muted hover:text-ink border border-transparent hover:bg-surface/40'
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={`ml-1.5 font-mono tabular-nums text-[11px] ${
                  isActive ? 'text-accent dark:text-cyan-300' : 'text-ink-subtle'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

type SemanticTone = 'nominal' | 'attention' | 'critical' | 'neutral';

export const StatusText: React.FC<{
  label: string;
  tone?: SemanticTone;
}> = ({ label, tone = 'neutral' }) => {
  const toneStyles: Record<SemanticTone, string> = {
    nominal: 'text-emerald-700 dark:text-emerald-400',
    attention: 'text-amber-700 dark:text-amber-300',
    critical: 'text-red-700 dark:text-red-400',
    neutral: 'text-ink-muted',
  };

  const Icon =
    tone === 'nominal'
      ? CheckCircle2
      : tone === 'attention'
        ? PauseCircle
        : tone === 'critical'
          ? AlertTriangle
          : Info;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${toneStyles[tone]}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

interface SlideDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}

export const SlideDrawer: React.FC<SlideDrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-slate-950/55 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 w-full ${
          wide ? 'max-w-2xl' : 'max-w-xl'
        } h-full nc-glow-panel !border-y-0 !border-r-0 shadow-2xl flex flex-col`}
      >
        <div className="px-6 py-5 border-b border-line flex items-start justify-between gap-4 bg-surface-subtle/40">
          <div className="min-w-0">
            {subtitle && <p className="text-xs text-ink-subtle truncate">{subtitle}</p>}
            <h2 className="font-display text-lg font-semibold text-ink mt-0.5 truncate">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            className="p-2 rounded-lg border border-line-strong text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-line bg-surface-subtle/50 flex items-center justify-end gap-3 flex-wrap">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
};

export const DemoNoticeBanner: React.FC<{
  reason?: string;
  onConfigureClick?: () => void;
}> = ({ reason, onConfigureClick }) => (
  <div className="rounded-xl nc-card bg-surface-blue/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div className="flex items-start gap-2.5 text-xs text-ink-muted">
      <Info className="w-4 h-4 text-highlight shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <span className="font-semibold text-ink">Modo Demonstrativo (Hermes offline): </span>
        <span>
          {reason ||
            'Nenhuma instância Hermes conectada no backend. Os agentes e execuções abaixo representam dados demonstrativos isolados.'}
        </span>
      </div>
    </div>
    {onConfigureClick && (
      <button
        type="button"
        onClick={onConfigureClick}
        className="text-xs font-semibold text-highlight hover:underline whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-center"
      >
        Ver configuração
      </button>
    )}
  </div>
);

export const UserAvatar: React.FC<{
  name: string;
  src?: string;
  size?: 'sm' | 'md';
}> = ({ name, src, size = 'sm' }) => {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  const dim = size === 'md' ? 'w-9 h-9 text-xs' : 'w-7 h-7 text-[11px]';

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${dim} rounded-full object-cover border border-line-strong shrink-0`}
      />
    );
  }

  return (
    <span
      aria-label={name}
      className={`${dim} rounded-full bg-surface-blue border border-line-strong text-ink font-display font-semibold inline-flex items-center justify-center shrink-0`}
    >
      {initials || 'TK'}
    </span>
  );
};
