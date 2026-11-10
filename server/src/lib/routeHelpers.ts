import { createIdParamParser } from '@jerem-gt/ctrl-shared/server/params';

import { HttpError } from './errors.js';

/** Paramètre de route entier strictement positif (`id` par défaut), sinon 400 `common.invalid_param`. */
export const parseIdParam = createIdParamParser(HttpError);
