import type { SessionResponse } from '@shelfctrl/types';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type LoginPayload, type ProfilePayload, type SetupPayload } from '@/api/client';
import { currentLang } from '@/lib/format';

export const ME_KEY = ['me'] as const;
export const SETUP_KEY = ['auth', 'setup'] as const;
export const DEVICES_KEY = ['auth', 'devices'] as const;

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

/** Avec la 2FA active, la session n'est ouverte qu'après le code (`useVerifyTotp`). */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoginPayload) => api.auth.login(payload),
    onSuccess: (response) => {
      if (!('totpRequired' in response)) {
        startSession(queryClient, response);
      }
    },
  });
}

export function useVerifyTotp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, remember }: { code: string; remember: boolean }) =>
      api.auth.verifyTotp(code, remember),
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

/** Le mot de passe changé révoque les appareils mémorisés. */
export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      api.auth.changePassword(current, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY }),
  });
}

export function useSetupTotp() {
  return useMutation({ mutationFn: api.auth.setupTotp });
}

/** Activer ou désactiver la 2FA change la session et révoque les appareils mémorisés. */
function useTotpToggle<T>(mutationFn: (variables: T) => Promise<undefined>, totpEnabled: boolean) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      queryClient.setQueryData<SessionResponse>(ME_KEY, (old) =>
        old ? { ...old, totpEnabled } : old,
      );
      await queryClient.invalidateQueries({ queryKey: DEVICES_KEY });
    },
  });
}

export function useEnableTotp() {
  return useTotpToggle((code: string) => api.auth.enableTotp(code), true);
}

export function useDisableTotp() {
  return useTotpToggle((password: string) => api.auth.disableTotp(password), false);
}

export function useTrustedDevices() {
  return useQuery({ queryKey: DEVICES_KEY, queryFn: api.auth.devices });
}

export function useForgetDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.auth.forgetDevice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY }),
  });
}

export function useForgetAllDevices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.auth.forgetAllDevices,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY }),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (identifier: string) => api.auth.forgotPassword(identifier, currentLang()),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      api.auth.resetPassword(token, password),
  });
}
