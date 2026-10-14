import { COPY_CONDITIONS, COPY_STATUSES, MEDIA_FORMATS } from '@shelfctrl/types';
import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => text(max).nullish();
const optionalYear = z.number().int().min(1000).max(2100).nullish();

/** ISBN-10 (clé X possible), ISBN-13 ou EAN-8/13/14. */
const barcode = z
  .string()
  .trim()
  .regex(/^(\d{8,14}|\d{9}[\dXx])$/);

const workInput = z.object({
  title: text(200),
  series: optionalText(200),
  volumeNumber: z.number().int().positive().nullish(),
  creators: optionalText(300),
  year: optionalYear,
});

const editionInput = z.object({
  format: z.enum(MEDIA_FORMATS),
  barcode: barcode.nullish(),
  publisher: optionalText(200),
  releaseYear: optionalYear,
  language: optionalText(20),
});

/**
 * `work` et `edition` décrivent le titre à créer. Si `edition.barcode` correspond
 * à une édition déjà connue, celle-ci est réutilisée et les deux blocs sont ignorés.
 */
export const createCopySchema = z.object({
  work: workInput,
  edition: editionInput,
  condition: z.enum(COPY_CONDITIONS).default('good'),
  conditionNote: optionalText(500),
  location: optionalText(100),
});

export const updateCopySchema = z
  .object({
    condition: z.enum(COPY_CONDITIONS),
    conditionNote: optionalText(500),
    location: optionalText(100),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Aucun champ à modifier' });

export const copyIdSchema = z.coerce.number().int().positive();

export const listCopiesSchema = z.object({
  q: z.string().trim().max(100).optional(),
  format: z.enum(MEDIA_FORMATS).optional(),
  status: z.enum(COPY_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateCopyInput = z.infer<typeof createCopySchema>;
export type UpdateCopyInput = z.infer<typeof updateCopySchema>;
export type ListCopiesQuery = z.infer<typeof listCopiesSchema>;
