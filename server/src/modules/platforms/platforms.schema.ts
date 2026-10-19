import { z } from 'zod';

/**
 * Adresse http(s) uniquement : elle devient un lien cliquable, donc jamais `javascript:` ni
 * `data:`. Absente ou vide : pas d'adresse.
 */
const publishUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    try {
      const { protocol } = new URL(value);
      return protocol === 'https:' || protocol === 'http:';
    } catch {
      return false;
    }
  });

export const createPlatformSchema = z.object({
  name: z.string().trim().min(1).max(100),
  publishUrl: publishUrl.nullish(),
});

export const updatePlatformSchema = z.object({
  publishUrl: publishUrl.nullable(),
});

export const setDefaultSchema = z.object({
  id: z.number().int().positive().nullable(),
});

export type CreatePlatformInput = z.infer<typeof createPlatformSchema>;
export type UpdatePlatformInput = z.infer<typeof updatePlatformSchema>;
