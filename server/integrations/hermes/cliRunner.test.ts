import { describe, it, expect } from 'vitest';
import { validateCliArg, runCommandSafe } from './cliRunner.ts';

describe('Seguranca — executor Hermes (injecao de comandos)', () => {
  describe('validateCliArg', () => {
    it('aceita identificadores seguros (slug, id, nome de perfil)', () => {
      expect(validateCliArg('code-reviewer', 'slug')).toBe('code-reviewer');
      expect(validateCliArg('proj-123', 'id')).toBe('proj-123');
      expect(validateCliArg('agente.operacional', 'id')).toBe('agente.operacional');
      expect(validateCliArg('user_name', 'id')).toBe('user_name');
    });

    it('rejeita string vazia', () => {
      expect(() => validateCliArg('', 'slug')).toThrow();
    });

    it('rejeita espaco (metacaractere de separacao de argumentos)', () => {
      expect(() => validateCliArg('code reviewer', 'slug')).toThrow();
    });

    it('rejeita aspas duplas', () => {
      expect(() => validateCliArg('code"reviewer', 'slug')).toThrow();
    });

    it('rejeita aspas simples', () => {
      expect(() => validateCliArg("code'reviewer", 'slug')).toThrow();
    });

    it('rejeita crase (substituicao de comando)', () => {
      expect(() => validateCliArg('code`reviewer', 'slug')).toThrow();
    });

    it('rejeita ponto-e-virgula (encadeamento de comandos)', () => {
      expect(() => validateCliArg('code;reviewer', 'slug')).toThrow();
    });

    it('rejeita e-comercial (execucao em segundo plano)', () => {
      expect(() => validateCliArg('code&reviewer', 'slug')).toThrow();
    });

    it('rejeita cifrao (expansao de variavel)', () => {
      expect(() => validateCliArg('$VAR', 'slug')).toThrow();
    });

    it('rejeita parenteses (substituicao de comando)', () => {
      expect(() => validateCliArg('code(reviewer)', 'slug')).toThrow();
    });

    it('rejeita colchetes', () => {
      expect(() => validateCliArg('code[reviewer]', 'slug')).toThrow();
    });

    it('rejeita barras (tentativa de caminho)', () => {
      expect(() => validateCliArg('../etc/passwd', 'slug')).toThrow();
      expect(() => validateCliArg('code/reviewer', 'slug')).toThrow();
    });

    it('rejeita string muito longa', () => {
      expect(() => validateCliArg('a'.repeat(129), 'slug')).toThrow();
    });
  });

  describe('runCommandSafe (sem shell)', () => {
    it('executa comando com ponto-e-virgula como argumento literal (nao separador de shell)', async () => {
      const result = await runCommandSafe(
        'node',
        ['-e', 'process.exit(0)', 'ola; mundo'],
      );
      expect(result.error).toBeNull();
    });

    it('executa comando com crase como argumento literal (nao substituicao de shell)', async () => {
      const result = await runCommandSafe(
        'node',
        ['-e', 'process.exit(0)', 'echo `whoami`'],
      );
      expect(result.error).toBeNull();
    });

    it('executa comando com cifrao como argumento literal (nao expansao de variavel de shell)', async () => {
      const result = await runCommandSafe(
        'node',
        ['-e', 'process.exit(0)', '$PATH'],
      );
      expect(result.error).toBeNull();
    });

    it('rejeita comando invalido com erro claro (nao executa shell)', async () => {
      const result = await runCommandSafe('comando-inexistente-xyz-12345', []);
      expect(result.error).not.toBeNull();
    });
  });
});
