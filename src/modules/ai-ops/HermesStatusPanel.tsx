import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Lock,
  PlugZap,
  RefreshCw,
  ServerOff,
  ShieldAlert,
} from 'lucide-react';
import { formatDateTimeBR } from '../../services/api';
import type { NavSectionId, HermesIntegrationStatus } from '../../types/platform';

interface HermesStatusPanelProps {
  status: HermesIntegrationStatus;
  title?: string;
  requiredCapabilities?: string[];
  onRefresh?: () => void;
  refreshing?: boolean;
  onNavigate?: (sec: NavSectionId) => void;
  compact?: boolean;
}

export const HermesStatusPanel: React.FC<HermesStatusPanelProps> = ({
  status,
  title,
  requiredCapabilities = [],
  onRefresh,
  refreshing = false,
  onNavigate,
  compact = false,
}) => {
  const missingCaps = status.availableCapabilities.filter(
    (c) =>
      requiredCapabilities.includes(c.key) && !c.available,
  );

  const isHealthy =
    status.configured &&
    status.connected &&
    missingCaps.length === 0;

  if (isHealthy && compact) {
    return null;
  }

  const pickIcon = () => {
    if (status.connectionStatus === 'not_configured') {
      return KeyRound;
    }
    if (status.connectionStatus === 'disconnected') return ShieldAlert;
    if (status.connectionStatus === 'error') return Lock;
    if (status.connectionStatus === 'connected') return CheckCircle2;
    return PlugZap;
  };

  const Icon = pickIcon();

  const toneBorder =
    status.connectionStatus === 'connected'
      ? 'border-emerald-500/35 bg-emerald-500/5'
      : status.connectionStatus === 'disconnected' ||
        status.connectionStatus === 'error'
        ? 'border-red-500/35 bg-red-500/5'
        : 'border-amber-500/35 bg-surface-blue/65';

  return (
    <div className={`nc-card rounded-2xl p-6 space-y-4 border ${toneBorder}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl nc-glow-panel flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-accent dark:text-cyan-300" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold text-ink">
                {title || 'Integração Hermes'}
              </h3>
              <span className="font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-md border border-line-strong bg-surface text-highlight">
                {status.connectionLabel}
              </span>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed max-w-2xl">
              {!status.configured &&
                'O Hermes ainda não está configurado no servidor. Nenhuma informação de agentes ou conversas está sendo simulada.'}
              {status.configured &&
                status.lastError &&
                status.lastError}
              {status.configured &&
                !status.lastError &&
                status.connectionStatus === 'disconnected' &&
                'Hermes configurado, mas não conectado ao runtime.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          )}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="nc-primary-btn px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Diagnóstico em Administração
            </button>
          )}
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-line text-xs">
          <div>
            <div className="text-ink-subtle">Runtime Hermes</div>
            <div className="font-mono text-ink mt-0.5 truncate">
              {status.connected ? 'Conectado' : 'Desconectado'}
            </div>
          </div>
          <div>
            <div className="text-ink-subtle">Capacidades</div>
            <div className="font-medium text-ink mt-0.5 truncate">
              {status.availableCapabilities.filter((c) => c.available).length}/{status.availableCapabilities.length}
            </div>
          </div>
          <div>
            <div className="text-ink-subtle">Status</div>
            <div className="font-mono text-ink mt-0.5">
              {status.connectionStatus === 'connected' ? 'Operacional' : 'Indisponível'}
            </div>
          </div>
          <div>
            <div className="text-ink-subtle">Último Erro</div>
            <div className="font-mono text-ink mt-0.5 truncate">
              {status.lastError || 'Nenhum'}
            </div>
          </div>
        </div>
      )}

      {missingCaps.length > 0 && (
        <div className="pt-3 border-t border-line space-y-1.5">
          <div className="text-xs font-semibold text-ink-subtle">
            Estado das capacidades exigidas nesta tela:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {missingCaps.map((cap) => (
              <div
                key={cap.key}
                className="px-3 py-2 rounded-lg bg-surface-subtle/70 border border-line text-xs flex items-center justify-between gap-2"
              >
                <span className="font-mono text-ink">{cap.key}</span>
                <span className="text-amber-700 dark:text-amber-300 truncate">
                  {!cap.available ? 'Indisponível' : cap.errorMessage || 'Indisponível'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
