import { z } from 'zod';

/** Normalisé (espaces retirés, minuscules) : l'unicité et la recherche se font sur cette forme. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const usernameSchema = z.string().trim().min(1).max(64);
export const newPasswordSchema = z.string().min(8).max(200);

export const loginSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

export const setupSchema = z.object({
  token: z.string().min(1),
  username: usernameSchema,
  password: newPasswordSchema,
});

export const profileSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    username: usernameSchema.optional(),
    email: emailSchema.nullable().optional(),
  })
  .refine((d) => d.username !== undefined || d.email !== undefined, {
    message: 'Au moins un champ requis',
  });

export const changePasswordSchema = z.object({
  current: z.string().min(1).max(200),
  next: newPasswordSchema,
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  password: newPasswordSchema,
});
