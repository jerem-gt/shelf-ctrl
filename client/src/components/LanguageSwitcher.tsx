import { useTranslation } from 'react-i18next';

import type { Lang } from '@/api/client';
import { currentLang } from '@/lib/format';
import { CHOICE_ACTIVE_CLASS, CHOICE_INACTIVE_CLASS } from '@/lib/formClasses';

const LANGS: readonly Lang[] = ['fr', 'en'];

/** Langue de l'interface, mémorisée dans le navigateur (localStorage) par le détecteur d'i18next. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = currentLang();

  return (
    <div className="flex gap-2">
      {LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          aria-pressed={current === lang}
          onClick={() => void i18n.changeLanguage(lang)}
          className={`rounded-md border px-4 py-2 text-sm font-medium ${current === lang ? CHOICE_ACTIVE_CLASS : CHOICE_INACTIVE_CLASS}`}
        >
          {t(`language.${lang}`)}
        </button>
      ))}
    </div>
  );
}
