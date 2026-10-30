import { HttpResponse } from 'msw';

/**
 * Réponse d'erreur au format de l'API (`{ error: { code, message, params? } }`). Le message de
 * repli est reconnaissable : il ne s'affiche que si le code n'a pas de traduction.
 */
export function apiError(code: string, status: number, params?: Record<string, string | number>) {
  return HttpResponse.json(
    { error: { code, message: `[repli] ${code}`, ...(params ? { params } : {}) } },
    { status },
  );
}
