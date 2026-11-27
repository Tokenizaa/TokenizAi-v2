/**
 * @file server/core/events/topics.ts
 * Event bus em memória para comunicação assíncrona entre departamentos,
 * rotinas, workers e o orquestrador de execução autônoma.
 *
 * Permite que qualquer parte do sistema publique eventos e que outras
 * partes se inscrevam para reagir, sem depender de chamadas diretas
 * entre componentes. Funciona como backbone da operação autônoma.
 */

export type EventHandler<T = Record<string, unknown>> = (payload: T) => void | Promise<void>;

interface Subscription<T = Record<string, unknown>> {
  id: string;
  topic: string;
  handler: EventHandler<T>;
  once: boolean;
}

const subscriptions: Subscription[] = [];
let nextId = 0;

/**
 * Publica um evento em um tópico. Todos os handlers inscritos são
 * executados. Erros em um handler não interrompem os outros.
 */
function publish<T = Record<string, unknown>>(
  topic: string,
  payload: T,
  source = 'event_bus',
): void {
  const toRun = subscriptions.filter((s) => s.topic === topic);
  for (const sub of toRun) {
    try {
      const result = sub.handler(payload as any);
      if (result && typeof result.then === 'function') {
        result.catch((err) => {
          // Erro de handler assíncrono não derruba o event bus
          console.error(`[event_bus] handler erro no tópico "${topic}" (${sub.id}):`, err);
        });
      }
    } catch (err) {
      console.error(`[event_bus] handler erro no tópico "${topic}" (${sub.id}):`, err);
    }
    if (sub.once) {
      const idx = subscriptions.indexOf(sub);
      if (idx !== -1) subscriptions.splice(idx, 1);
    }
  }
}

/**
 * Inscreve um handler em um tópico. Retorna um id que pode ser usado
 * para cancelar a inscrição com `unsubscribe`.
 */
function subscribe<T = Record<string, unknown>>(
  topic: string,
  handler: EventHandler<T>,
  { once = false }: { once?: boolean } = {},
): string {
  const id = `sub_${Date.now()}_${nextId++}`;
  subscriptions.push({ id, topic, handler: handler as EventHandler, once });
  return id;
}

/**
 * Cancela uma inscrição por id.
 */
function unsubscribe(id: string): boolean {
  const idx = subscriptions.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  subscriptions.splice(idx, 1);
  return true;
}

/**
 * Remove todas as inscrições de um tópico.
 */
function clearTopic(topic: string): number {
  let removed = 0;
  for (let i = subscriptions.length - 1; i >= 0; i--) {
    if (subscriptions[i].topic === topic) {
      subscriptions.splice(i, 1);
      removed++;
    }
  }
  return removed;
}

/**
 * Tópicos padronizados da operação autônoma da TokenizAi.
 */
export const EventTopics = {
  // Ciclos de departamento
  DEPARTMENT_COMMERCIAL_HEARTBEAT: 'department.commercial.heartbeat',
  DEPARTMENT_SUPPORT_HEARTBEAT: 'department.support.heartbeat',
  DEPARTMENT_PRODUCT_HEARTBEAT: 'department.product.heartbeat',
  DEPARTMENT_TECHNOLOGY_HEARTBEAT: 'department.technology.heartbeat',
  DEPARTMENT_DESIGN_HEARTBEAT: 'department.design.heartbeat',
  DEPARTMENT_RESEARCH_HEARTBEAT: 'department.research.heartbeat',
  DEPARTMENT_DIRECTORATE_HEARTBEAT: 'department.directorate.heartbeat',

  // Ciclo de marketing
  MARKETING_CYCLE_TICK: 'marketing.cycle.tick',

  // Transferências inter-departamentos
  MESSAGING_LEAD_QUALIFIED: 'messaging.lead.qualified',
  SUPPORT_OPPORTUNITY_IDENTIFIED: 'support.opportunity.identified',
  SUPPORT_TECHNICAL_ISSUE: 'support.technical.issue',
  COMMERCIAL_FEEDBACK: 'commercial.feedback',

  // Sistema e monitoramento
  SYSTEM_ALERT: 'system.alert',
  QUEUE_ITEM_COMPLETED: 'queue.item.completed',
  QUEUE_ITEM_FAILED: 'queue.item.failed',
  AGENT_IDLE_DETECTED: 'agent.idle.detected',
} as const;

export { publish, subscribe, unsubscribe, clearTopic };
