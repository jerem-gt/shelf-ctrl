import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type CreateUserPayload, type UpdateUserPayload } from '@/api/client';

import { ME_KEY } from './useAuth';

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

/** Le compte modifié peut être le sien (nom, rôle) : la session est relue aussi. */
export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUserPayload }) =>
      api.users.update(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: USERS_KEY }),
        queryClient.invalidateQueries({ queryKey: ME_KEY }),
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

export function useTestEmail() {
  return useMutation({ mutationFn: api.auth.testEmail });
}
