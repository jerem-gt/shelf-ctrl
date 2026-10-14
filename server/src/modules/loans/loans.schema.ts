import { z } from 'zod';

import { isoDate } from '../../lib/isoDate.js';

export const lendSchema = z.object({
  borrowerName: z.string().trim().min(1).max(100),
  /** Par défaut : aujourd'hui. */
  loanedAt: isoDate.optional(),
});

export const returnSchema = z.object({
  /** Par défaut : aujourd'hui. */
  returnedAt: isoDate.optional(),
});

export type LendInput = z.infer<typeof lendSchema>;
export type ReturnInput = z.infer<typeof returnSchema>;
