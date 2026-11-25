import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY sao obrigatorios no ambiente de frontend. Verifique o arquivo .env.',
  );
}

/**
 * Cliente Supabase do frontend (anon/publishable key).
 * Nunca expor service_role aqui.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Aguarda a sessao do Supabase ficar disponivel no cliente (com retry). */
async function waitForSession(maxAttempts = 3, delayMs = 500): Promise<{ data: { session: { access_token: string } | null } } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await supabase.auth.getSession();
      if (result.data?.session?.access_token) return result;
    } catch {}
    if (i < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

/**
 * Retorna o access token da sessao atual, se houver.
 * Tenta aguardar a sessao ficar disponivel (race condition apos onAuthStateChange).
 * Em ambiente de navegador (E2E), faz fallback para token injetado via
 * window.__e2eAccessToken quando a sessao do cliente nao esta pronta.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const result = await waitForSession();
    if (result?.data.session?.access_token) return result.data.session.access_token;
  } catch {}
  // Fallback E2E: token injetado diretamente no window pelo teste.
  if (typeof window !== 'undefined') {
    return (window as any).__e2eAccessToken ?? null;
  }
  return null;
}

export interface AppUser {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
  platformRole: string | null;
  isPlatformAdmin: boolean;
  appMetadata: Record<string, unknown>;
}

export function mapSupabaseUser(user: { id: string; email?: string | null; email_confirmed_at?: string | null | undefined; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }): AppUser {
  return {
    id: user.id,
    email: user.email ?? null,
    emailConfirmed: !!user.email_confirmed_at,
    platformRole: (user.app_metadata?.platform_role as string | null) ?? null,
    isPlatformAdmin: (user.app_metadata?.platform_role as string) === 'platform_admin',
    appMetadata: user.app_metadata ?? {},
  };
}
