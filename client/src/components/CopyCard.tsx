import type { CopyItem, CopyStatus } from '@shelfctrl/types';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STATUS_STYLES: Record<CopyStatus, string> = {
  owned: 'bg-emerald-100 text-emerald-800',
  loaned: 'bg-amber-100 text-amber-800',
  listed: 'bg-sky-100 text-sky-800',
  sold: 'bg-slate-200 text-slate-700',
};

export function CopyCard({ copy }: Readonly<{ copy: CopyItem }>) {
  const { t } = useTranslation();
  const { work, edition } = copy;

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-slate-900">{work.title}</h2>
          {work.series && (
            <p className="truncate text-sm text-slate-600">
              {work.series}
              {work.volumeNumber !== null &&
                ` · ${t('collection.volume', { number: work.volumeNumber })}`}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[copy.status]}`}
        >
          {t(`statuses.${copy.status}`)}
        </span>
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
