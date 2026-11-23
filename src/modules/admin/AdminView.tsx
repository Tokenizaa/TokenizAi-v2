import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  PageHeader,
  SegmentedTabs,
  SlideDrawer,
  StatusText,
  UserAvatar,
} from '../../components/ui/Primitives';
import { AdminAuthApi, formatDateTimeBR, PaperclipApi, PlatformApi, type WorkspaceActorDto } from '../../services/api';
import type {
  AuditLogEntry,
  EnterpriseDataState,
  PaperclipIntegrationStatus,
} from '../../types/platform';

interface AdminViewProps {
  enterprise: EnterpriseDataState;
  paperclipStatus?: PaperclipIntegrationStatus;
  isDark: boolean;
  onToggleTheme: () => void;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
  onRefresh: () => Promise<void>;
  onToast: (msg: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  enterprise,
  paperclipStatus,
  isDark,
  onToggleTheme,
  reducedMotion,
  onToggleReducedMotion,
  onRefresh,
  onToast,
}) => {
  const [tab, setTab] = useState<'usuarios' | 'integracoes' | 'preferencias' | 'geral' | 'auditoria'>('usuarios');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [status, setStatus] = useState<PaperclipIntegrationStatus | null>(paperclipStatus || null);
  const [adminAuth, setAdminAuth] = useState<{
    envConfigured: boolean;
    claimed: boolean;
    authenticated: boolean;
    actor?: WorkspaceActorDto;
  }>({ envConfigured: false, claimed: false, authenticated: false });
  const [passcodeInput, setPasscodeInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const loadDiagnostics = useCallback(async () => {
    try {
      const [pcRes, authRes] = await Promise.all([
        PaperclipApi.getStatus(),
        AdminAuthApi.getStatus(),
      ]);
      setStatus(pcRes.status);
      setAdminAuth({
        envConfigured: authRes.envConfigured,
        claimed: authRes.claimed,
        authenticated: authRes.authenticated,
        actor: authRes.actor,
      });
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha ao consultar diagnóstico Paperclip.');
    }
  }, [onToast]);

  useEffect(() => {
    if (paperclipStatus) setStatus(paperclipStatus);
  }, [paperclipStatus]);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  const handleAdminAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcodeInput.trim()) return;
    setAuthBusy(true);
    try {
      if (!adminAuth.envConfigured && !adminAuth.claimed) {
        await AdminAuthApi.claim(passcodeInput.trim());
        onToast('Credencial administrativa inicializada em memória para esta sessão.');
      } else {
        await AdminAuthApi.login(passcodeInput.trim());
        onToast('Sessão administrativa autenticada.');
      }
      setPasscodeInput('');
      await loadDiagnostics();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Falha na autenticação administrativa.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleAdminLogout = async () => {
    await AdminAuthApi.logout();
    await loadDiagnostics();
    onToast('Sessão administrativa encerrada.');
  };

  const handleRefreshConnection = async () => {
    setChecking(true);
    try {
      const res = await PaperclipApi.refreshConnection();
      setStatus(res.status);
      await onRefresh();
      onToast(`Diagnóstico Paperclip atualizado (${res.status.connectionLabel}).`);
    } catch (err) {
      onToast(
        err instanceof Error
          ? err.message
          : 'Falha ao atualizar conexão Paperclip. Verifique a autenticação administrativa.',
      );
    } finally {
      setChecking(false);
    }
  };

  const handleRoleChange = async (
    userId: string,
    role: EnterpriseDataState['users'][number]['role'],
  ) => {
    try {
      await PlatformApi.updateUserRole(userId, role);
      await onRefresh();
      onToast(`Perfil atualizado para ${role}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar permissão.');
    }
  };

  const handleResetDemo = async () => {
    try {
      await PlatformApi.resetDemoData();
      await onRefresh();
      onToast('Base empresarial restaurada para o estado inicial.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao restaurar base.');
    }
  };

  const statusTone =
    status?.connectionStatus === 'connected'
      ? 'nominal'
      : status?.connectionStatus === 'partially_available' ||
          status?.connectionStatus === 'connecting' ||
          status?.connectionStatus === 'awaiting_credentials' ||
          status?.connectionStatus === 'not_configured'
        ? 'attention'
        : 'critical';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administração & Governança"
        subtitle="Usuários, permissões, integrações de backend, preferências visuais e trilha de auditoria."
      />

      <SegmentedTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'usuarios', label: 'Usuários & Permissões', count: enterprise.users.length },
          { id: 'integracoes', label: 'Integrações' },
          { id: 'preferencias', label: 'Preferências' },
          { id: 'geral', label: 'Configurações Gerais' },
          { id: 'auditoria', label: 'Auditoria & Segurança', count: enterprise.auditLogs.length },
        ]}
      />

      {tab === 'usuarios' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {enterprise.users.map((u) => (
            <div key={u.id} className="nc-card rounded-2xl p-5 flex flex-col justify-between gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar name={u.name} src={u.avatar} size="md" />
                  <div className="min-w-0">
                    <div className="font-display text-sm font-semibold text-ink truncate">{u.name}</div>
                    <div className="text-xs text-ink-subtle truncate">{u.email}</div>
                    <div className="text-xs text-ink-muted mt-0.5">{u.department}</div>
                  </div>
                </div>
                <StatusText label={u.status} tone="nominal" />
              </div>

              <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-[11px] text-ink-subtle">
                  Último acesso: {u.lastAccess}
                </span>
                <select
                  value={u.role}
                  aria-label={`Perfil de acesso de ${u.name}`}
                  onChange={(e) =>
                    handleRoleChange(
                      u.id,
                      e.target.value as EnterpriseDataState['users'][number]['role'],
                    )
                  }
                  className="px-3 py-1.5 rounded-lg border border-line-strong bg-canvas text-xs font-semibold text-ink"
                >
                  <option value="Diretoria Executiva">Diretoria Executiva</option>
                  <option value="Gestor Operacional">Gestor Operacional</option>
                  <option value="Comercial & CRM">Comercial & CRM</option>
                  <option value="Financeiro">Financeiro</option>
                  <option value="Auditor">Auditor</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'integracoes' && (
        <div className="space-y-6">
          <section className="rounded-2xl nc-glow-panel p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-line">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">
                  Integração Nativa Paperclip (Backend Proxy & OpenAPI Discovery)
                </h2>
                <p className="text-xs text-ink-subtle mt-1">
                  Credenciais isoladas exclusivamente no servidor. Nenhuma chave ou token é enviado ou armazenado no navegador.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {status && <StatusText label={status.connectionLabel} tone={statusTone} />}
                <button
                  type="button"
                  onClick={handleRefreshConnection}
                  disabled={checking || !adminAuth.authenticated}
                  title={
                    adminAuth.authenticated
                      ? 'Executar nova sonda OpenAPI / saúde no Paperclip'
                      : 'Autentique a sessão administrativa abaixo para disparar refresh'
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-blue text-xs font-semibold text-ink cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                  <span>Testar & Atualizar Conexão</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-sm">
              <div>
                <div className="text-xs text-ink-subtle">Status Geral</div>
                <div className="font-medium text-ink mt-1">
                  {status?.connectionLabel || 'Consultando...'}
                </div>
                <div className="text-[11px] text-ink-subtle mt-0.5">
                  Host: {status?.host || 'Não definido'}
                </div>
              </div>
              <div>
                <div className="text-xs text-ink-subtle">Empresa / Workspace</div>
                <div className="font-medium text-ink mt-1">
                  {status?.companyName || 'Não vinculada'}
                </div>
                <div className="font-mono text-[11px] text-ink-subtle mt-0.5 truncate">
                  {status?.companyId ? `ID: ${status.companyId}` : 'Aguardando PAPERCLIP_COMPANY_ID'}
                </div>
              </div>
              <div>
                <div className="text-xs text-ink-subtle">Versão & OpenAPI</div>
                <div className="font-medium text-ink mt-1">
                  {status?.serverVersion || 'Não detectada'}
                </div>
                <div className="text-[11px] text-ink-subtle mt-0.5">
                  {status?.openApiAvailable ? 'OpenAPI /api/openapi.json ativo' : 'OpenAPI indisponível'}
                </div>
              </div>
              <div>
                <div className="text-xs text-ink-subtle">Última Sincronização</div>
                <div className="font-medium text-ink mt-1">
                  {status?.lastSuccessfulSync ? formatDateTimeBR(status.lastSuccessfulSync) : 'Nunca sincronizado'}
                </div>
                <div className="font-mono text-[11px] text-ink-subtle mt-0.5">
                  Timeout {status?.requestTimeoutMs || 30000}ms · Sync {status?.syncIntervalMs || 15000}ms
                </div>
              </div>
            </div>

            {status?.lastError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-700 dark:text-red-300">
                Último diagnóstico: {status.lastError}
              </div>
            )}

            {/* Admin session gate for protected POST /api/integrations/paperclip/refresh */}
            <div className="p-4 rounded-xl bg-surface-subtle/60 border border-line flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-ink inline-flex items-center gap-1.5 flex-wrap">
                  <KeyRound className="w-3.5 h-3.5 text-accent dark:text-cyan-300" />
                  <span>Autenticação Administrativa TokenizAi (Sessão em Memória)</span>
                  {adminAuth.actor && (
                    <span className="font-mono text-[11px] font-normal text-accent dark:text-cyan-300">
                      · Ator: {adminAuth.actor.name} ({adminAuth.actor.role})
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-ink-subtle">
                  {adminAuth.authenticated
                    ? 'Sessão administrativa ativa em memória JS. Você pode testar/atualizar a conexão Paperclip e gerir governança.'
                    : !adminAuth.envConfigured && !adminAuth.claimed
                      ? 'Primeiro uso: defina um código administrativo (mín. 8 caracteres) ou configure TOKENIZAI_ADMIN_PASSCODE no servidor.'
                      : 'Informe o código administrativo do servidor para liberar ações de Diretoria Executiva e POST /api/integrations/paperclip/refresh.'}
                </p>
              </div>

              {adminAuth.authenticated ? (
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line-strong bg-surface hover:bg-surface-subtle text-xs font-semibold text-ink cursor-pointer self-start"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Encerrar sessão admin</span>
                </button>
              ) : (
                <form onSubmit={handleAdminAuthSubmit} className="flex items-center gap-2">
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    placeholder={
                      !adminAuth.envConfigured && !adminAuth.claimed
                        ? 'Criar senha admin (8+)'
                        : 'Senha administrativa'
                    }
                    className="px-3 py-2 rounded-lg border border-line-strong bg-canvas text-xs text-ink w-48"
                  />
                  <button
                    type="submit"
                    disabled={authBusy || passcodeInput.trim().length < 8}
                    className="nc-primary-btn px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-45"
                  >
                    {authBusy
                      ? 'Validando...'
                      : !adminAuth.envConfigured && !adminAuth.claimed
                        ? 'Inicializar'
                        : 'Autenticar'}
                  </button>
                </form>
              )}
            </div>

            <div className="p-4 rounded-xl bg-surface-subtle/50 border border-line text-xs text-ink-muted space-y-2">
              <div className="font-semibold text-ink">Variáveis de ambiente esperadas no servidor backend:</div>
              <div className="font-mono text-[11px] space-y-1 text-ink-subtle">
                <div>PAPERCLIP_API_URL=https://sua-instancia-paperclip</div>
                <div>PAPERCLIP_API_KEY=*** (token Bearer no servidor)</div>
                <div>PAPERCLIP_COMPANY_ID=id-da-organizacao</div>
                <div>PAPERCLIP_REQUEST_TIMEOUT_MS=30000</div>
                <div>PAPERCLIP_SYNC_INTERVAL_MS=15000</div>
                <div>TOKENIZAI_ADMIN_PASSCODE=*** (opcional para proteger refresh administrativo)</div>
              </div>
            </div>
          </section>

          {status && status.availableCapabilities.length > 0 && (
            <section className="rounded-2xl nc-card p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-semibold text-ink">
                    Matriz de Capacidades OpenAPI & Permissões ({status.availableCapabilities.length})
                  </h3>
                  <p className="text-xs text-ink-subtle mt-0.5">
                    Detectado dinamicamente via GET /api/openapi.json e respostas reais da API Paperclip.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {status.availableCapabilities.map((cap) => (
                  <div
                    key={cap.key}
                    className="p-3 rounded-xl bg-surface-subtle/50 border border-line flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-ink truncate">{cap.label}</div>
                      <div className="font-mono text-[10px] text-ink-subtle truncate mt-0.5">
                        {cap.method} {cap.route}
                      </div>
                    </div>
                    <StatusText
                      label={
                        cap.implementationState === 'implemented'
                          ? 'Ativo'
                          : cap.implementationState === 'partial'
                            ? 'Parcial'
                            : 'Indisponível'
                      }
                      tone={
                        cap.implementationState === 'implemented'
                          ? 'nominal'
                          : cap.implementationState === 'partial'
                            ? 'attention'
                            : 'neutral'
                      }
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'preferencias' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="nc-card rounded-2xl p-6 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-ink">Tema da Interface</div>
              <div className="text-xs text-ink-subtle mt-1">
                Alterne entre o modo claro corporativo e o modo escuro com realce ciano/azul.
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="px-4 py-2 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer shrink-0"
            >
              {isDark ? 'Modo Claro' : 'Modo Escuro'}
            </button>
          </div>

          <div className="nc-card rounded-2xl p-6 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-ink">Redução de Movimento</div>
              <div className="text-xs text-ink-subtle mt-1">
                Desativa animações contínuas nas bordas luminosas e transições de painel.
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleReducedMotion}
              className="px-4 py-2 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer shrink-0"
            >
              {reducedMotion ? 'Ativo' : 'Ativar'}
            </button>
          </div>
        </div>
      )}

      {tab === 'geral' && (
        <section className="rounded-2xl nc-card p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm pb-6 border-b border-line">
            <div>
              <div className="text-xs text-ink-subtle">Organização</div>
              <div className="font-medium text-ink mt-1">TokenizAi Tecnologia Corporativa Ltda.</div>
            </div>
            <div>
              <div className="text-xs text-ink-subtle">CNPJ Principal</div>
              <div className="font-mono text-ink mt-1">51.204.980/0001-12</div>
            </div>
            <div>
              <div className="text-xs text-ink-subtle">Moeda & Fuso Horário</div>
              <div className="text-ink mt-1">BRL (R$) · America/Sao_Paulo</div>
            </div>
            <div>
              <div className="text-xs text-ink-subtle">Política de Retenção de Auditoria</div>
              <div className="text-ink mt-1">365 dias contínuos</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-ink">Ambiente Demonstrativo</div>
              <div className="text-xs text-ink-subtle mt-0.5">
                Restaure projetos, clientes, lançamentos e fila Paperclip ao estado padrão da sessão.
                {!adminAuth.authenticated && ' Requer sessão administrativa ativa em Integrações.'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetDemo}
              disabled={!adminAuth.authenticated}
              title={
                adminAuth.authenticated
                  ? 'Restaurar base demonstrativa empresarial'
                  : 'Autentique a sessão administrativa em Integrações para restaurar a base'
              }
              className="px-4 py-2 rounded-lg border border-line-strong text-xs font-semibold text-ink hover:bg-surface-blue cursor-pointer self-start disabled:opacity-45 disabled:cursor-not-allowed"
            >
              Restaurar base demonstrativa
            </button>
          </div>
        </section>
      )}

      {tab === 'auditoria' && (
        <section className="rounded-2xl nc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-[11px] font-semibold text-ink-subtle bg-surface-subtle/40">
                  <th className="py-3 px-6">Data / Hora</th>
                  <th className="py-3 px-4">Ator</th>
                  <th className="py-3 px-4">Ação Executada</th>
                  <th className="py-3 px-4">Alvo</th>
                  <th className="py-3 px-6 text-right">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {enterprise.auditLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-surface-blue/35 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-6 font-mono text-xs text-ink-subtle whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-ink">{log.actor}</td>
                    <td className="py-3.5 px-4 text-ink-muted">{log.action}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-ink-subtle">{log.target}</td>
                    <td className="py-3.5 px-6 text-right text-xs text-highlight font-medium whitespace-nowrap">
                      {log.origin}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <SlideDrawer
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Registro de Auditoria"
        subtitle={selectedLog ? `${selectedLog.origin} · ${selectedLog.timestamp}` : undefined}
      >
        {selectedLog && (
          <div className="space-y-4 text-sm">
            <div className="p-4 rounded-xl bg-surface-subtle/50 border border-line flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-accent dark:text-cyan-300 shrink-0" />
              <div>
                <div className="font-semibold text-ink">{selectedLog.action}</div>
                <div className="text-xs text-ink-subtle mt-0.5">Evento registrado na trilha imutável da sessão</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 py-3 border-y border-line">
              <div>
                <div className="text-xs text-ink-subtle">Ator</div>
                <div className="font-medium text-ink mt-0.5">{selectedLog.actor}</div>
              </div>
              <div>
                <div className="text-xs text-ink-subtle">Origem</div>
                <div className="font-medium text-highlight mt-0.5">{selectedLog.origin}</div>
              </div>
              <div>
                <div className="text-xs text-ink-subtle">Alvo</div>
                <div className="font-mono text-xs text-ink mt-0.5">{selectedLog.target}</div>
              </div>
              <div>
                <div className="text-xs text-ink-subtle">Data / Hora</div>
                <div className="font-mono text-xs text-ink mt-0.5">{selectedLog.timestamp}</div>
              </div>
            </div>
          </div>
        )}
      </SlideDrawer>
    </div>
  );
};
