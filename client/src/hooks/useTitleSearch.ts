import type { MediaKind } from '@shelfctrl/types';
import { useMutation } from '@tanstack/react-query';

import { api } from '@/api/client';

export interface TitleSearchParams {
  query: string;
  /** Type de média cherché : seules ses sources sont interrogées. */
  kind: MediaKind;
}

/** Déclenchée à la demande (bouton, Entrée) : une mutation plutôt qu'une requête automatique. */
export function useTitleSearch() {
  return useMutation({
    mutationFn: ({ query, kind }: TitleSearchParams) => api.titles.search(query, kind),
  });
}
