import type { Database } from 'better-sqlite3';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

/** Le compte de la requête est posé dans `res.locals.userId`, lu par `currentUserId`. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = req.session?.userId;
  if (userId) {
    res.locals.userId = userId;
    next();
    return;
  }
  res.status(401).json({ error: 'unauthorized' });
}

/** Sans authentification (tests) : toutes les requêtes agissent pour ce compte. */
export function actAs(userId: number): RequestHandler {
  return (_req, res, next) => {
    res.locals.userId = userId;
    next();
  };
}

export function currentUserId(res: Response): number {
  return res.locals.userId as number;
}

/** Le rôle admin est lu en base à chaque requête : une rétrogradation prend effet tout de suite. */
export function createRequireAdmin(db: Database): RequestHandler {
  const isAdminStmt = db.prepare<[number], { is_admin: number }>(
    'SELECT is_admin FROM users WHERE id = ?',
  );
  return (_req, res, next) => {
    const userId = res.locals.userId as number | undefined;
    if (userId && isAdminStmt.get(userId)?.is_admin === 1) {
      next();
      return;
    }
    res.status(403).json({ error: 'forbidden' });
  };
}
