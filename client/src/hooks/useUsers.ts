import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type CreateUserPayload, type UpdateUserPayload } from '@/api/client';

import { DEVICES_KEY, ME_KEY } from './useAuth';

export const USERS_KEY = ['users'] as const;

export function useUsers() {
  return useQuery({ queryKey: USERS_KEY, queryFn: api.users.list });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => api.users.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

/**
 * Le compte modifié peut être le sien (nom, rôle, mot de passe qui révoque ses appareils) : la
 * session et les appareils mémorisés sont relus aussi.
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUserPayload }) =>
      api.users.update(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: USERS_KEY }),
        queryClient.invalidateQueries({ queryKey: ME_KEY }),
        queryClient.invalidateQueries({ queryKey: DEVICES_KEY }),
      ]);
    },
  });
}

export function useRemoveUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.users.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

/** Téléphone perdu : l'admin désactive la 2FA d'un compte (le sien compris). */
export function useDisableUserTotp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.users.disableTotp(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: USERS_KEY }),
        queryClient.invalidateQueries({ queryKey: ME_KEY }),
        queryClient.invalidateQueries({ queryKey: DEVICES_KEY }),
      ]);
    },
  });
}

export function useTestEmail() {
  return useMutation({ mutationFn: api.auth.testEmail });
}
