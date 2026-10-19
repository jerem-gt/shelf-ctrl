import type { PlatformItem } from '@shelfctrl/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { DEFAULT_PLATFORMS } from '@/lib/platforms';

const PLATFORMS_KEY = ['platforms'] as const;

export function usePlatforms() {
  return useQuery({ queryKey: PLATFORMS_KEY, queryFn: api.platforms.list });
}

/** Toute modification des réglages recharge la liste, qui sert aux formulaires de vente. */
function usePlatformMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLATFORMS_KEY }),
  });
}

export const useAddPlatform = () =>
  usePlatformMutation((payload: { name: string; publishUrl?: string }) =>
    api.platforms.add(payload),
  );

export const useSetPlatformUrl = () =>
  usePlatformMutation(({ id, publishUrl }: { id: number; publishUrl: string | null }) =>
    api.platforms.setUrl(id, publishUrl),
  );

export const useRemovePlatform = () =>
  usePlatformMutation((id: number) => api.platforms.remove(id));

export const useSetDefaultPlatform = () =>
  usePlatformMutation((id: number | null) => api.platforms.setDefault(id));

export interface PlatformChoices {
  /** Noms proposés dans les formulaires de vente. */
  names: string[];
  /** Plateforme présélectionnée à la mise en vente (`null` : aucune). */
  defaultName: string | null;
  /** Le compte n'a réglé aucune plateforme : on propose celles que l'application connaît. */
  unconfigured: boolean;
  items: readonly PlatformItem[];
}

/**
 * Plateformes à proposer : celles du compte, ou à défaut toutes les plateformes connues, pour que
 * l'application serve avant tout réglage. `current` (annonce existante) reste proposée même si elle
 * a été retirée des réglages, pour ne pas la perdre à la modification.
 */
export function usePlatformChoices(current: string | null = null): PlatformChoices {
  const { data } = usePlatforms();
  const items = data?.items ?? [];
  const unconfigured = items.length === 0;
  const configured = unconfigured ? [...DEFAULT_PLATFORMS] : items.map((item) => item.name);
  const known = current !== null && current !== '' && !configured.includes(current);
  return {
    names: known ? [current, ...configured] : configured,
    defaultName: items.find((item) => item.isDefault)?.name ?? null,
    unconfigured,
    items,
  };
}
