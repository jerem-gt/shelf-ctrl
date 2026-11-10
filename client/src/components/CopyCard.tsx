import type { CopyItem } from '@shelfctrl/types';
import type { MediaFormat } from '@shelfctrl/types';
import { BookOpen, Disc3, Gamepad2, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { coverUrl } from '@/lib/images';

import { StatusBadge } from './StatusBadge';

/** Icône du support : livre, jeu vidéo ou disque (film). */
function FormatIcon({ format }: Readonly<{ format: MediaFormat }>) {
  if (format === 'book') {
    return <BookOpen aria-hidden className="size-6" />;
  }
  if (format === 'game') {
    return <Gamepad2 aria-hidden className="size-6" />;
  }
  return <Disc3 aria-hidden className="size-6" />;
}

/** Pochette en miniature, ou une icône du support quand l'édition n'en a pas. */
function CoverThumbnail({ copy }: Readonly<{ copy: CopyItem }>) {
  const url = coverUrl(copy.edition.coverPath);
  return (
    <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100 text-slate-400">
      {url ? (
        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <FormatIcon format={copy.edition.format} />
      )}
    </div>
  );
}

export function CopyCard({ copy }: Readonly<{ copy: CopyItem }>) {
  const { t } = useTranslation();
  const { work, edition } = copy;

  return (
    <article className="relative flex gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-400">
      <CoverThumbnail copy={copy} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-slate-900">
              <Link to={`/copies/${copy.id}`} className="after:absolute after:inset-0">
                {work.title}
              </Link>
            </h2>
            {work.series && (
              <p className="truncate text-sm text-slate-600">
                {work.series}
                {work.volumeNumber !== null &&
                  ` · ${t('collection.volume', { number: work.volumeNumber })}`}
              </p>
            )}
          </div>
          <StatusBadge status={copy.status} />
        </div>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
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
