import { useMutation } from '@tanstack/react-query';

import { api } from '@/api/client';

/** Déclenchée à la demande (bouton, scan) : une mutation plutôt qu'une requête automatique. */
export function useBarcodeLookup() {
  return useMutation({ mutationFn: (code: string) => api.barcodes.lookup(code) });
}
