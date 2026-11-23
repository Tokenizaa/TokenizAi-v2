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
import type { NavSectionId, PaperclipIntegrationStatus } from '../../types/platform';

interface PaperclipStatusPanelProps {
  status: PaperclipIntegrationStatus;
  title?: string;
  requiredCapabilities?: string[];
  onRefresh?: () => void;
  refreshing?: boolean;
  onNavigate?: (sec: NavSectionId) => void;
  compact?: boolean;
}

export const PaperclipStatusPanel: React.FC<PaperclipStatusPanelProps> = ({
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
      requiredCapabilities.includes(c.key) &&
      (c.availableInVersion === false || c.authState === 'forbidden' || c.authState === 'unauthenticated'),
  );

  const isHealthy =
    status.configured &&
    status.reachable &&
    status.authenticated &&
    Boolean(status.companyId) &&
    missingCaps.length === 0;

  if (isHealthy && compact) {
    return null;
  }

  const pickIcon = () => {
    if (status.connectionStatus === 'awaiting_credentials' || status.connectionStatus === 'not_configured') {
      return KeyRound;
    }
    if (status.connectionStatus === 'invalid_credentials') return ShieldAlert;
    if (status.connectionStatus === 'forbidden') return Lock;
    if (status.connectionStatus === 'instance_unavailable' || status.connectionStatus === 'communication_error') {
      return ServerOff;
    }
    if (status.connectionStatus === 'connected') return CheckCircle2;
    if (status.connectionStatus === 'partially_available') return AlertTriangle;
    return PlugZap;
  };

  const Icon = pickIcon();

  const toneBorder =
    status.connectionStatus === 'connected'
      ? 'border-emerald-500/35 bg-emerald-500/5'
      : status.connectionStatus === 'invalid_credentials' || status.connectionStatus === 'instance_unavailable'
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
                {title || 'Integração Paperclip'}
              </h3>
              <span className="font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-md border border-line-strong bg-surface text-highlight">
                {status.connectionLabel}
              </span>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed max-w-2xl">
              {!status.configured &&
                'As variáveis PAPERCLIP_API_URL e PAPERCLIP_API_KEY ainda não estão definidas no ambiente do servidor. Nenhuma informação de agentes ou conversas está sendo simulada.'}
              {status.configured &&
                status.lastError &&
                status.lastError}
              {status.configured &&
                !status.lastError &&
                status.connectionStatus === 'authenticated_no_company' &&
                'Instância alcançada e autenticada, porém nenhum PAPERCLIP_COMPANY_ID foi selecionado ou descoberto automaticamente.'}
              {status.configured &&
                !status.lastError &&
                status.connectionStatus === 'partially_available' &&
                'Conectado ao Paperclip, mas alguns endpoints opcionais não estão presentes nesta versão ou carecem de permissão.'}
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
            <div className="text-ink-subtle">Servidor Paperclip</div>
            <div className="font-mono text-ink mt-0.5 truncate">{status.host || 'Não configurado'}</div>
          </div>
          <div>
            <div className="text-ink-subtle">Empresa Ativa</div>
            <div className="font-medium text-ink mt-0.5 truncate">
              {status.companyName || status.companyId || 'Não selecionada'}
            </div>
          </div>
          <div>
            <div className="text-ink-subtle">Versão / OpenAPI</div>
            <div className="font-mono text-ink mt-0.5">
              {status.serverVersion || '—'} · {status.openApiAvailable ? 'OpenAPI ativo' : 'Indisponível'}
            </div>
          </div>
          <div>
            <div className="text-ink-subtle">Última Sincronização</div>
            <div className="font-mono text-ink mt-0.5">{formatDateTimeBR(status.lastSuccessfulSync)}</div>
          </div>
        </div>
      )}

      {missingCaps.length > 0 && (
        <div className="pt-3 border-t border-line space-y-1.5">
          <div className="text-xs font-semibold text-ink-subtle">Estado das capacidades exigidas nesta tela:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {missingCaps.map((cap) => (
              <div
                key={cap.key}
                className="px-3 py-2 rounded-lg bg-surface-subtle/70 border border-line text-xs flex items-center justify-between gap-2"
              >
                <span className="font-mono text-ink">{cap.key}</span>
                <span className="text-amber-700 dark:text-amber-300 truncate">
                  {cap.authState === 'forbidden'
                    ? 'Sem permissão (403)'
                    : cap.availableInVersion === false
                      ? 'Indisponível nesta versão'
                      : cap.errorMessage || 'Indisponível'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
