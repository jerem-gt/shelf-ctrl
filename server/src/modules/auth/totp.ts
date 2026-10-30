import type { TotpSetupResponse } from '@shelfctrl/types';
import * as OTPAuth from 'otpauth';

const TOTP_ISSUER = 'ShelfCtrl';
// Réglages lus par toutes les applications d'authentification (Google Authenticator, Aegis…).
const TOTP_OPTIONS = { algorithm: 'SHA1', digits: 6, period: 30 } as const;
/** Une période de part et d'autre : tolère le décalage d'horloge du téléphone. */
const TOTP_WINDOW = 1;

/** Nouveau secret pour le compte `label`, avec son URI `otpauth://` (QR code). */
export function newTotpSecret(label: string): TotpSetupResponse {
  const secret = new OTPAuth.Secret();
  const totp = new OTPAuth.TOTP({ ...TOTP_OPTIONS, issuer: TOTP_ISSUER, label, secret });
  return { uri: totp.toString(), secret: secret.base32 };
}

/**
 * Pas (numéro de la période de 30 s) auquel correspond le code, `null` s'il n'est pas valide. Le
 * pas accepté est mémorisé : un code ne sert qu'une fois (anti-rejeu, RFC 6238 §5.2).
 */
export function matchTotpStep(secret: string, code: string, now = Date.now()): number | null {
  const totp = new OTPAuth.TOTP({ ...TOTP_OPTIONS, secret: OTPAuth.Secret.fromBase32(secret) });
  const delta = totp.validate({ token: code, timestamp: now, window: TOTP_WINDOW });
  return delta === null ? null : totp.counter({ timestamp: now }) + delta;
}
