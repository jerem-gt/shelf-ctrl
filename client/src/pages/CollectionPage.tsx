import { COPY_STATUSES, type CopyStatus, MEDIA_FORMATS, type MediaFormat } from '@shelfctrl/types';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { CopyFilters } from '@/api/client';
import { CopyCard } from '@/components/CopyCard';
import { useCopies } from '@/hooks/useCopies';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const FIELD_CLASS =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none';

function isMediaFormat(value: string): value is MediaFormat {
  return (MEDIA_FORMATS as readonly string[]).includes(value);
}

function isCopyStatus(value: string): value is CopyStatus {
  return (COPY_STATUSES as readonly string[]).includes(value);
}

export function CollectionPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [format, setFormat] = useState<MediaFormat | ''>('');
  const [status, setStatus] = useState<CopyStatus | ''>('');

  const q = useDebouncedValue(search.trim(), 300);
  const filters: CopyFilters = {
    q: q || undefined,
    format: format || undefined,
    status: status || undefined,
  };
  const hasFilters = Boolean(q || format || status);
  const { data, isPending, error, refetch } = useCopies(filters);

  let content;
  if (error) {
    content = (
      <div role="alert" className="flex flex-col items-start gap-2 text-red-700">
        <p>{error.message}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-md border border-red-300 px-3 py-1 text-sm"
        >
          {t('collection.retry')}
        </button>
      </div>
    );
  } else if (isPending) {
    content = <p className="text-slate-500">{t('collection.loading')}</p>;
  } else if (data.items.length === 0) {
    content = (
      <p className="text-slate-500">
        {hasFilters ? t('collection.noResult') : t('collection.empty')}
      </p>
    );
  } else {
    content = (
      <>
        <p className="text-sm text-slate-500">{t('collection.count', { count: data.total })}</p>
        <ul className="grid gap-3 md:grid-cols-2">
          {data.items.map((copy) => (
            <li key={copy.id}>
              <CopyCard copy={copy} />
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t('collection.title')}</h2>
        <Link
          to="/add"
          className="flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          <Plus aria-hidden className="size-4" />
          {t('collection.add')}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="flex flex-col gap-1 text-sm">
          <span className="sr-only">{t('collection.searchLabel')}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('collection.searchPlaceholder')}
            aria-label={t('collection.searchLabel')}
            className={FIELD_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="sr-only">{t('collection.formatFilter')}</span>
          <select
            value={format}
            onChange={(event) =>
              setFormat(isMediaFormat(event.target.value) ? event.target.value : '')
            }
            aria-label={t('collection.formatFilter')}
            className={FIELD_CLASS}
          >
            <option value="">
              {t('collection.formatFilter')} : {t('collection.all')}
            </option>
            {MEDIA_FORMATS.map((value) => (
              <option key={value} value={value}>
                {t(`formats.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="sr-only">{t('collection.statusFilter')}</span>
          <select
            value={status}
            onChange={(event) =>
              setStatus(isCopyStatus(event.target.value) ? event.target.value : '')
            }
            aria-label={t('collection.statusFilter')}
            className={FIELD_CLASS}
          >
            <option value="">
              {t('collection.statusFilter')} : {t('collection.all')}
            </option>
            {COPY_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`statuses.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {content}
    </section>
  );
}
