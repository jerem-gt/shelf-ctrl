import { type ErrorCode, type ErrorParams, renderMessage } from './errorCodes.js';

/**
 * Erreurs HTTP typées levées par les services et les routes, traduites en réponse par le
 * gestionnaire d'erreur global. Portent un `code` d'erreur stable (cf. errorCodes.ts) + des
 * paramètres d'interpolation optionnels ; le message FR dérivé sert de repli lisible.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    public readonly params?: ErrorParams,
  ) {
    super(renderMessage(code, params));
    this.name = new.target.name;
  }
}

/** 400 — requête invalide (règle métier non respectée, date incohérente, etc.). */
export class BadRequestError extends HttpError {
  constructor(code: ErrorCode, params?: ErrorParams) {
    super(400, code, params);
  }
}

/** 404 — ressource introuvable (ou appartenant à un autre compte). */
export class NotFoundError extends HttpError {
  constructor(code: ErrorCode, params?: ErrorParams) {
    super(404, code, params);
  }
}

/** 409 — conflit (doublon, état incompatible…). */
export class ConflictError extends HttpError {
  constructor(code: ErrorCode, params?: ErrorParams) {
    super(409, code, params);
  }
}
