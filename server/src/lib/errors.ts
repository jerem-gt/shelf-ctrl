import { createHttpErrors } from '@jerem-gt/ctrl-shared/server/errors';

import { type ErrorCode, renderMessage } from './errorCodes.js';

/**
 * Erreurs HTTP typées sur le registre de codes du projet (cf. errorCodes.ts), levées par les
 * services et les routes et traduites en réponse par le gestionnaire d'erreur global :
 * `BadRequestError` (400), `NotFoundError` (404, y compris un objet d'un autre compte),
 * `ConflictError` (409), ou `HttpError(status, code)` pour les autres statuts.
 */
export const { HttpError, BadRequestError, NotFoundError, ConflictError } =
  createHttpErrors<ErrorCode>(renderMessage);
export type HttpError = InstanceType<typeof HttpError>;
