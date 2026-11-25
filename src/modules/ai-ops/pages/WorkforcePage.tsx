import React, { useCallback, useEffect, useState } from 'react';
import { AiOpsView } from '../AiOpsView';
import { hermesService } from '../../ai-workforce/services/hermes';
import type { HermesOverviewBundle } from '../../../types/platform';

export interface WorkforcePageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

type AiOpsSectionId =
  | 'ia-visao'
  | 'ia-chat'
  | 'ia-agentes'
  | 'ia-equipes'
  | 'ia-tarefas'
  | 'ia-execucoes'
  | 'ia-rotinas'
  | 'ia-aprovacoes'
  | 'ia-custos';

/**
 * Página base consolidada para operações de IA.
 * Obtém o bundle do Hermes e delega a renderização ao AiOpsView,
 * que encapsula todos os painéis domain (agentes, tarefas, execuções,
 * rotinas, aprovações, custos, organização, chat, visão geral).
 */
function WorkforcePageBase({ section, onNavigate, onToast }: WorkforcePageProps & { section: AiOpsSectionId }) {
  const [bundle, setBundle] = useState<HermesOverviewBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hermesService.getOverviewBundle();
      setBundle(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar o bundle do Paperclip.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !bundle || error) return null;

  return <AiOpsView section={section} bundle={bundle} onRefresh={load} onNavigate={onNavigate} onToast={onToast} />;
}

export function WorkforcePage({ section, ...rest }: WorkforcePageProps & { section: AiOpsSectionId }) {
  return <WorkforcePageBase section={section} {...rest} />;
}
