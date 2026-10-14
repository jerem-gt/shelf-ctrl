import type { SaleListItem } from '@shelfctrl/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useAllSales } from '@/hooks/useSales';
import { formatIsoDate } from '@/lib/format';
import { formatPrice } from '@/lib/money';

type Tab = 'listed' | 'sold';

function SaleRow({ sale }: Readonly<{ sale: SaleListItem }>) {
  const { t } = useTranslation();
  const sold = sale.soldAt !== null;
  const date = sale.soldAt ?? sale.listedAt;

  let when = null;
  if (date) {
    when = t(sold ? 'salesPage.soldOn' : 'salesPage.listedSince', { date: formatIsoDate(date) });
  }
  const details = [
    sale.platform,
    sale.priceCents === null ? t('salesPage.noPrice') : formatPrice(sale.priceCents),
    when,
  ].filter(Boolean);

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Link to={`/copies/${sale.copyId}`} className="block truncate font-semibold">
        {sale.work.title}
      </Link>
      {sale.work.series && (
        <p className="truncate text-sm text-slate-600">
          {sale.work.series}
          {sale.work.volumeNumber !== null &&
            ` · ${t('collection.volume', { number: sale.work.volumeNumber })}`}
        </p>
      )}
      <p className="text-sm text-slate-600">{details.join(' · ')}</p>
    </li>
  );
}

export function SalesPage() {
  const { t } = useTranslation();
  const { data: sales, error, isPending } = useAllSales();
  const [tab, setTab] = useState<Tab>('listed');

  const shown = (sales ?? []).filter((sale) => (tab === 'sold') === (sale.soldAt !== null));
  const total = shown.reduce((sum, sale) => sum + (sale.priceCents ?? 0), 0);

  let content;
  if (error) {
    content = (
      <p role="alert" className="text-red-700">
        {error.message}
      </p>
    );
  } else if (isPending) {
    content = <p className="text-slate-500">{t('collection.loading')}</p>;
  } else if (shown.length === 0) {
    content = (
      <p className="text-slate-500">
        {t(tab === 'sold' ? 'salesPage.emptySold' : 'salesPage.emptyListed')}
      </p>
    );
  } else {
    content = (
      <>
        {tab === 'sold' && (
          <p className="font-semibold">{t('salesPage.total', { amount: formatPrice(total) })}</p>
        )}
        <ul className="flex flex-col gap-3">
          {shown.map((sale) => (
            <SaleRow key={sale.id} sale={sale} />
          ))}
        </ul>
      </>
    );
  }

  const tabClass = (current: Tab) =>
    current === tab
      ? 'border-b-2 border-slate-900 px-3 py-2 text-sm font-semibold'
      : 'px-3 py-2 text-sm text-slate-500';

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{t('salesPage.title')}</h2>
      <div role="tablist" className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'listed'}
          onClick={() => setTab('listed')}
          className={tabClass('listed')}
        >
          {t('salesPage.listedTab')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sold'}
          onClick={() => setTab('sold')}
          className={tabClass('sold')}
        >
          {t('salesPage.soldTab')}
        </button>
      </div>
      {content}
    </section>
  );
}
