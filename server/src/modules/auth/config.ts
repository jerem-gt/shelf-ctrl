export interface AuthEnv {
  /** Clé de signature des cookies de session. */
  sessionSecret: string;
  /** Cookie `Secure` : à activer derrière HTTPS (reverse proxy). */
  secureCookies: boolean;
  /** URL publique de l'application, sans slash final, pour les liens des e-mails. */
  appUrl: string | undefined;
  /** ADMIN_USER / ADMIN_PASSWORD encore définies : variables obsolètes, à signaler. */
  obsoleteAdminVariables: boolean;
}

const MIN_SECRET_LENGTH = 32;

function normalizeAppUrl(url: string | undefined): string | undefined {
  let trimmed = url?.trim() ?? '';
  while (trimmed.endsWith('/')) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed || undefined;
}

/**
 * Lit la configuration d'authentification. En production, refuse de démarrer sans secret correct :
 * un compose qui référence une variable absente la passe à vide. Les comptes, eux, sont en base.
 */
export function loadAuthConfig(env: Record<string, string | undefined>): AuthEnv {
  const sessionSecret = env.SESSION_SECRET ?? '';
  if (env.NODE_ENV === 'production') {
    if (sessionSecret.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `SESSION_SECRET manquant ou trop court (${MIN_SECRET_LENGTH} caractères minimum).`,
      );
    }
  } else if (!sessionSecret) {
    throw new Error('SESSION_SECRET est requis (voir server/.env.example).');
  }
  return {
    sessionSecret,
    secureCookies: env.SECURE_COOKIE === 'true',
    appUrl: normalizeAppUrl(env.APP_URL),
    obsoleteAdminVariables: Boolean(env.ADMIN_USER || env.ADMIN_PASSWORD),
  };
}
