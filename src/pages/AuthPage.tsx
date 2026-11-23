import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, LogIn, Mail, Lock, UserPlus, Loader2 } from 'lucide-react';
import { supabase, type AppUser } from '../lib/supabase.ts';
import { AuthApi } from '../services/api.ts';

type AuthMode = 'login' | 'signup' | 'reset' | 'success';

interface AuthPageProps {
  onAuthenticated: (user: AppUser) => void;
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');

  const errorRef = useRef<HTMLDivElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const scrollToMessages = useCallback(() => {
    errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const setMessages = useCallback((err: string | null, succ: string | null) => {
    setError(err);
    setSuccess(succ);
    if (err || succ) scrollToMessages();
  }, [scrollToMessages]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const appUser = {
          id: session.user.id,
          email: session.user.email ?? null,
          emailConfirmed: !!session.user.email_confirmed_at,
          platformRole: (session.user.app_metadata?.platform_role as string | null) ?? null,
          isPlatformAdmin: (session.user.app_metadata?.platform_role as string) === 'platform_admin',
          appMetadata: session.user.app_metadata ?? {},
        };
        onAuthenticated(appUser);
      }
    });
    return () => sub.subscription?.unsubscribe();
  }, [onAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        // A sessao e gerenciada pelo onAuthStateChange acima.
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          throw new Error('A senha e a confirmacao nao coincidem.');
        }
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (err) throw err;
        setMode('success');
        setSuccess('Conta criada com sucesso. Verifique seu e-mail para confirmar o cadastro, se necessario, e faça login.');
        return;
      } else if (mode === 'reset') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail, {
          redirectTo: `${window.location.origin}/`,
        });
        if (err) throw err;
        setMode('success');
        setSuccess('Se o e-mail estiver cadastrado, voce recebera instrucoes para redefinir a senha.');
        return;
      }
    } catch (err: unknown) {
      setMessages(err instanceof Error ? err.message : 'Erro ao processar a solicitacao.', null);
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrap = async () => {
    setLoading(true);
    clearMessages();
    try {
      const res = await AuthApi.bootstrapAdmin();
      if (res.ok && res.claimed) {
        setSuccess(
          'Bootstrap concluido: voce e agora o administrador geral da plataforma TokenizAi.',
        );
      } else if (res.ok) {
        setSuccess('Sessao valida. Voce entrou como usuario da plataforma.');
      } else {
        setError(res.message || 'Nao foi possível concluir o acesso administrativo.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao concluir o bootstrap administrativo.');
    } finally {
      setLoading(false);
    }
  };

  const modeLabels: Record<AuthMode, string> = {
    login: 'Entrar na plataforma',
    signup: 'Criar sua conta',
    reset: 'Redefinir senha',
    success: 'Sucesso',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="bg-surface border border-line rounded-2xl p-8 sm:p-10 shadow-lg">
          {/* Header / Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg nc-glow-panel mb-3 mx-auto">
              <span className="font-display font-bold text-sm text-accent dark:text-cyan-300">T</span>
            </div>
            <h2 className="font-display font-bold text-ink text-xl sm:text-2xl">{modeLabels[mode]}</h2>
            <p className="text-sm text-ink-muted mt-2">
              TokenizAi — Gestão Empresarial e Operações de IA
            </p>
          </div>

          {/* Messages */}
          {error && (
            <div ref={errorRef} role="alert" className="mb-6 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div ref={successRef} role="status" className="mb-6 p-3 rounded-lg border border-green-200 bg-green-50 text-green-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {mode === 'success' ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => { setMode('login'); setSuccess(null); }}
                className="w-full nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                disabled={loading}
              >
                Ir para o login
              </button>
              <p className="mt-4 text-xs text-ink-subtle">
                Ja tem uma conta? <button type="button" onClick={() => setMode('login')} className="text-accent hover:underline font-medium">Faca login</button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'login' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-ink-subtle mb-1">E-mail</label>
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      className="w-full px-3 py-2 rounded-lg border border-line bg-surface-subtle/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent text-sm text-ink transition-colors"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-subtle mb-1">Senha</label>
                    <input
                      type="password"
                      autoComplete="current-password"
                      required
                      className="w-full px-3 py-2 rounded-lg border border-line bg-surface-subtle/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent text-sm text-ink transition-colors"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                    Entrar
                  </button>
                  <p className="text-center text-xs text-ink-subtle">
                    Nao tem uma conta?{' '}
                    <button type="button" onClick={() => { setMode('signup'); clearMessages(); }} className="text-accent hover:underline font-medium">Criar conta</button>
                  </p>
                  <p className="text-center text-xs text-ink-subtle">
                    <button type="button" onClick={() => { setMode('reset'); clearMessages(); }} className="text-accent hover:underline font-medium">Esqueceu a senha?</button>
                  </p>
                </>
              )}
              {mode === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-ink-subtle mb-1">Nome completo</label>
                    <input
                      type="text"
                      autoComplete="name"
                      required
                      className="w-full px-3 py-2 rounded-lg border border-line bg-surface-subtle/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent text-sm text-ink transition-colors"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Netto Farias"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-subtle mb-1">E-mail</label>
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      className="w-full px-3 py-2 rounded-lg border border-line bg-surface-subtle/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent text-sm text-ink transition-colors"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-subtle mb-1">Senha</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      className="w-full px-3 py-2 rounded-lg border border-line bg-surface-subtle/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent text-sm text-ink transition-colors"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-subtle mb-1">Confirmar senha</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      className="w-full px-3 py-2 rounded-lg border border-line bg-surface-subtle/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent text-sm text-ink transition-colors"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    Criar conta
                  </button>
                  <p className="text-center text-xs text-ink-subtle">
                    Ja tem uma conta?{' '}
                    <button type="button" onClick={() => { setMode('login'); clearMessages(); }} className="text-accent hover:underline font-medium">Faca login</button>
                  </p>
                </>
              )}
              {mode === 'reset' && (
                <>
                  <p className="text-xs text-ink-subtle mb-4">Informe o e-mail cadastrado para receber instrucoes de redefinicao de senha.</p>
                  <div>
                    <label className="block text-xs font-medium text-ink-subtle mb-1">E-mail</label>
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      className="w-full px-3 py-2 rounded-lg border border-line bg-surface-subtle/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent text-sm text-ink transition-colors"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="seu@email.com"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                    Enviar instrucoes
                  </button>
                  <p className="text-center text-xs text-ink-subtle mt-4">
                    Ja tem uma senha?{' '}
                    <button type="button" onClick={() => { setMode('login'); clearMessages(); }} className="text-accent hover:underline font-medium">Faca login</button>
                  </p>
                </>
              )}
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-line text-xs text-ink-subtle text-center">
            A primeira conta confirmada com o e-mail autorizado e promovida a administradora geral da plataforma automaticamente.
          </div>
        </div>
      </div>
    </div>
  );
}
