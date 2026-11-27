/**
 * @file server/services/department-routines.ts
 * Rotinas autônomas por departamento para operação contínua da TokenizAi.
 *
 * Cada departamento possui ciclos permanentes de trabalho que executam
 * independentemente de delegações manuais do fundador. Publicam
 * heartbeats no event bus e delegam itens para a fila de execução
 * quando identificam trabalho útil.
 */

import {
  createQueueItem,
  listPendingQueueItems,
} from './execution-queue.ts';
import { appendAudit, createActivity } from '../persistence.ts';
import {
  publish,
  EventTopics,
} from '../core/events/topics.ts';

interface DepartmentRoutine {
  department: string;
  intervalMs: number;
  timer: ReturnType<typeof setInterval> | null;
  lastRun: string | null;
  runCount: number;
  isRunning: boolean;
}

const routines: Map<string, DepartmentRoutine> = new Map();

function startRoutine(
  department: string,
  intervalMs: number,
  fn: () => Promise<void>,
): void {
  if (routines.has(department)) {
    console.warn(`[departments] rotina ${department} já iniciada`);
    return;
  }

  const routine: DepartmentRoutine = {
    department,
    intervalMs,
    timer: null,
    lastRun: null,
    runCount: 0,
    isRunning: false,
  };

  routine.timer = setInterval(async () => {
    if (routine.isRunning) return;
    routine.isRunning = true;
    try {
      routine.runCount++;
      routine.lastRun = new Date().toISOString();
      await fn().catch((err) => {
        console.error(`[departments] rotina ${department} falhou:`, err);
        publish(EventTopics.SYSTEM_ALERT, {
          severity: 'error',
          message: `Rotina ${department} falhou: ${err instanceof Error ? err.message : String(err)}`,
          department,
          timestamp: new Date().toISOString(),
        }, 'department-routines');
      });
    } finally {
      routine.isRunning = false;
    }
  }, intervalMs);

  routines.set(department, routine);
  console.log(`[departments] rotina ${department} iniciada (intervalo: ${intervalMs}ms)`);
}

function stopRoutine(department: string): void {
  const r = routines.get(department);
  if (r?.timer) {
    clearInterval(r.timer);
    r.timer = null;
  }
  routines.delete(department);
  console.log(`[departments] rotina ${department} parada`);
}

function getRoutineStatus() {
  return [...routines.values()].map((r) => ({
    department: r.department,
    intervalMs: r.intervalMs,
    lastRun: r.lastRun,
    runCount: r.runCount,
    isRunning: r.isRunning,
  }));
}

// ============================================================================
// DEPARTAMENTO: COMERCIAL
// Ciclo: follow-up de leads, nurturing, conversão de oportunidades
// ============================================================================
function commercialRoutine(): Promise<void> {
  return new Promise((resolve) => {
    const pending = listPendingQueueItems().filter(
      (i) => i.departmentName === 'comercial' || i.departmentId?.includes('com'),
    );
    if (pending.length > 0) {
      publish(EventTopics.DEPARTMENT_COMMERCIAL_HEARTBEAT, {
        timestamp: new Date().toISOString(),
        active: true,
        pendingItems: pending.length,
      }, 'department-routines');
    }
    console.debug('[departments] ciclo comercial executado');
    resolve();
  });
}

// ============================================================================
// DEPARTAMENTO: ATENDIMENTO
// Ciclo: classificar mensagens, responder, encaminhar
// ============================================================================
function supportRoutine(): Promise<void> {
  return new Promise((resolve) => {
    console.debug('[departments] ciclo de atendimento executado');
    publish(EventTopics.DEPARTMENT_SUPPORT_HEARTBEAT, {
      timestamp: new Date().toISOString(),
      active: true,
    }, 'department-routines');
    resolve();
  });
}

// ============================================================================
// DEPARTAMENTO: PRODUTO
// Ciclo: backlog, feedback, priorização de melhorias
// ============================================================================
function productRoutine(): Promise<void> {
  return new Promise((resolve) => {
    console.debug('[departments] ciclo de produto executado');
    publish(EventTopics.DEPARTMENT_PRODUCT_HEARTBEAT, {
      timestamp: new Date().toISOString(),
      active: true,
    }, 'department-routines');
    resolve();
  });
}

// ============================================================================
// DEPARTAMENTO: TECNOLOGIA
// Ciclo: monitoramento, incidentes, testes, integrações
// ============================================================================
function technologyRoutine(): Promise<void> {
  return new Promise((resolve) => {
    console.debug('[departments] ciclo de tecnologia executado');
    publish(EventTopics.DEPARTMENT_TECHNOLOGY_HEARTBEAT, {
      timestamp: new Date().toISOString(),
      active: true,
    }, 'department-routines');
    resolve();
  });
}

// ============================================================================
// DEPARTAMENTO: DESIGN E MARCA
// Ciclo: identidade visual, materiais para departamentos
// ============================================================================
function designRoutine(): Promise<void> {
  return new Promise((resolve) => {
    console.debug('[departments] ciclo de design executado');
    publish(EventTopics.DEPARTMENT_DESIGN_HEARTBEAT, {
      timestamp: new Date().toISOString(),
      active: true,
    }, 'department-routines');
    resolve();
  });
}

// ============================================================================
// DEPARTAMENTO: PESQUISA
// Ciclo: concorrência, mercado, legislação, inteligência
// ============================================================================
function researchRoutine(): Promise<void> {
  return new Promise((resolve) => {
    console.debug('[departments] ciclo de pesquisa executado');
    publish(EventTopics.DEPARTMENT_RESEARCH_HEARTBEAT, {
      timestamp: new Date().toISOString(),
      active: true,
    }, 'department-routines');
    resolve();
  });
}

// ============================================================================
// DEPARTAMENTO: DIRETORIA
// Ciclo: acompanhar KPIs, resolver conflitos, prestação de contas
// ============================================================================
function directorateRoutine(): Promise<void> {
  return new Promise((resolve) => {
    console.debug('[departments] ciclo da diretoria executado');
    publish(EventTopics.DEPARTMENT_DIRECTORATE_HEARTBEAT, {
      timestamp: new Date().toISOString(),
      active: true,
    }, 'department-routines');
    resolve();
  });
}

export async function startAllDepartmentRoutines(): Promise<void> {
  console.log('[departments] iniciando rotinas autônomas de todos os departamentos');

  startRoutine('comercial', 10 * 60 * 1000, commercialRoutine);
  startRoutine('atendimento', 5 * 60 * 1000, supportRoutine);
  startRoutine('produto', 15 * 60 * 1000, productRoutine);
  startRoutine('tecnologia', 2 * 60 * 1000, technologyRoutine);
  startRoutine('design', 30 * 60 * 1000, designRoutine);
  startRoutine('pesquisa', 60 * 60 * 1000, researchRoutine);
  startRoutine('diretoria', 20 * 60 * 1000, directorateRoutine);

  console.log(`[departments] ${routines.size} rotinas de departamento iniciadas`);
}

export async function stopAllDepartmentRoutines(): Promise<void> {
  for (const dept of [...routines.keys()]) {
    stopRoutine(dept);
  }
  console.log('[departments] todas as rotinas de departamento paradas');
}

export const departmentRoutines = {
  startAll: startAllDepartmentRoutines,
  stopAll: stopAllDepartmentRoutines,
  getStatus: getRoutineStatus,
};
