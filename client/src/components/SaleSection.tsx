import type { CopyItem, SaleItem } from '@shelfctrl/types';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCopySale, useRemoveSale } from '@/hooks/useSales';
import { formatIsoDate } from '@/lib/format';
import { formatPrice } from '@/lib/money';

import { ListingDraftPanel } from './ListingDraftPanel';
import { SaleForm, type SaleFormMode } from './SaleForm';

type Mode = 'view' | SaleFormMode | 'cancel';

const BUTTON_CLASS =
  'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-60';

function useSummary() {
  const { t } = useTranslation();
  return (sale: SaleItem): string => {
    const sold = sale.soldAt !== null;
    const parts = [t(sold ? 'sale.sold' : 'sale.listed')];
    if (sale.platform) {
      parts.push(t('sale.onPlatform', { platform: sale.platform }));
    }
    if (sale.priceCents !== null) {
      const key = sold ? 'sale.forPrice' : 'sale.atPrice';
      parts.push(t(key, { price: formatPrice(sale.priceCents) }));
    }
    const date = sale.soldAt ?? sale.listedAt;
    if (date) {
      parts.push(t(sold ? 'sale.onDate' : 'sale.sinceDate', { date: formatIsoDate(date) }));
    }
    return parts.join(' ');
  };
}

/** Mise en vente, vente et annulation d'un exemplaire. */
export function SaleSection({ copy }: Readonly<{ copy: CopyItem }>) {
  const { t } = useTranslation();
  const summarize = useSummary();
  const { data: sale } = useCopySale(copy.id);
  const remove = useRemoveSale(copy.id);
  const [mode, setMode] = useState<Mode>('view');

  const backToView = () => setMode('view');
  const loaned = copy.status === 'loaned';

  let body: ReactNode;
  if (sale === undefined) {
    body = null;
  } else if (mode === 'list' || mode === 'sell' || mode === 'edit') {
    body = <SaleForm mode={mode} copyId={copy.id} sale={sale} onDone={backToView} />;
  } else if (mode === 'cancel') {
    body = (
      <div
        role="alertdialog"
        aria-label={t('sale.cancelSaleTitle')}
        className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
      >
        <p className="font-semibold text-red-900">{t('sale.cancelSaleTitle')}</p>
        <p className="text-sm text-red-800">{t('sale.cancelSaleText')}</p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => remove.mutate(undefined, { onSuccess: backToView })}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {t('sale.cancelSaleButton')}
          </button>
          <button type="button" onClick={backToView} className={BUTTON_CLASS}>
            {t('sale.keep')}
          </button>
        </div>
      </div>
    );
  } else if (sale?.soldAt) {
    body = (
      <>
        <p className="text-sm text-slate-900">{summarize(sale)}</p>
        <div>
          <button type="button" onClick={() => setMode('cancel')} className={BUTTON_CLASS}>
            {t('sale.cancelSaleButton')}
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        {sale && <p className="text-sm text-slate-900">{summarize(sale)}</p>}
        <div className="flex flex-wrap gap-3">
          {!sale && (
            <button type="button" onClick={() => setMode('list')} className={BUTTON_CLASS}>
              {t('sale.listButton')}
            </button>
          )}
          <button
            type="button"
            disabled={loaned}
            onClick={() => setMode('sell')}
            className={BUTTON_CLASS}
          >
            {t('sale.sellButton')}
          </button>
          {sale && (
            <>
              <button type="button" onClick={() => setMode('edit')} className={BUTTON_CLASS}>
                {t('sale.editButton')}
              </button>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
                className={BUTTON_CLASS}
              >
                {t('sale.withdrawButton')}
              </button>
            </>
          )}
        </div>
        {loaned && <p className="text-sm text-slate-500">{t('sale.loanedNote')}</p>}
      </>
    );
  }

  return (
    <section
      aria-label={t('sale.section')}
      className="flex flex-col gap-3 border-t border-slate-200 pt-4"
    >
      <h3 className="font-semibold">{t('sale.section')}</h3>
      {body}
      {sale !== undefined && !sale?.soldAt && mode === 'view' && (
        <ListingDraftPanel copy={copy} sale={sale} />
      )}
      {remove.error && (
        <p role="alert" className="text-sm text-red-700">
          {remove.error.message}
        </p>
      )}
    </section>
  );
}
