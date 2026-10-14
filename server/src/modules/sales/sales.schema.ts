import { z } from 'zod';

import { isoDate } from '../../lib/isoDate.js';

const platform = z.string().trim().min(1).max(100);
/** En centimes ; 100 000 € au plus. */
const priceCents = z.number().int().min(0).max(10_000_000);

export const listSchema = z.object({
  platform: platform.nullish(),
  priceCents: priceCents.nullish(),
  /** Par défaut : aujourd'hui. */
  listedAt: isoDate.optional(),
});

/** Vente d'un exemplaire en vente, ou vente directe sans annonce préalable. */
export const sellSchema = z.object({
  platform: platform.nullish(),
  /** Prix final ; à défaut, celui de l'annonce. */
  priceCents: priceCents.nullish(),
  /** Par défaut : aujourd'hui. */
  soldAt: isoDate.optional(),
});

export const updateSaleSchema = z
  .object({
    platform: platform.nullable(),
    priceCents: priceCents.nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Aucun champ à modifier' });

export type ListInput = z.infer<typeof listSchema>;
export type SellInput = z.infer<typeof sellSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
