import type { CopyItem, SaleItem } from '@shelfctrl/types';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { buildListingDraft } from '@/lib/listing';
import { DEFAULT_PLATFORMS } from '@/lib/platforms';

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
  const fieldId = useId();
  // On retient le texte copié : dès que le texte affiché change (autre plateforme), « Copié »
  // ne vaut plus, et on ne laisse pas croire que le nouveau texte est dans le presse-papiers.
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé) : le texte reste sélectionnable.
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea id={fieldId} readOnly rows={10} value={value} className={FIELD_CLASS} />
      ) : (
        <input id={fieldId} readOnly value={value} className={FIELD_CLASS} />
      )}
      <button type="button" onClick={() => void copy()} className={`${BUTTON_CLASS} self-start`}>
        {t(copiedValue === value ? 'listingDraft.copied' : 'listingDraft.copy')}
      </button>
    </div>
  );
}

/** Brouillon d'annonce (gabarit) à copier sur la plateforme ; rien n'est enregistré. */
export function ListingDraftPanel({
  copy,
  sale,
}: Readonly<{ copy: CopyItem; sale: SaleItem | null }>) {
  const { t } = useTranslation();
  const platformId = useId();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState(sale?.platform ?? DEFAULT_PLATFORMS[0]);

  // La plateforme de l'annonce en cours reste proposée même si elle n'est pas dans la liste.
  const platforms = [
    ...new Set([...(sale?.platform ? [sale.platform] : []), ...DEFAULT_PLATFORMS]),
  ];
  const draft = useMemo(() => buildListingDraft(copy, platform, t), [copy, platform, t]);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={BUTTON_CLASS}
        >
          {t(open ? 'listingDraft.hide' : 'listingDraft.generate')}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-3">
          <label htmlFor={platformId} className="flex flex-col gap-1 text-sm font-medium">
            {t('listingDraft.platform')}
            <select
              id={platformId}
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm sm:w-64"
            >
              {platforms.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <CopyField label={t('listingDraft.title')} value={draft.title} />
          <CopyField label={t('listingDraft.description')} value={draft.description} multiline />
          <p className="text-xs text-slate-500">{t('listingDraft.hint')}</p>
        </div>
      )}
    </div>
  );
}
