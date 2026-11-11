import { MEDIA_KINDS, type MediaKind } from '@shelfctrl/types';
import { useTranslation } from 'react-i18next';

import { KindIcon } from './KindIcon';

interface KindPickerProps {
  value: MediaKind;
  onChange: (kind: MediaKind) => void;
}

/** Choix du type de média, en tête du formulaire d'ajout : livre, film ou jeu vidéo. */
export function KindPicker({ value, onChange }: Readonly<KindPickerProps>) {
  const { t } = useTranslation();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold">{t('add.kind')}</legend>
      <div className="grid grid-cols-3 gap-2">
        {MEDIA_KINDS.map((kind) => (
          <label
            key={kind}
            className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-line bg-surface px-2 py-3 text-center text-sm font-medium text-content-secondary has-checked:border-primary has-checked:bg-primary has-checked:text-primary-fg has-focus-visible:ring-2 has-focus-visible:ring-line-strong"
          >
            <input
              type="radio"
              name="media-kind"
              value={kind}
              checked={value === kind}
              onChange={() => onChange(kind)}
              className="sr-only"
            />
            <KindIcon kind={kind} className="size-5" />
            {t(`kinds.${kind}`)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
