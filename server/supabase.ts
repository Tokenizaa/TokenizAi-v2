import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction } from 'express';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Cliente Supabase administrativo (service role).
 * Somente para uso no servidor. Nunca expor ao navegador.
 * Usado para validar JWTs e chamar RPCs com privilégios de servidor quando necessário.
 */
function createSupabaseAdmin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no servidor.');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createSupabaseAdmin();
  }
  return supabaseAdmin;
}

/**
 * Cliente Supabase no contexto de um usuário autenticado.
 * O JWT do usuário é enviado no cabeçalho Authorization para que
 * `auth.uid()` e `auth.email()` reflitam o usuário em funções SECURITY DEFINER.
 */
export function createSupabaseUserClient(accessToken: string): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios no servidor.');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Dados do usuário extraídos de um JWT válido do Supabase Auth.
 */
export interface SupabaseUser {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
  appMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
  aud: string;
  role: string;
}

/**
 * Valida um JWT do Supabase Auth (assinatura, issuer, audience, expiração).
 * Retorna os dados do usuário ou lança erro quando o token é inválido/ausente.
 */
export async function validateSupabaseToken(accessToken: string): Promise<SupabaseUser> {
  if (!accessToken) {
    throw new Error('Token de acesso não fornecido.');
  }
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data?.user) {
    throw new Error('Token de sessão inválido ou expirado.');
  }
  const user = data.user;
  return {
    id: user.id,
    email: user.email ?? null,
    emailConfirmed: !!user.email_confirmed_at,
    appMetadata: (user.app_metadata as Record<string, unknown>) || {},
    userMetadata: (user.user_metadata as Record<string, unknown>) || {},
    aud: user.aud ?? '',
    role: user.role ?? 'authenticated',
  };
}

/**
 * Middleware Express: valida o JWT do Supabase e anexa `req.user`.
 * Rotas protegidas devem usar este middleware antes do handler.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de sessão não fornecido.', code: 'MISSING_SESSION_TOKEN' });
    return;
  }
  const accessToken = authHeader.slice('Bearer '.length).trim();
  validateSupabaseToken(accessToken)
    .then((user) => {
      (req as Request & { user?: SupabaseUser }).user = user;
      next();
    })
    .catch(() => {
      res.status(401).json({ error: 'Token de sessão inválido ou expirado.', code: 'INVALID_SESSION_TOKEN' });
    });
}

/**
 * Retorna verdadeiro quando o usuário autenticado tem papel de administrador geral
 * lido de `app_metadata` (fonte confiável do servidor, nunca do cliente).
 */
export function isPlatformAdmin(user: SupabaseUser): boolean {
  return user.appMetadata.platform_role === 'platform_admin';
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };
