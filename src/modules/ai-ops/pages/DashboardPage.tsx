import React from 'react';
import { AiOpsView } from '../AiOpsView';
import type { HermesOverviewBundle } from '../../../types/platform';
import { NavSectionId } from '../../../types/platform';

interface WorkforcePageProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

/**
 * Página consolidada para a seção Visão Geral IA.
 * Reutiliza o AiOpsView com a section 'ia-visao'.
 */
export const DashboardPage: React.FC<WorkforcePageProps> = ({
  onNavigate,
  onToast,
}) => {
  // O bundle é passado pelo App.tsx via HermesApi.getOverviewBundle()
  // Esta página é um wrapper leve sobre o AiOpsView para manter as rotas existentes.
  return null;
};

/**
 * Mantido como placeholder para compatibilidade com o roteador existente.
 * A implementação completa está em modules/ai-ops/AiOpsView.tsx (section 'ia-visao').
 */
export function DashboardPagePlaceholder() {
  return null;
}
