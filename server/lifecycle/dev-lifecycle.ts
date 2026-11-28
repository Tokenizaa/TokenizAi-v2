/**
 * @file server/lifecycle/dev-lifecycle.ts
 * Ciclo de vida de bootstrap da operação autônoma da TokenizAi.
 *
 * Inicia o orquestrador de execução, workers de fallback, rotinas de
 * departamento e o roteador inter-departamental. Chamado por server.ts
 * após initializeServerState(), tanto em dev quanto em produção, para
 * garantir que a organização nunca fique ociosa enquanto houver
 * atividades executáveis.
 */

import {
  startExecutionOrchestrator,
  stopExecutionOrchestrator,
} from '../services/execution-orchestrator.ts';
import { createFallbackWorkers, stopAllWorkers } from '../services/worker-manager.ts';
import { departmentRoutines, stopAllDepartmentRoutines } from '../services/department-routines.ts';
import { departmentWorkers, stopAllDepartmentWorkers } from '../services/department-workers.ts';
import { appendAudit } from '../persistence.ts';

let lifecycleStarted = false;

export async function startDevLifecycle(): Promise<void> {
  if (lifecycleStarted) return;
  lifecycleStarted = true;

  // O orquestrador de execução já foi iniciado por server.ts
  // (startExecutionOrchestrator). Aqui iniciamos workers, rotinas e
  // registramos a auditoria de bootstrap.

  // Inicia workers de fallback (sem Redis disponível)
  createFallbackWorkers();

  // Inicia workers especializados de departamento
  await departmentWorkers.startAll().catch((err) => {
    console.error(
      '[lifecycle] não foi possível iniciar workers de departamento:',
      err instanceof Error ? err.message : String(err),
    );
  });

  // Inicia rotinas autônomas de todos os departamentos
  await departmentRoutines.startAll().catch((err) => {
    console.error(
      '[lifecycle] não foi possível iniciar rotinas de departamento:',
      err instanceof Error ? err.message : String(err),
    );
  });

  appendAudit(
    'sistema',
    'Ciclo de vida autônomo iniciado (workers, rotinas de departamento, roteador inter-departamental)',
    'bootstrap',
    'Plataforma',
  );

  console.log('[lifecycle] operação autônoma da TokenizAi iniciada');
}

export async function stopDevLifecycle(): Promise<void> {
  if (!lifecycleStarted) return;
  lifecycleStarted = false;

  stopAllDepartmentWorkers();
  stopAllDepartmentRoutines();
  stopAllWorkers();
  stopExecutionOrchestrator();

  console.log('[lifecycle] operação autônoma da TokenizAi parada');
}

export { startDevLifecycle as start, stopDevLifecycle as stop };
