import type { CopyItem } from '@shelfctrl/types';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/client';
import {
  useFetchCover,
  useRemoveCover,
  useRemovePhoto,
  useUploadCover,
  useUploadPhoto,
} from '@/hooks/useImages';
import { coverUrl, photoUrl } from '@/lib/images';

import { ImageSlot } from './ImageSlot';

/** Pochette de l'édition (récupérable en ligne) et photo de l'exemplaire. */
export function ImagesSection({ copy }: Readonly<{ copy: CopyItem }>) {
  const { t } = useTranslation();
  const { edition, work } = copy;
  const uploadCover = useUploadCover(edition.id);
  const removeCover = useRemoveCover(edition.id);
  const fetchCover = useFetchCover(edition.id);
  const uploadPhoto = useUploadPhoto(copy.id);
  const removePhoto = useRemovePhoto(copy.id);

  let fetchError: string | null = null;
  if (fetchCover.error) {
    const notFound = fetchCover.error instanceof ApiError && fetchCover.error.status === 404;
    fetchError = notFound ? t('images.notFoundOnline') : fetchCover.error.message;
  }

  return (
    <section
      aria-label={t('images.section')}
      className="flex flex-col gap-4 border-t border-slate-200 pt-4"
    >
      <h3 className="font-semibold">{t('images.section')}</h3>
      <div className="grid gap-6 sm:grid-cols-2">
        <ImageSlot
          title={t('images.cover')}
          hint={t('images.coverHint')}
          url={coverUrl(edition.coverPath)}
          alt={t('images.coverAlt', { title: work.title })}
          uploading={uploadCover.isPending}
          removing={removeCover.isPending}
          error={uploadCover.error?.message ?? removeCover.error?.message ?? fetchError}
          onUpload={(file) => {
            fetchCover.reset();
            uploadCover.mutate(file);
          }}
          onRemove={() => removeCover.mutate()}
        >
          <button
            type="button"
            disabled={fetchCover.isPending || uploadCover.isPending}
            onClick={() => fetchCover.mutate()}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            {t(fetchCover.isPending ? 'images.searching' : 'images.findOnline')}
          </button>
        </ImageSlot>
        <ImageSlot
          title={t('images.photo')}
          hint={t('images.photoHint')}
          url={photoUrl(copy.photoPath)}
          alt={t('images.photoAlt', { title: work.title })}
          uploading={uploadPhoto.isPending}
          removing={removePhoto.isPending}
          error={uploadPhoto.error?.message ?? removePhoto.error?.message ?? null}
          onUpload={(file) => uploadPhoto.mutate(file)}
          onRemove={() => removePhoto.mutate()}
        />
      </div>
    </section>
  );
}
