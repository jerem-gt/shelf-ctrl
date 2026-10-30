import type { Response } from 'express';
import type { z } from 'zod';

import {
  type ApiErrorBody,
  type ApiErrorField,
  buildError,
  type ErrorCode,
  type ErrorParams,
  renderMessage,
} from './errorCodes.js';

/** Envoie une erreur structurée `{ error: { code, message, params? } }`. */
export function sendError(
  res: Response,
  status: number,
  code: ErrorCode,
  params?: ErrorParams,
): void {
  res.status(status).json({ error: buildError(code, params) });
}

/**
 * Champ absent : sans `reportInput`, Zod ne joint pas la valeur reçue (`issue.input` est toujours
 * indéfini) ; son message par défaut, qu'aucun schéma ne remplace, se termine par « received undefined ».
 */
function isMissing(issue: z.core.$ZodIssueInvalidType): boolean {
  return issue.message.endsWith('received undefined');
}

/** Mappe une issue Zod vers un code de validation traduisible + ses paramètres. */
function classifyIssue(issue: z.core.$ZodIssue): { code: ErrorCode; params?: ErrorParams } {
  switch (issue.code) {
    case 'invalid_type':
      return isMissing(issue)
        ? { code: 'validation.required' }
        : { code: 'validation.invalid_type' };
    case 'too_small': {
      const minimum = Number(issue.minimum);
      return issue.origin === 'string' || issue.origin === 'array'
        ? { code: 'validation.too_short', params: { minimum } }
        : { code: 'validation.too_small', params: { minimum } };
    }
    case 'too_big': {
      const maximum = Number(issue.maximum);
      return issue.origin === 'string' || issue.origin === 'array'
        ? { code: 'validation.too_long', params: { maximum } }
        : { code: 'validation.too_big', params: { maximum } };
    }
    case 'invalid_format':
      return { code: 'validation.invalid_format' };
    case 'invalid_value':
      return { code: 'validation.invalid_value' };
    default:
      return { code: 'validation.invalid' };
  }
}

function mapZodIssue(issue: z.core.$ZodIssue): ApiErrorField {
  const path = issue.path.map(String).join('.') || '(root)';
  const { code, params } = classifyIssue(issue);
  return { path, code, ...(params ? { params } : {}), message: renderMessage(code, params) };
}

/** Construit le corps d'erreur de validation (code générique + détail par champ). */
export function zodToApiError(error: z.ZodError): ApiErrorBody {
  return {
    code: 'validation.invalid',
    message: renderMessage('validation.invalid'),
    fields: error.issues.map(mapZodIssue),
  };
}
