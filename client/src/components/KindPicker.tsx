import { MEDIA_KINDS, type MediaKind } from '@shelfctrl/types';
import { BookOpen, Clapperboard, Gamepad2, type LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

const ICONS: Record<MediaKind, ComponentType<LucideProps>> = {
  book: BookOpen,
  movie: Clapperboard,
  game: Gamepad2,
};

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
        {MEDIA_KINDS.map((kind) => {
          const Icon = ICONS[kind];
          return (
            <label
              key={kind}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-3 text-center text-sm font-medium text-slate-700 has-checked:border-slate-900 has-checked:bg-slate-900 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-slate-500"
            >
              <input
                type="radio"
                name="media-kind"
                value={kind}
                checked={value === kind}
                onChange={() => onChange(kind)}
                className="sr-only"
              />
              <Icon aria-hidden className="size-5" />
              {t(`kinds.${kind}`)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
