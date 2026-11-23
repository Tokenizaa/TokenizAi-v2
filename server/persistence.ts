import fs from 'node:fs';
import path from 'node:path';
import type { EnterpriseDataState } from '../src/types/platform.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'enterprise-state.json');

/**
 * Carrega o estado empresarial persistido em disco.
 * Retorna null quando não há arquivo persistido (primeira inicialização),
 * para que o servidor use a semente demonstrativa (`INITIAL_ENTERPRISE_DATA`).
 */
export function loadEnterpriseState(): EnterpriseDataState | null {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as EnterpriseDataState;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Persiste o estado empresarial em disco (JSON). Escrita síncrona para
 * garantir que, ao retornar, os dados já estejam gravados e sobrevivam a
 * reinicializações do serviço. Não armazena estado operacional exclusivo
 * do Paperclip (esse permanece somente no Paperclip).
 */
export function saveEnterpriseState(state: EnterpriseDataState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}
