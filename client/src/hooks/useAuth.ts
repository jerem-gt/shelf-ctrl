import type { SessionResponse } from '@shelfctrl/types';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type LoginPayload, type ProfilePayload, type SetupPayload } from '@/api/client';

export const ME_KEY = ['me'] as const;
export const SETUP_KEY = ['auth', 'setup'] as const;

/** Utilisateur connecté ; une erreur 401 signifie « pas de session », ce n'est pas à réessayer. */
export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: api.auth.me, retry: false, staleTime: Infinity });
}

/** Aucun compte en base : l'application attend la création du premier (voir `SetupPage`). */
export function useSetupStatus() {
  return useQuery({ queryKey: SETUP_KEY, queryFn: api.auth.setupStatus });
}

/** Une nouvelle session ne doit rien voir des données de la précédente (autre compte possible). */
function startSession(queryClient: QueryClient, session: SessionResponse) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_KEY[0] });
  queryClient.setQueryData(ME_KEY, session);
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoginPayload) => api.auth.login(payload),
    onSuccess: (session) => startSession(queryClient, session),
  });
}

export function useSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SetupPayload) => api.auth.setup(payload),
    onSuccess: (session) => startSession(queryClient, session),
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

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProfilePayload) => api.auth.updateProfile(payload),
    onSuccess: (session) => {
      queryClient.setQueryData(ME_KEY, session);
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      api.auth.changePassword(current, next),
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (identifier: string) => api.auth.forgotPassword(identifier) });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      api.auth.resetPassword(token, password),
  });
}
