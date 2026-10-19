import { useMutation } from '@tanstack/react-query';

import { api } from '@/api/client';

/** Déclenchée à la demande (bouton, Entrée) : une mutation plutôt qu'une requête automatique. */
export function useTitleSearch() {
  return useMutation({ mutationFn: (query: string) => api.titles.search(query) });
}
