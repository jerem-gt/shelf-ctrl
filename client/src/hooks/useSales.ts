import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type SalePayload } from '@/api/client';

const SALES_KEY = ['sales'] as const;

/** Une mise en vente ou une vente change le statut des exemplaires et les listes de ventes. */
function invalidateAll(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['copies'] }),
    queryClient.invalidateQueries({ queryKey: SALES_KEY }),
  ]);
}

export function useCopySale(copyId: number) {
  return useQuery({
    queryKey: [...SALES_KEY, 'copy', copyId],
    queryFn: () => api.sales.forCopy(copyId),
  });
}

export function useAllSales() {
  return useQuery({ queryKey: [...SALES_KEY, 'all'], queryFn: api.sales.all });
}

export function useListForSale(copyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SalePayload & { listedAt?: string }) =>
      api.sales.listForSale(copyId, payload),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useSellCopy(copyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SalePayload & { soldAt?: string }) => api.sales.sell(copyId, payload),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateSale(copyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SalePayload) => api.sales.update(copyId, payload),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useRemoveSale(copyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.sales.remove(copyId),
    onSuccess: () => invalidateAll(queryClient),
  });
}
