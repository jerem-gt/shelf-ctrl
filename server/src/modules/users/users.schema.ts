import { z } from 'zod';

import { emailSchema, newPasswordSchema, usernameSchema } from '../auth/auth.schema.js';

export const userIdSchema = z.coerce.number().int().positive();

export const createUserSchema = z.object({
  username: usernameSchema,
  password: newPasswordSchema,
  email: emailSchema.nullable().optional(),
  isAdmin: z.boolean().optional(),
});

export const updateUserSchema = z
  .object({
    username: usernameSchema.optional(),
    password: newPasswordSchema.optional(),
    email: emailSchema.nullable().optional(),
    isAdmin: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.username !== undefined ||
      d.password !== undefined ||
      d.email !== undefined ||
      d.isAdmin !== undefined,
    { message: 'Au moins un champ requis' },
  );
