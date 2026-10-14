import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  api,
  type CopyFilters,
  type CreateCopyPayload,
  type UpdateCopyPayload,
} from '@/api/client';

const COPIES_KEY = ['copies'] as const;

export function useCopies(filters: CopyFilters) {
  return useQuery({
    queryKey: [...COPIES_KEY, filters],
    queryFn: () => api.copies.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useCreateCopy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCopyPayload) => api.copies.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COPIES_KEY }),
  });
}

export function useCopy(id: number) {
  return useQuery({
    queryKey: [...COPIES_KEY, 'detail', id],
    queryFn: () => api.copies.get(id),
    // Un exemplaire inconnu (404) ou un identifiant invalide (400) ne se corrige pas en réessayant.
    retry: false,
  });
}

export function useUpdateCopy(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateCopyPayload) => api.copies.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COPIES_KEY }),
  });
}

export function useDeleteCopy(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.copies.remove(id),
    onSuccess: async () => {
      // Le détail d'abord (sinon il serait rechargé en 404), puis les listes.
      queryClient.removeQueries({ queryKey: [...COPIES_KEY, 'detail', id] });
      await queryClient.invalidateQueries({ queryKey: COPIES_KEY });
    },
  });
}
