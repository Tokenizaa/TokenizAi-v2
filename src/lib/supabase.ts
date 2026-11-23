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

/**
 * Retorna o access token da sessao atual, se houver.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
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
