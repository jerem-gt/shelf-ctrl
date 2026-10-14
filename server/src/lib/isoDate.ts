import { z } from 'zod';

/** Date AAAA-MM-JJ qui existe réellement (le 2026-02-30 est refusé). */
export const isoDate = z
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

/** Date du jour (UTC) au format AAAA-MM-JJ. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
