import { randomBytes } from 'node:crypto';

import { sha256Hex } from '@jerem-gt/ctrl-shared/server/crypto';
import type { Request, Response } from 'express';

import { readCookie } from '../../lib/cookies.js';
import { deviceLabel } from '../../lib/userAgent.js';
import type { TrustedDevicesRepo } from './trustedDevices.js';

/** Nom propre à l'appli : cookies et noms d'hôte sont partagés avec cash-ctrl sur le NAS. */
export const DEVICE_COOKIE = 'shelfctrl_device';
export const DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Cookie « se souvenir de cet appareil » : un seul par navigateur, lu par les seules routes d'auth. */
export function createDeviceCookies(devices: TrustedDevicesRepo, secureCookies: boolean) {
  // Comme le cookie de session (secure: 'auto') : Secure seulement si la requête est en HTTPS.
  const cookieOptions = (req: Request) => ({
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: secureCookies && req.secure,
    path: '/api/auth',
  });

  const tokenOf = (req: Request) => readCookie(req.headers.cookie, DEVICE_COOKIE);

  /** Empreinte du jeton porté par la requête, `undefined` sans cookie. */
  const currentHash = (req: Request): string | undefined => {
    const token = tokenOf(req);
    return token ? sha256Hex(token) : undefined;
  };

  const clear = (req: Request, res: Response) => {
    res.clearCookie(DEVICE_COOKIE, cookieOptions(req));
  };

  return {
    currentHash,
    clear,

    /** Vrai si le cookie de la requête désigne un appareil (non expiré ou non) du compte. */
    belongsTo: (req: Request, userId: number): boolean => {
      const hash = currentHash(req);
      return hash !== undefined && devices.getByHash(hash)?.user_id === userId;
    },

    /** Mémorise l'appareil courant ; remplace l'éventuel appareil déjà porté par le cookie. */
    remember: (req: Request, res: Response, userId: number): void => {
      const now = Date.now();
      devices.purgeExpired(now);
      const previous = currentHash(req);
      if (previous) {
        devices.deleteByHash(previous);
      }
      const token = randomBytes(32).toString('base64url');
      devices.insert(
        userId,
        sha256Hex(token),
        deviceLabel(req.get('user-agent')),
        now,
        now + DEVICE_TTL_MS,
      );
      res.cookie(DEVICE_COOKIE, token, { ...cookieOptions(req), maxAge: DEVICE_TTL_MS });
    },

    /**
     * Vrai si le cookie désigne un appareil valide du compte. Un cookie mort est effacé ; celui
     * d'un autre compte est conservé (navigateur partagé).
     */
    isTrusted: (req: Request, res: Response, userId: number): boolean => {
      const hash = currentHash(req);
      if (!hash) {
        return false;
      }
      const now = Date.now();
      devices.purgeExpired(now);
      const device = devices.getByHash(hash);
      if (device === undefined) {
        clear(req, res);
        return false;
      }
      if (device.user_id !== userId) {
        return false;
      }
      devices.touch(device.id, now);
      return true;
    },
  };
}

export type DeviceCookies = ReturnType<typeof createDeviceCookies>;
