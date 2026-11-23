import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type TokenizAiRole =
  | 'Diretoria Executiva'
  | 'Gestor Operacional'
  | 'Comercial & CRM'
  | 'Financeiro'
  | 'Auditor';

export type PlatformPermission =
  | 'read'
  | 'admin:integration'
  | 'approvals:decide'
  | 'enterprise:projects:write'
  | 'enterprise:crm:write'
  | 'enterprise:finance:write'
  | 'paperclip:ops:write';

export interface WorkspaceActor {
  userId: string;
  name: string;
  email: string;
  role: TokenizAiRole;
  paperclipUserId?: string | null;
  isAdmin: boolean;
  authenticated: boolean;
}

interface SessionTokenRecord {
  expiresAt: number;
  userId: string;
  name: string;
  email: string;
  role: TokenizAiRole;
  paperclipUserId?: string | null;
  isAdmin: boolean;
}

const SESSION_SECRET = process.env.TOKENIZAI_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours in memory

let claimedPasscodeHash: { salt: string; hash: string } | null = null;
const activeTokens = new Map<string, SessionTokenRecord>();

const DEFAULT_ADMIN_ACTOR = {
  userId: 'usr-01',
  name: 'Helena Vasconcelos',
  email: 'helena@tokenizai.com.br',
  role: 'Diretoria Executiva' as TokenizAiRole,
  paperclipUserId: process.env.PAPERCLIP_ADMIN_USER_ID || null,
};

const DEFAULT_PREVIEW_OPERATOR: WorkspaceActor = {
  userId: 'usr-02',
  name: 'Rafael Mendes',
  email: 'rafael@tokenizai.com.br',
  role: 'Gestor Operacional',
  paperclipUserId: process.env.PAPERCLIP_OPERATOR_USER_ID || null,
  isAdmin: false,
  authenticated: false,
};

function hashPasscode(passcode: string, saltHex?: string): { salt: string; hash: string } {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return { salt, hash: derived };
}

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getEnvPasscode(): string {
  return (process.env.TOKENIZAI_ADMIN_PASSCODE || '').trim();
}

function issueToken(identity: {
  userId: string;
  name: string;
  email: string;
  role: TokenizAiRole;
  paperclipUserId?: string | null;
  isAdmin: boolean;
}): { token: string; expiresAt: number; actor: WorkspaceActor } {
  const nonce = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${nonce}.${expiresAt}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  const token = `${payload}.${sig}`;
  activeTokens.set(token, { expiresAt, ...identity });
  return {
    token,
    expiresAt,
    actor: {
      ...identity,
      authenticated: true,
    },
  };
}

export function verifyBearerToken(authHeader?: string): SessionTokenRecord | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const entry = activeTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    activeTokens.delete(token);
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  if (!safeEqualStrings(parts[2], expectedSig)) return null;
  return entry;
}

export function verifyAdminBearerToken(authHeader?: string): boolean {
  const record = verifyBearerToken(authHeader);
  return Boolean(record && record.isAdmin && record.role === 'Diretoria Executiva');
}

export function resolveWorkspaceActor(req: Request): {
  actor: WorkspaceActor;
  invalidToken: boolean;
} {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const record = verifyBearerToken(authHeader);
    if (!record) {
      return {
        actor: { ...DEFAULT_PREVIEW_OPERATOR, role: 'Auditor', name: 'Não autenticado' },
        invalidToken: true,
      };
    }
    return {
      actor: {
        userId: record.userId,
        name: record.name,
        email: record.email,
        role: record.role,
        paperclipUserId: record.paperclipUserId ?? null,
        isAdmin: record.isAdmin,
        authenticated: true,
      },
      invalidToken: false,
    };
  }

  return {
    actor: DEFAULT_PREVIEW_OPERATOR,
    invalidToken: false,
  };
}

export function hasPermission(actor: WorkspaceActor, permission: PlatformPermission): boolean {
  if (permission === 'read') return true;
  if (actor.isAdmin && actor.role === 'Diretoria Executiva') return true;

  switch (permission) {
    case 'admin:integration':
    case 'approvals:decide':
      return false;
    case 'enterprise:projects:write':
    case 'paperclip:ops:write':
      return actor.role === 'Gestor Operacional';
    case 'enterprise:crm:write':
      return actor.role === 'Gestor Operacional' || actor.role === 'Comercial & CRM';
    case 'enterprise:finance:write':
      return actor.role === 'Financeiro';
    default:
      return false;
  }
}

export function requirePermission(permission: PlatformPermission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { actor, invalidToken } = resolveWorkspaceActor(req);
    if (invalidToken) {
      res.status(401).json({
        error: 'Token de sessão inválido ou expirado.',
        code: 'INVALID_SESSION_TOKEN',
      });
      return;
    }

    if (!hasPermission(actor, permission)) {
      if (permission === 'admin:integration' || permission === 'approvals:decide') {
        res.status(actor.authenticated ? 403 : 401).json({
          error: actor.authenticated
            ? 'Seu perfil atual não possui permissão de Diretoria Executiva para executar esta ação.'
            : 'Autenticação administrativa necessária para executar esta operação de governança.',
          code: actor.authenticated ? 'FORBIDDEN_ROLE' : 'ADMIN_AUTH_REQUIRED',
        });
        return;
      }
      res.status(403).json({
        error: `Perfil "${actor.role}" não possui autorização para esta operação (${permission}).`,
        code: 'FORBIDDEN_ROLE',
      });
      return;
    }

    next();
  };
}

export function getAdminAuthStatus(authHeader?: string) {
  const envConfigured = getEnvPasscode().length > 0;
  const record = verifyBearerToken(authHeader);
  return {
    envConfigured,
    claimed: envConfigured || claimedPasscodeHash !== null,
    authenticated: Boolean(record && record.isAdmin && record.role === 'Diretoria Executiva'),
    actor: record
      ? {
          userId: record.userId,
          name: record.name,
          email: record.email,
          role: record.role,
          isAdmin: record.isAdmin,
        }
      : {
          userId: DEFAULT_PREVIEW_OPERATOR.userId,
          name: DEFAULT_PREVIEW_OPERATOR.name,
          email: DEFAULT_PREVIEW_OPERATOR.email,
          role: DEFAULT_PREVIEW_OPERATOR.role,
          isAdmin: false,
        },
  };
}

export function issueNonAdminUserSession(user: {
  id: string;
  name: string;
  email: string;
  role: TokenizAiRole;
}): { ok: true; token: string; expiresAt: number; actor: WorkspaceActor } | { ok: false; status: number; error: string } {
  if (user.role === 'Diretoria Executiva') {
    return {
      ok: false,
      status: 403,
      error: 'Perfis de Diretoria Executiva exigem autenticação administrativa via senha.',
    };
  }
  const session = issueToken({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isAdmin: false,
  });
  return { ok: true, ...session };
}

export function claimAdminPasscode(
  password: string,
): { ok: true; token: string; expiresAt: number; actor: WorkspaceActor } | { ok: false; status: number; error: string } {
  if (getEnvPasscode().length > 0) {
    return { ok: false, status: 409, error: 'A senha administrativa já está definida via variável de ambiente.' };
  }
  if (claimedPasscodeHash !== null) {
    return { ok: false, status: 409, error: 'O acesso administrativo já foi inicializado neste servidor.' };
  }
  if (!password || password.trim().length < 8) {
    return { ok: false, status: 400, error: 'Defina uma senha administrativa com pelo menos 8 caracteres.' };
  }

  claimedPasscodeHash = hashPasscode(password.trim());
  const session = issueToken({ ...DEFAULT_ADMIN_ACTOR, isAdmin: true });
  return { ok: true, ...session };
}

export function loginAdminPasscode(
  password: string,
): { ok: true; token: string; expiresAt: number; actor: WorkspaceActor } | { ok: false; status: number; error: string } {
  const envPass = getEnvPasscode();
  const candidate = (password || '').trim();
  if (!candidate) {
    return { ok: false, status: 400, error: 'Informe a senha administrativa.' };
  }

  if (envPass.length > 0) {
    if (!safeEqualStrings(candidate, envPass)) {
      return { ok: false, status: 401, error: 'Credencial administrativa inválida.' };
    }
    const session = issueToken({ ...DEFAULT_ADMIN_ACTOR, isAdmin: true });
    return { ok: true, ...session };
  }

  if (!claimedPasscodeHash) {
    return { ok: false, status: 409, error: 'Defina a senha administrativa inicial antes de autenticar.' };
  }

  const attempt = hashPasscode(candidate, claimedPasscodeHash.salt);
  if (!safeEqualStrings(attempt.hash, claimedPasscodeHash.hash)) {
    return { ok: false, status: 401, error: 'Credencial administrativa inválida.' };
  }

  const session = issueToken({ ...DEFAULT_ADMIN_ACTOR, isAdmin: true });
  return { ok: true, ...session };
}

export function logoutAdminToken(authHeader?: string): void {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return;
  const token = authHeader.slice(7).trim();
  activeTokens.delete(token);
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const { actor, invalidToken } = resolveWorkspaceActor(req);
  if (invalidToken || !actor.authenticated || !actor.isAdmin || actor.role !== 'Diretoria Executiva') {
    res.status(actor.authenticated && !invalidToken ? 403 : 401).json({
      error: actor.authenticated && !invalidToken
        ? 'Perfil atual não possui autorização administrativa.'
        : 'Autenticação administrativa necessária para executar esta operação de integração.',
      code: actor.authenticated && !invalidToken ? 'FORBIDDEN_ROLE' : 'ADMIN_AUTH_REQUIRED',
    });
    return;
  }
  next();
}
