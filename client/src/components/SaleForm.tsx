import type { SaleItem } from '@shelfctrl/types';
import { type SyntheticEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAllSales, useListForSale, useSellCopy, useUpdateSale } from '@/hooks/useSales';
import { localToday } from '@/lib/format';
import { parsePrice, PRICE_PATTERN, priceToInput } from '@/lib/money';
import { DEFAULT_PLATFORMS } from '@/lib/platforms';

const FIELD_CLASS =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none';

export type SaleFormMode = 'list' | 'sell' | 'edit';

const MODE_TEXTS: Record<SaleFormMode, { date: string | null; submit: string }> = {
  list: { date: 'sale.listDate', submit: 'sale.listSubmit' },
  sell: { date: 'sale.soldDate', submit: 'sale.sellSubmit' },
  edit: { date: null, submit: 'sale.editSubmit' },
};

interface SaleFormProps {
  mode: SaleFormMode;
  copyId: number;
  /** Annonce existante : préremplit plateforme et prix pour vendre ou modifier. */
  sale: SaleItem | null;
  onDone: () => void;
}

export function SaleForm({ mode, copyId, sale, onDone }: Readonly<SaleFormProps>) {
  const { t } = useTranslation();
  const listId = useId();
  const listForSale = useListForSale(copyId);
  const sellCopy = useSellCopy(copyId);
  const updateSale = useUpdateSale(copyId);
  const { data: sales } = useAllSales();
  const [platform, setPlatform] = useState(sale?.platform ?? '');
  const [price, setPrice] = useState(() => priceToInput(sale?.priceCents ?? null));
  const [date, setDate] = useState(localToday);

  const mutations = { list: listForSale, sell: sellCopy, edit: updateSale };
  const mutation = mutations[mode];
  const texts = MODE_TEXTS[mode];

  const knownPlatforms = [
    ...new Set([...DEFAULT_PLATFORMS, ...(sales?.flatMap((item) => item.platform ?? []) ?? [])]),
  ];

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = platform.trim();
    const priceCents = parsePrice(price);
    const options = { onSuccess: onDone };

    if (mode === 'edit') {
      // Un champ vidé efface la valeur de l'annonce.
      updateSale.mutate({ platform: trimmed || null, priceCents }, options);
    } else if (mode === 'sell') {
      sellCopy.mutate(
        { platform: trimmed || undefined, priceCents: priceCents ?? undefined, soldAt: date },
        options,
      );
    } else {
      listForSale.mutate(
        { platform: trimmed || undefined, priceCents: priceCents ?? undefined, listedAt: date },
        options,
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        {t('sale.platform')}
        <input
          maxLength={100}
          list={listId}
          value={platform}
          onChange={(event) => setPlatform(event.target.value)}
          className={FIELD_CLASS}
        />
        <datalist id={listId}>
          {knownPlatforms.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        {t('sale.price')}
        <input
          inputMode="decimal"
          pattern={PRICE_PATTERN}
          placeholder="12,50"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          className={FIELD_CLASS}
        />
      </label>
      {texts.date && (
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          {t(texts.date)}
          <input
            required
            type="date"
            max={localToday()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>
      )}

      {mutation.error && (
        <p role="alert" className="text-sm text-red-700">
          {mutation.error.message}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {mutation.isPending ? t('sale.saving') : t(texts.submit)}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm"
        >
          {t('sale.cancel')}
        </button>
      </div>
    </form>
  );
}
