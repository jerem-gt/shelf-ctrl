import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type CopyFilters, type CreateCopyPayload } from '@/api/client';

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
