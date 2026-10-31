import type { DeviceCookies } from '@jerem-gt/ctrl-shared/server/deviceCookie';
import { matchTotpStep, newTotpSecret } from '@jerem-gt/ctrl-shared/server/totp';
import type { TrustedDevicesRepo } from '@jerem-gt/ctrl-shared/server/trustedDevices';
import type { TotpSetupResponse, TrustedDeviceItem } from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';
import { type Response, Router } from 'express';

import { BadRequestError, ConflictError, HttpError, NotFoundError } from '../../lib/errors.js';
import { currentUserId, requireAuth } from '../../middleware.js';
import type { UsersRepo } from '../users/users.repo.js';
import type { AuthRepo } from './auth.repo.js';
import { deviceIdSchema, disableTotpSchema, enableTotpSchema } from './auth.schema.js';
import type { User } from './auth.types.js';

/** Nom affiché par l'application d'authentification. */
const TOTP_ISSUER = 'ShelfCtrl';

export interface TotpRouterDeps {
  db: Database;
  repo: AuthRepo;
  usersRepo: UsersRepo;
  devices: TrustedDevicesRepo;
  deviceCookies: DeviceCookies;
  /** Le compte de la session ; supprimé entre-temps : 401. */
  sessionUser: (res: Response) => User;
  /** Vérifie le mot de passe actuel, échecs limités ; lève 429/401 sinon. */
  checkCurrentPassword: (user: User, candidate: string) => Promise<void>;
}

/** Activation et désactivation de la 2FA, appareils mémorisés du compte connecté. */
export function createTotpRouter(deps: TotpRouterDeps): Router {
  const { db, repo, usersRepo, devices, deviceCookies, sessionUser, checkCurrentPassword } = deps;
  const router = Router();

  router.use(['/2fa/setup', '/2fa/enable', '/2fa/disable', '/devices'], requireAuth);

  /** Nouveau secret, gardé en session jusqu'à sa confirmation par `/2fa/enable`. */
  router.post('/2fa/setup', (req, res) => {
    const user = sessionUser(res);
    if (user.totp_enabled === 1) {
      throw new ConflictError('auth.totp_already_enabled');
    }
    const body: TotpSetupResponse = newTotpSecret(TOTP_ISSUER, user.username);
    req.session.pendingTotpSecret = body.secret;
    res.json(body);
  });

  /** Le premier code confirme le secret ; les appareils mémorisés sont révoqués. */
  router.post('/2fa/enable', (req, res) => {
    const { code } = enableTotpSchema.parse(req.body);
    const user = sessionUser(res);
    if (user.totp_enabled === 1) {
      throw new ConflictError('auth.totp_already_enabled');
    }
    const secret = req.session.pendingTotpSecret;
    if (!secret) {
      throw new BadRequestError('auth.totp_setup_expired');
    }
    const step = matchTotpStep(secret, code);
    if (step === null) {
      throw new HttpError(401, 'auth.totp_invalid');
    }
    db.transaction(() => {
      repo.enableTotp(user.id, secret, step);
      devices.revokeAll(user.id);
    })();
    delete req.session.pendingTotpSecret;
    res.status(204).end();
  });

  router.post('/2fa/disable', async (req, res) => {
    const { password } = disableTotpSchema.parse(req.body);
    const user = sessionUser(res);
    if (user.totp_enabled !== 1) {
      throw new ConflictError('auth.totp_not_enabled');
    }
    await checkCurrentPassword(user, password);
    db.transaction(() => {
      usersRepo.disableTotp(user.id);
      devices.revokeAll(user.id);
    })();
    res.status(204).end();
  });

  router.get('/devices', (req, res) => {
    const now = Date.now();
    devices.purgeExpired(now);
    const currentHash = deviceCookies.currentHash(req);
    const items: TrustedDeviceItem[] = devices.list(currentUserId(res), now).map((device) => ({
      id: device.id,
      label: device.label,
      createdAt: device.created_at,
      lastUsedAt: device.last_used_at,
      expiresAt: device.expires_at,
      current: device.token_hash === currentHash,
    }));
    res.json({ items });
  });

  router.delete('/devices/:id', (req, res) => {
    const id = deviceIdSchema.parse(req.params.id);
    const device = devices.get(id, currentUserId(res));
    if (!device) {
      throw new NotFoundError('auth.device_not_found');
    }
    devices.remove(device.id, device.user_id);
    if (deviceCookies.currentHash(req) === device.token_hash) {
      deviceCookies.clear(req, res);
    }
    res.status(204).end();
  });

  /** Le cookie n'est effacé que s'il appartient au compte (navigateur partagé). */
  router.delete('/devices', (req, res) => {
    const userId = currentUserId(res);
    const ownsCookie = deviceCookies.belongsTo(req, userId);
    devices.revokeAll(userId);
    if (ownsCookie) {
      deviceCookies.clear(req, res);
    }
    res.status(204).end();
  });

  return router;
}
