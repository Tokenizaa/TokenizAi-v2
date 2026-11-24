import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export async function runCommand(
  cmd: string,
  options: { timeoutMs?: number; maxBuffer?: number } = {}
): Promise<CommandResult> {
  const { timeoutMs = 5000, maxBuffer = 1024 * 1024 } = options;

  const execPromise = execAsync(cmd, { encoding: 'utf8', maxBuffer });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Command timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([execPromise, timeoutPromise]);
}

export async function runCommandSafe(
  cmd: string,
  options: { timeoutMs?: number; maxBuffer?: number } = {}
): Promise<{ stdout: string; error: Error | null }> {
  try {
    const { stdout } = await runCommand(cmd, options);
    return { stdout, error: null };
  } catch (err) {
    return { stdout: '', error: err instanceof Error ? err : new Error(String(err)) };
  }
}
