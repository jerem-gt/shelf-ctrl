import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type LendPayload } from '@/api/client';
import { localToday } from '@/lib/format';

const LOANS_KEY = ['loans'] as const;

/** Un prêt ou un retour change le statut des exemplaires, les listes de prêts et les compteurs. */
function invalidateAll(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['copies'] }),
    queryClient.invalidateQueries({ queryKey: LOANS_KEY }),
    queryClient.invalidateQueries({ queryKey: ['borrowers'] }),
  ]);
}

export function useCopyLoans(copyId: number) {
  return useQuery({
    queryKey: [...LOANS_KEY, 'copy', copyId],
    queryFn: () => api.loans.forCopy(copyId),
  });
}

export function useOpenLoans() {
  return useQuery({ queryKey: [...LOANS_KEY, 'open'], queryFn: api.loans.open });
}

export function useBorrowers() {
  return useQuery({ queryKey: ['borrowers'], queryFn: api.borrowers.list });
}

export function useLendCopy(copyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LendPayload) => api.loans.lend(copyId, payload),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useGiveBack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (loanId: number) => api.loans.giveBack(loanId, localToday()),
    onSuccess: () => invalidateAll(queryClient),
  });
}
