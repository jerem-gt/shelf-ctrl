import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';

/** Une image change l'édition ou l'exemplaire affichés dans la liste comme dans la fiche. */
function useInvalidateCopies() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['copies'] });
}

export function useUploadCover(editionId: number) {
  const invalidate = useInvalidateCopies();
  return useMutation({
    mutationFn: (file: File) => api.images.uploadCover(editionId, file),
    onSuccess: invalidate,
  });
}

export function useRemoveCover(editionId: number) {
  const invalidate = useInvalidateCopies();
  return useMutation({
    mutationFn: () => api.images.removeCover(editionId),
    onSuccess: invalidate,
  });
}

export function useFetchCover(editionId: number) {
  const invalidate = useInvalidateCopies();
  return useMutation({
    mutationFn: () => api.images.fetchCover(editionId),
    onSuccess: invalidate,
  });
}

export function useUploadPhoto(copyId: number) {
  const invalidate = useInvalidateCopies();
  return useMutation({
    mutationFn: (file: File) => api.images.uploadPhoto(copyId, file),
    onSuccess: invalidate,
  });
}

export function useRemovePhoto(copyId: number) {
  const invalidate = useInvalidateCopies();
  return useMutation({
    mutationFn: () => api.images.removePhoto(copyId),
    onSuccess: invalidate,
  });
}
