import { execFile } from 'node:child_process';

export interface CommandResult {
  stdout: string;
  stderr: string;
}

/**
 * Caractere permitido em identificadores usados como argumentos do Hermes CLI.
 * Apenas alfanuméricos, hífen, underline e ponto. Bloqueia metacaracteres de
 * shell (espaço, aspas, crase, ponto-e-vírgula, e-comercial, parênteses,
 * cifrão, colchetes, barras, etc.) impedindo injeção de comandos.
 */
const SAFE_ID_RE = /^[A-Za-z0-9._-]+$/;

/**
 * Valida um identificador que será passado como argumento de linha de comando.
 * Lança erro se contiver caracteres perigosos.
 */
export function validateCliArg(value: string, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Argumento inválido para ${label}: é obrigatório.`);
  }
  if (value.length > 128) {
    throw new Error(`Argumento inválido para ${label}: excede 128 caracteres.`);
  }
  if (!SAFE_ID_RE.test(value)) {
    throw new Error(`Argumento inválido para ${label}: contém caracteres não permitidos.`);
  }
  return value;
}

/**
 * Executa um comando sem shell, passando comando e argumentos separados.
 * Nenhuma entrada do usuário é interpolada em uma string de shell.
 *
 * O encerramento do processo é efetivo em caso de timeout: o processo filho
 * recebe SIGTERM quando o limite é atingido.
 */
export async function runCommand(
  command: string,
  args: string[] = [],
  options: { timeoutMs?: number; maxBuffer?: number } = {}
): Promise<CommandResult> {
  const { timeoutMs = 5000, maxBuffer = 1024 * 1024 } = options;

  const safeArgs = args.map((a) => String(a));

  const child = execFile(command, safeArgs, {
    encoding: 'utf8',
    maxBuffer,
    timeout: timeoutMs,
  });

  let timedOut = false;

  // Timer proprio para matar o processo em caso de timeout. O timeout nativo
  // do execFile tambem mata o processo, mas precisamos capturar se houve
  // timeout para decidir se stdout parcial e valido.
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      child.kill('SIGTERM');
    } catch {
      // Ignora se ja terminou.
    }
  }, timeoutMs);
  timer.unref?.();

  // Aguarda o encerramento real do processo filho. Comandos do Hermes CLI
  // podem manter o processo aberto apos produzir saida; se houver stdout,
  // consideramos a operacao bem-sucedida mesmo que o processo tenha sido
  // encerrado pelo timeout.
  return new Promise<CommandResult>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    child.on('error', reject);
    if (child.stdout) child.stdout.on('data', (d) => (stdout += d));
    if (child.stderr) child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        if (stdout.length > 0) {
          resolve({ stdout, stderr });
          return;
        }
        reject(new Error(`Command terminated by timeout (signal ${signal})`));
        return;
      }
      if (code !== 0) {
        reject(
          new Error(
            `Command exited with code ${code}${signal ? ` (signal ${signal})` : ''}`
          )
        );
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function runCommandSafe(
  command: string,
  args: string[] = [],
  options: { timeoutMs?: number; maxBuffer?: number } = {}
): Promise<{ stdout: string; error: Error | null }> {
  try {
    const { stdout } = await runCommand(command, args, options);
    return { stdout, error: null };
  } catch (err) {
    return { stdout: '', error: err instanceof Error ? err : new Error(String(err)) };
  }
}
