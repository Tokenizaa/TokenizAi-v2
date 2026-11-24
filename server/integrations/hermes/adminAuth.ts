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
  | 'hermes:ops:write';

export interface WorkspaceActor {
  userId: string;
  name: string;
  email: string;
  role: TokenizAiRole;
  isAdmin: boolean;
  authenticated: boolean;
}

interface SessionTokenRecord {
  expiresAt: number;
  userId: string;
  name: string;
  email: string;
  role: TokenizAiRole;
  isAdmin: boolean;
}

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

function requireEnvSessionSecret(): string {
  const secret = process.env.TOKENIZAI_SESSION_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error('TOKENIZAI_SESSION_SECRET deve ser definida no ambiente antes de iniciar o servidor.');
  }
  return secret.trim();
}

const SESSION_SECRET = requireEnvSessionSecret();
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8;

let claimedPasscodeHash: { salt: string; hash: string } | null = null;
const activeTokens = new Map<string, SessionTokenRecord>();

const DEFAULT_ADMIN_ACTOR = {
  userId: 'usr-01',
  name: 'Helena Vasconcelos',
  email: 'helena@tokenizai.com.br',
  role: 'Diretoria Executiva' as TokenizAiRole,
};

const UNAUTHENTICATED_ACTOR: WorkspaceActor = {
  userId: 'usr-anon',
  name: 'Visitante não autenticado',
  email: '',
  role: 'Auditor' as TokenizAiRole,
  isAdmin: false,
  authenticated: false,
};

function issueToken(identity: {
  userId: string;
  name: string;
  email: string;
  role: TokenizAiRole;
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
    actor: { ...identity, authenticated: true },
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
        actor: { ...UNAUTHENTICATED_ACTOR, role: 'Auditor', name: 'Não autenticado' },
        invalidToken: true,
      };
    }
    return {
      actor: {
        userId: record.userId,
        name: record.name,
        email: record.email,
        role: record.role,
        isAdmin: record.isAdmin,
        authenticated: true,
      },
      invalidToken: false,
    };
  }

  return {
    actor: { ...UNAUTHENTICATED_ACTOR, role: 'Auditor', name: 'Visitante não autenticado', authenticated: false },
    invalidToken: false,
  };
}

export function hasPermission(actor: WorkspaceActor, permission: PlatformPermission): boolean {
  if (!actor.authenticated) return false;
  if (actor.isAdmin && actor.role === 'Diretoria Executiva') return true;

  switch (permission) {
    case 'admin:integration':
    case 'approvals:decide':
      return actor.isAdmin && actor.role === 'Diretoria Executiva';
    case 'enterprise:projects:write':
    case 'hermes:ops:write':
      return actor.isAdmin && actor.role === 'Diretoria Executiva'
        || actor.role === 'Gestor Operacional';
    case 'enterprise:crm:write':
      return actor.isAdmin && actor.role === 'Diretoria Executiva'
        || actor.role === 'Gestor Operacional'
        || actor.role === 'Comercial & CRM';
    case 'enterprise:finance:write':
      return actor.isAdmin && actor.role === 'Diretoria Executiva'
        || actor.role === 'Financeiro';
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
          userId: UNAUTHENTICATED_ACTOR.userId,
          name: UNAUTHENTICATED_ACTOR.name,
          email: UNAUTHENTICATED_ACTOR.email,
          role: UNAUTHENTICATED_ACTOR.role,
          isAdmin: false,
        },
  };
}

export function issueNonAdminUserSession(
  authHeader: string | undefined,
  user: {
    id: string;
    name: string;
    email: string;
    role: TokenizAiRole;
  },
): { ok: true; token: string; expiresAt: number; actor: WorkspaceActor } | { ok: false; status: number; error: string; code?: string } {
  if (!verifyAdminBearerToken(authHeader)) {
    return {
      ok: false,
      status: 403,
      error: 'Emissão de sessão para outros usuários exige autenticação administrativa (Diretoria Executiva).',
      code: 'ADMIN_AUTH_REQUIRED',
    };
  }
  if (user.role === 'Diretoria Executiva') {
    return {
      ok: false,
      status: 403,
      error: 'Perfis de Diretoria Executiva exigem autenticação administrativa via senha.',
      code: 'FORBIDDEN_ROLE',
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
  authHeader: string | undefined,
  password: string,
): { ok: true; token: string; expiresAt: number; actor: WorkspaceActor } | { ok: false; status: number; error: string; code?: string } {
  const bootstrapToken = (process.env.TOKENIZAI_BOOTSTRAP_TOKEN || '').trim();
  if (!bootstrapToken) {
    return {
      ok: false,
      status: 503,
      error: 'Bootstrap administrativo não configurado. Defina TOKENIZAI_BOOTSTRAP_TOKEN e TOKENIZAI_ADMIN_PASSCODE no ambiente.',
      code: 'BOOTSTRAP_NOT_CONFIGURED',
    };
  }
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      error: 'Token de bootstrap obrigatório para inicializar a senha administrativa.',
      code: 'BOOTSTRAP_TOKEN_REQUIRED',
    };
  }
  if (!safeEqualStrings(authHeader.slice(7).trim(), bootstrapToken)) {
    return {
      ok: false,
      status: 403,
      error: 'Token de bootstrap inválido.',
      code: 'INVALID_BOOTSTRAP_TOKEN',
    };
  }
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
