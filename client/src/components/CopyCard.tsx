import { type CopyItem, kindOfFormat } from '@shelfctrl/types';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { coverUrl } from '@/lib/images';

import { KindIcon } from './KindIcon';
import { StatusBadge } from './StatusBadge';

/** Pochette en miniature, ou l'icône du type de média quand l'édition n'en a pas. */
function CoverThumbnail({ copy }: Readonly<{ copy: CopyItem }>) {
  const url = coverUrl(copy.edition.coverPath);
  return (
    <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-emphasis text-content-faint">
      {url ? (
        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <KindIcon kind={kindOfFormat(copy.edition.format)} className="size-6" />
      )}
    </div>
  );
}

export function CopyCard({ copy }: Readonly<{ copy: CopyItem }>) {
  const { t } = useTranslation();
  const { work, edition } = copy;

  return (
    <article className="relative flex gap-3 rounded-lg border border-line-subtle bg-surface p-4 shadow-sm hover:border-line-strong">
      <CoverThumbnail copy={copy} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-content">
              <Link to={`/copies/${copy.id}`} className="after:absolute after:inset-0">
                {work.title}
              </Link>
            </h2>
            {work.series && (
              <p className="truncate text-sm text-content-muted">
                {work.series}
                {work.volumeNumber !== null &&
                  ` · ${t('collection.volume', { number: work.volumeNumber })}`}
              </p>
            )}
          </div>
          <StatusBadge status={copy.status} />
        </div>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-content-muted">
          <span>{edition.console ?? t(`formats.${edition.format}`)}</span>
          <span>{t(`conditions.${copy.condition}`)}</span>
          {copy.location && (
            <span className="flex items-center gap-1">
              <MapPin aria-hidden className="size-3.5" />
              {copy.location}
            </span>
          )}
        </p>
      </div>
    </article>
  );
}
