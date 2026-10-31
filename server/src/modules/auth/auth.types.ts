export interface User {
  id: number;
  username: string;
  email: string | null;
  password_hash: string;
  is_admin: number;
  totp_secret: string | null;
  totp_enabled: number;
  /** Dernier pas TOTP accepté (anti-rejeu), `null` avant le premier code. */
  totp_last_step: number | null;
  created_at: string;
}

export interface ResetTokenRow {
  user_id: number;
  expires_at: number;
}

/** Journal des événements d'authentification (la console par défaut). */
export interface AuthLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}
