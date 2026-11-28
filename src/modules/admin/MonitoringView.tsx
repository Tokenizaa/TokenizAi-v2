/**
 * @file src/modules/admin/MonitoringView.tsx
 * Página de monitoramento operacional da TokenizAi — operação autônoma.
 *
 * Exibe o estado do orquestrador de execução, fila de trabalho,
 * health do sistema, alertas e permite criar itens na fila manualmente.
 */

import { useCallback, useEffect, useState } from 'react';
import { monitoringService } from '../../services/monitoring.ts';

interface Props {
  onToast: (msg: string) => void;
}

export default function MonitoringView({ onToast }: Props) {
  const [overview, setOverview] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'baixa' | 'media' | 'alta' | 'critica'>('media');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, h, w] = await Promise.all([
        monitoringService.getOperationalOverview(),
        monitoringService.getQueueHealth(),
        monitoringService.getDepartmentWorkers(),
      ]);
      setOverview(o);
      setHealth(h);
      setWorkers(w.workers || []);
    } catch (err: any) {
      onToast(`Erro ao carregar monitoramento: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await monitoringService.createQueueItem({
        title: newTitle.trim(),
        description: 'Item criado via interface de monitoramento',
        priority: newPriority,
        triggerSource: 'manual',
        dependencies: [],
      });
      setNewTitle('');
      await load();
      onToast('Item criado na fila de execução autônoma.');
    } catch (err: any) {
      onToast(`Erro ao criar item: ${err.message}`);
    }
  };

  const severityColor = (s: string) => {
    switch (s) {
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'warning': return 'text-amber-600 dark:text-amber-400';
      default: return 'text-blue-600 dark:text-blue-400';
    }
  };

  if (!overview) {
    return (
      <div className="rounded-2xl p-8 text-center text-ink">
        <h2 className="font-display text-xl font-semibold">Monitoramento Operacional</h2>
        <p className="text-sm text-ink-muted">Carregando...</p>
      </div>
    );
  }

  const q = overview.queue;
  const sys = overview.system;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Monitoramento Operacional</h1>
        <p className="text-sm text-ink-muted">
          Operação autônoma da TokenizAi — orquestrador, fila de trabalho e health do sistema.
        </p>
      </div>

      {/* Status do sistema */}
      <div className="rounded-xl border border-line p-4 bg-surface">
        <h2 className="text-sm font-semibold text-ink mb-3">Sistema</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-ink-muted">Status</div>
            <div className={`font-semibold ${sys.status === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
              {sys.status.toUpperCase()}
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-muted">Hermes</div>
            <div className={`font-semibold ${sys.hermes.connected ? 'text-green-600' : 'text-red-600'}`}>
              {sys.hermes.connected ? 'Conectado' : 'Desconectado'}
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-muted">Uptime</div>
            <div className="font-semibold">
              {(sys.uptimeMs / 1000 / 60).toFixed(0)} min
            </div>
          </div>
        </div>
      </div>

      {/* Fila de execução */}
      <div className="rounded-xl border border-line p-4 bg-surface">
        <h2 className="text-sm font-semibold text-ink mb-3">Fila de Execução Autônoma</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
          <div className="text-center p-2 rounded-lg border border-line">
            <div className="text-xs text-ink-muted">Pendente</div>
            <div className="font-semibold text-blue-600">{q.pending}</div>
          </div>
          <div className="text-center p-2 rounded-lg border border-line">
            <div className="text-xs text-ink-muted">Executando</div>
            <div className="font-semibold text-amber-600">{q.runningCount}</div>
          </div>
          <div className="text-center p-2 rounded-lg border border-line">
            <div className="text-xs text-ink-muted">Concluído</div>
            <div className="font-semibold text-green-600">{q.completed}</div>
          </div>
          <div className="text-center p-2 rounded-lg border border-line">
            <div className="text-xs text-ink-muted">Falhou</div>
            <div className={`font-semibold ${q.failed > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {q.failed}
            </div>
          </div>
          <div className="text-center p-2 rounded-lg border border-line">
            <div className="text-xs text-ink-muted">Orquestrador</div>
            <div className={`font-semibold ${q.running ? 'text-green-600' : 'text-red-600'}`}>
              {q.running ? 'Ativo' : 'Parado'}
            </div>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {overview.alerts && overview.alerts.length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900 mb-2">Alertas</h2>
          <ul className="space-y-2 text-sm">
            {overview.alerts.map((a: any, i: number) => (
              <li key={i} className={`flex items-start gap-2 ${severityColor(a.severity)}`}>
                <span className="flex-shrink-0 mt-0.5">⚠</span>
                <span>{a.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Criar item na fila */}
      <div className="rounded-xl border border-line p-4 bg-surface">
        <h2 className="text-sm font-semibold text-ink mb-3">Criar item na fila</h2>
        <form onSubmit={handleCreateItem} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-ink-muted mb-1">Título</label>
              <input
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Validar fila de execução"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-muted mb-1">Prioridade</label>
              <select
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as any)}
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading || refreshing}
                className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {refreshing ? 'Processando...' : 'Criar item'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Health */}
      {health && (
        <div className="rounded-xl border border-line p-4 bg-surface">
          <h2 className="text-sm font-semibold text-ink mb-3">Health da Fila</h2>
          <div className={`flex items-center gap-2 ${health.healthy ? 'text-green-600' : 'text-red-600'}`}>
            <span>{health.healthy ? '✓' : '⚠'}</span>
            <span className="font-semibold">
              {health.healthy ? 'Saudável' : 'Problemas detectados'}
            </span>
          </div>
          {health.issues && health.issues.length > 0 && (
            <ul className="mt-2 text-sm text-ink-muted space-y-1">
              {health.issues.map((i: string, idx: number) => (
                <li key={idx}>• {i}</li>
              ))}
            </ul>
          )}
          {overview?.costs && (
            <div className="mt-4 text-sm">
              <div className="text-xs text-ink-muted mb-1">Custos de execução</div>
              <div className="flex gap-4">
                <div>
                  <div className="font-semibold">Total (BRL)</div>
                  <div className="text-ink">
                    R$ {(overview.costs.totalCents / 100).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="font-semibold">Últimas 24h</div>
                  <div className="text-ink">
                    R$ {(overview.costs.last24hCents / 100).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Workers de departamento */}
      {workers.length > 0 && (
        <div className="rounded-xl border border-line p-4 bg-surface">
          <h2 className="text-sm font-semibold text-ink mb-3">Workers de Departamento</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="pb-2 text-xs text-ink-muted">Worker</th>
                  <th className="pb-2 text-xs text-ink-muted">Intervalo</th>
                  <th className="pb-2 text-xs text-ink-muted">Última execução</th>
                  <th className="pb-2 text-xs text-ink-muted">Execuções</th>
                  <th className="pb-2 text-xs text-ink-muted">Erros</th>
                  <th className="pb-2 text-xs text-ink-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.name} className="border-b border-line/50">
                    <td className="py-2 text-ink">{w.name}</td>
                    <td className="py-2 text-ink-muted">
                      {(w.intervalMs / 1000 / 60).toFixed(0)} min
                    </td>
                    <td className="py-2 text-ink-muted">
                      {w.lastRun ? new Date(w.lastRun).toLocaleTimeString() : '—'}
                    </td>
                    <td className="py-2 text-ink">{w.runCount}</td>
                    <td className="py-2 text-ink-muted">
                      {w.errorCount > 0 ? w.errorCount : 0}
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        w.isRunning ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {w.isRunning ? 'Ativo' : 'Ocioso'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="nc-secondary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
      >
        {refreshing ? 'Atualizando...' : 'Atualizar agora'}
      </button>
    </div>
  );
}
