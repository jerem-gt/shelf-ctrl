import { useMutation } from '@tanstack/react-query';

import { api } from '@/api/client';

/** Génère un brouillon d'annonce : rien n'est enregistré côté serveur. */
export function useListingDraft(copyId: number) {
  return useMutation({
    mutationFn: (platform?: string) => api.listings.draft(copyId, platform),
  });
}
