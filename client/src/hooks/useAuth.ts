import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type LoginPayload } from '@/api/client';

export const ME_KEY = ['me'] as const;

/** Utilisateur connecté ; une erreur 401 signifie « pas de session », ce n'est pas à réessayer. */
export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: api.auth.me, retry: false, staleTime: Infinity });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoginPayload) => api.auth.login(payload),
    onSuccess: (session) => {
      queryClient.setQueryData(ME_KEY, session);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.auth.logout,
    onSuccess: async () => {
      // On vide les données de la session (appareil partagé) avant de revérifier l'identité.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_KEY[0] });
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}
