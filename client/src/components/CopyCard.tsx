import type { CopyItem } from '@shelfctrl/types';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { StatusBadge } from './StatusBadge';

export function CopyCard({ copy }: Readonly<{ copy: CopyItem }>) {
  const { t } = useTranslation();
  const { work, edition } = copy;

  return (
    <article className="relative flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-400">
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
        <span>{t(`formats.${edition.format}`)}</span>
        <span>{t(`conditions.${copy.condition}`)}</span>
        {copy.location && (
          <span className="flex items-center gap-1">
            <MapPin aria-hidden className="size-3.5" />
            {copy.location}
          </span>
        )}
      </p>
    </article>
  );
}
