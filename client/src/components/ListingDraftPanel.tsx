import type { SaleItem } from '@shelfctrl/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useListingDraft } from '@/hooks/useListingDraft';
import { useUpdateSale } from '@/hooks/useSales';
import { formatPrice } from '@/lib/money';

const BUTTON_CLASS =
  'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-60';
const FIELD_CLASS =
  'w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900';

function CopyField({
  label,
  value,
  multiline,
}: Readonly<{ label: string; value: string; multiline?: boolean }>) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé) : le texte reste sélectionnable.
    }
  };

  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {multiline ? (
        <textarea readOnly rows={8} value={value} className={FIELD_CLASS} />
      ) : (
        <input readOnly value={value} className={FIELD_CLASS} />
      )}
      <button type="button" onClick={() => void copy()} className={`${BUTTON_CLASS} self-start`}>
        {t(copied ? 'listingDraft.copied' : 'listingDraft.copy')}
      </button>
    </label>
  );
}

/** Brouillon d'annonce rédigé par le LLM, à copier sur la plateforme (rien n'est enregistré). */
export function ListingDraftPanel({
  copyId,
  sale,
}: Readonly<{ copyId: number; sale: SaleItem | null }>) {
  const { t } = useTranslation();
  const draft = useListingDraft(copyId);
  const updateSale = useUpdateSale(copyId);
  const platform = sale?.platform ?? undefined;
  const suggested = draft.data?.suggestedPriceCents ?? null;

  let generateLabel = 'listingDraft.generate';
  if (draft.isPending) {
    generateLabel = 'listingDraft.generating';
  } else if (draft.data) {
    generateLabel = 'listingDraft.regenerate';
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          disabled={draft.isPending}
          onClick={() => draft.mutate(platform)}
          className={BUTTON_CLASS}
        >
          {t(generateLabel)}
        </button>
      </div>
      {draft.error && (
        <p role="alert" className="text-sm text-red-700">
          {draft.error.message}
        </p>
      )}
      {draft.data && (
        <div className="flex flex-col gap-3">
          <CopyField label={t('listingDraft.title')} value={draft.data.title} />
          <CopyField
            label={t('listingDraft.description')}
            value={draft.data.description}
            multiline
          />
          {suggested !== null && (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-slate-700">
                {t('listingDraft.suggestedPrice', { price: formatPrice(suggested) })}
              </p>
              {sale && (
                <button
                  type="button"
                  disabled={updateSale.isPending}
                  onClick={() => updateSale.mutate({ priceCents: suggested })}
                  className={BUTTON_CLASS}
                >
                  {t('listingDraft.useSuggestedPrice')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
