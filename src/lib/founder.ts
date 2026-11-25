/**
 * Identidade administrativa única da NettosCorp.
 *
 * O e-mail do fundador deve ser o mesmo em backend (FOUNDER_EMAIL) e frontend
 * (VITE_FOUNDER_EMAIL), evitando verificações administrativas independentes e
 * inconsistentes entre as duas camadas.
 */
export const FOUNDER_EMAIL = (import.meta.env.VITE_FOUNDER_EMAIL || 'nettoscorp@gmail.com').trim();

export function isFounderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim() === FOUNDER_EMAIL;
}
