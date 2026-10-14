export interface AuthEnv {
  adminUser: string;
  adminPassword: string;
  /** Clé de signature des cookies de session. */
  sessionSecret: string;
  /** Cookie `Secure` : à activer derrière HTTPS (reverse proxy). */
  secureCookies: boolean;
}

const MIN_SECRET_LENGTH = 32;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Lit la configuration d'authentification. En production, refuse de démarrer sans secret ni mot
 * de passe corrects : un compose qui référence une variable absente la passe à vide.
 */
export function loadAuthConfig(env: Record<string, string | undefined>): AuthEnv {
  const production = env.NODE_ENV === 'production';
  const adminUser = env.ADMIN_USER?.trim() || 'admin';
  const adminPassword = env.ADMIN_PASSWORD ?? '';
  const sessionSecret = env.SESSION_SECRET ?? '';

  if (production) {
    if (sessionSecret.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `SESSION_SECRET manquant ou trop court (${MIN_SECRET_LENGTH} caractères minimum).`,
      );
    }
    if (adminPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `ADMIN_PASSWORD manquant ou trop court (${MIN_PASSWORD_LENGTH} caractères minimum).`,
      );
    }
  } else if (!sessionSecret || !adminPassword) {
    throw new Error('SESSION_SECRET et ADMIN_PASSWORD sont requis (voir server/.env.example).');
  }

  return { adminUser, adminPassword, sessionSecret, secureCookies: env.SECURE_COOKIE === 'true' };
}
