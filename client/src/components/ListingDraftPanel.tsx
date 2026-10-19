import type { CopyItem } from '@shelfctrl/types';
import { ExternalLink } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { buildListingDraft } from '@/lib/listing';
import { publishUrl } from '@/lib/platforms';

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

/** Lien vers la page de dépôt de la plateforme, quand on la connaît. */
function PublishLink({ platform }: Readonly<{ platform: string | null }>) {
  const { t } = useTranslation();
  const url = publishUrl(platform);
  if (url === null || platform === null) {
    return null;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 self-start text-sm font-medium text-slate-900 underline underline-offset-4"
    >
      <ExternalLink aria-hidden className="size-4" />
      {t('listingDraft.publishOn', { platform: platform.trim() })}
    </a>
  );
}

/**
 * Titre et description à copier sur la plateforme, calculés d'après la fiche de l'exemplaire :
 * le titre s'adapte à la limite de la plateforme (`null` : longueur par défaut).
 */
export function ListingFields({
  copy,
  platform,
}: Readonly<{ copy: CopyItem; platform: string | null }>) {
  const { t } = useTranslation();
  const draft = useMemo(() => buildListingDraft(copy, platform, t), [copy, platform, t]);

  return (
    <div className="flex flex-col gap-3">
      <PublishLink platform={platform} />
      <CopyField label={t('listingDraft.title')} value={draft.title} />
      <CopyField label={t('listingDraft.description')} value={draft.description} multiline />
      <p className="text-xs text-slate-500">{t('listingDraft.hint')}</p>
    </div>
  );
}

/** Annonce d'un exemplaire déjà en vente, repliée jusqu'à ce qu'on la demande. */
export function ListingDraftPanel({
  copy,
  platform,
}: Readonly<{ copy: CopyItem; platform: string | null }>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={BUTTON_CLASS}
        >
          {t(open ? 'listingDraft.hide' : 'listingDraft.show')}
        </button>
      </div>
      {open && <ListingFields copy={copy} platform={platform} />}
    </div>
  );
}
