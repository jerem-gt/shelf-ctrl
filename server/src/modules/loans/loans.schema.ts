import { z } from 'zod';

/** Date AAAA-MM-JJ qui existe réellement (le 2026-02-30 est refusé). */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => {
      // Exécutée même quand le format est déjà refusé : ne doit jamais lever d'exception.
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
    },
    { message: 'Date invalide' },
  );

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
