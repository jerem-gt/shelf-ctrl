import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api } from '@/api/client';

const POLL_INTERVAL_MS = 1000;

/** Contrôle le fichier sans rien écrire : à la demande, d'où une mutation. */
export function usePreviewImport() {
  return useMutation({ mutationFn: (file: File) => api.import.preview(file) });
}

export function useStartImport() {
  return useMutation({ mutationFn: (file: File) => api.import.start(file) });
}

/** Suit un import : relu chaque seconde tant qu'il tourne, puis la collection est rechargée. */
export function useImportJob(id: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['import', id],
    queryFn: () => api.import.job(id ?? ''),
    enabled: id !== null,
    // Un import inconnu (404, serveur redémarré) ne se corrige pas en réessayant.
    retry: false,
    refetchInterval: (current) =>
      current.state.data?.status === 'running' ? POLL_INTERVAL_MS : false,
  });

  const status = query.data?.status;
  useEffect(() => {
    if (status === 'done' || status === 'failed') {
      void queryClient.invalidateQueries({ queryKey: ['copies'] });
    }
  }, [status, queryClient]);

  return query;
}
