/**
 * @file server/services/interdepartment-router.ts
 * Roteador de eventos inter-departamentais para operação autônoma.
 *
 * Conecta departamentos para que o trabalho flua automaticamente entre
 * eles, sem depender de delegações manuais do fundador.
 *
 * Toda transferência possui responsável, contexto, estado e
 * rastreabilidade via event bus e persistência em memória.
 */

import { publish } from '../core/events/topics.ts';
import { createActivity, appendAudit } from '../persistence.ts';

export type DepartmentTransferType =
  | 'marketing_to_commercial'
  | 'commercial_to_marketing'
  | 'support_to_commercial'
  | 'support_to_product'
  | 'product_to_marketing'
  | 'technology_alert'
  | 'director_escalation';

export interface DepartmentTransfer {
  id: string;
  type: DepartmentTransferType;
  fromDepartment: string;
  toDepartment: string;
  responsibleAgent: string;
  context: Record<string, unknown>;
  state: 'pending' | 'in_progress' | 'completed' | 'failed' | 'escalated';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  correlationId?: string;
}

const transfers: Map<string, DepartmentTransfer> = new Map();

function persistTransfer(transfer: DepartmentTransfer): void {
  transfers.set(transfer.id, transfer);
}

async function updateTransferState(
  id: string,
  state: DepartmentTransfer['state'],
  extra?: Partial<DepartmentTransfer>,
): Promise<void> {
  const t = transfers.get(id);
  if (!t) return;
  const updated: DepartmentTransfer = {
    ...t,
    ...extra,
    state,
    updatedAt: new Date().toISOString(),
  };
  if (state === 'completed') updated.completedAt = new Date().toISOString();
  transfers.set(id, updated);

  createActivity({
    actorName: updated.responsibleAgent,
    action: 'transfer.state_changed',
    targetType: 'interdepartment_transfer',
    targetId: id,
    targetName: `${updated.fromDepartment} → ${updated.toDepartment}`,
    summary: `estado: ${state}`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Roteia um lead qualificado do Marketing para o Comercial.
 */
export async function routeMarketingLeadToCommercial(context: {
  leadId: string;
  campaignId?: string;
  qualificationScore: number;
  sourceChannel: string;
  leadData: Record<string, unknown>;
  correlationId?: string;
}): Promise<string> {
  const id = `transfer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const transfer: DepartmentTransfer = {
    id,
    type: 'marketing_to_commercial',
    fromDepartment: 'marketing',
    toDepartment: 'commercial',
    responsibleAgent: 'cco',
    context: {
      leadId: context.leadId,
      campaignId: context.campaignId,
      qualificationScore: context.qualificationScore,
      sourceChannel: context.sourceChannel,
      leadData: context.leadData,
      routedBy: 'marketing-inteligencia',
    },
    state: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    correlationId: context.correlationId,
  };

  persistTransfer(transfer);

  publish('messaging.lead.qualified', {
    transferId: id,
    fromDepartment: 'marketing',
    toDepartment: 'commercial',
    leadId: context.leadId,
    qualificationScore: context.qualificationScore,
    sourceChannel: context.sourceChannel,
    correlationId: context.correlationId,
  }, 'interdepartment_router');

  appendAudit(
    'interdepartment-router',
    `Roteou lead ${context.leadId} Marketing → Comercial`,
    id,
    'Plataforma',
  );

  console.log(
    `[interdepartment] lead ${context.leadId} roteado Marketing → Comercial (score: ${context.qualificationScore})`,
  );
  return id;
}

/**
 * Roteia uma oportunidade comercial do Atendimento para o Comercial.
 */
export async function routeSupportOpportunityToCommercial(context: {
  conversationId: string;
  channel: string;
  customerId?: string;
  opportunityType: string;
  description: string;
  estimatedValue?: number;
  correlationId?: string;
}): Promise<string> {
  const id = `transfer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const transfer: DepartmentTransfer = {
    id,
    type: 'support_to_commercial',
    fromDepartment: 'support',
    toDepartment: 'commercial',
    responsibleAgent: 'cco',
    context: {
      conversationId: context.conversationId,
      channel: context.channel,
      customerId: context.customerId,
      opportunityType: context.opportunityType,
      description: context.description,
      estimatedValue: context.estimatedValue,
      routedBy: 'support-responder',
    },
    state: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    correlationId: context.correlationId,
  };

  persistTransfer(transfer);

  publish('support.opportunity_identified', {
    transferId: id,
    fromDepartment: 'support',
    toDepartment: 'commercial',
    conversationId: context.conversationId,
    opportunityType: context.opportunityType,
    correlationId: context.correlationId,
  }, 'interdepartment_router');

  appendAudit(
    'interdepartment-router',
    `Oportunidade roteada Atendimento → Comercial`,
    id,
    'Plataforma',
  );

  console.log(
    `[interdepartment] oportunidade roteada Atendimento → Comercial (${context.opportunityType})`,
  );
  return id;
}

/**
 * Roteia um problema técnico do Atendimento para o Produto.
 */
export async function routeSupportIssueToProduct(context: {
  conversationId: string;
  channel: string;
  customerId?: string;
  issueType: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  correlationId?: string;
}): Promise<string> {
  const id = `transfer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const transfer: DepartmentTransfer = {
    id,
    type: 'support_to_product',
    fromDepartment: 'support',
    toDepartment: 'product',
    responsibleAgent: 'cto',
    context: {
      conversationId: context.conversationId,
      channel: context.channel,
      customerId: context.customerId,
      issueType: context.issueType,
      description: context.description,
      severity: context.severity,
      routedBy: 'support-responder',
    },
    state: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    correlationId: context.correlationId,
  };

  persistTransfer(transfer);

  publish('support.technical_issue', {
    transferId: id,
    fromDepartment: 'support',
    toDepartment: 'product',
    issueType: context.issueType,
    severity: context.severity,
    correlationId: context.correlationId,
  }, 'interdepartment_router');

  appendAudit(
    'interdepartment-router',
    `Problema técnico roteado Atendimento → Produto`,
    id,
    'Plataforma',
  );

  console.log(
    `[interdepartment] problema técnico roteado Atendimento → Produto (${context.severity})`,
  );
  return id;
}

/**
 * Roteia feedback do Comercial para o Marketing (insights de vendas).
 */
export async function routeCommercialFeedbackToMarketing(context: {
  leadId: string;
  outcome: 'converted' | 'lost' | 'stalled';
  revenue?: number;
  feedback: string;
  correlationId?: string;
}): Promise<string> {
  const id = `transfer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const transfer: DepartmentTransfer = {
    id,
    type: 'commercial_to_marketing',
    fromDepartment: 'commercial',
    toDepartment: 'marketing',
    responsibleAgent: 'cmo',
    context: {
      leadId: context.leadId,
      outcome: context.outcome,
      revenue: context.revenue,
      feedback: context.feedback,
      routedBy: 'cco',
    },
    state: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    correlationId: context.correlationId,
  };

  persistTransfer(transfer);

  publish('commercial.feedback', {
    transferId: id,
    fromDepartment: 'commercial',
    toDepartment: 'marketing',
    leadId: context.leadId,
    outcome: context.outcome,
    correlationId: context.correlationId,
  }, 'interdepartment_router');

  appendAudit(
    'interdepartment-router',
    `Feedback roteado Comercial → Marketing`,
    id,
    'Plataforma',
  );

  console.log(
    `[interdepartment] feedback roteado Comercial → Marketing (${context.outcome})`,
  );
  return id;
}

export function listPendingTransfers(): DepartmentTransfer[] {
  return [...transfers.values()].filter((t) => t.state === 'pending');
}

export function listAllTransfers(): DepartmentTransfer[] {
  return [...transfers.values()];
}

export function getTransfer(id: string): DepartmentTransfer | undefined {
  return transfers.get(id);
}

export const interdepartmentRouter = {
  routeMarketingLeadToCommercial,
  routeSupportOpportunityToCommercial,
  routeSupportIssueToProduct,
  routeCommercialFeedbackToMarketing,
  listPendingTransfers,
  listAllTransfers,
  getTransfer,
  updateTransferState,
};
