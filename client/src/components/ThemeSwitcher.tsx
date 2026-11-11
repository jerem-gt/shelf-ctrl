import type { LucideIcon } from 'lucide-react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { setTheme, type ThemeMode, useTheme } from '@/hooks/useTheme';
import { CHOICE_ACTIVE_CLASS, CHOICE_INACTIVE_CLASS } from '@/lib/formClasses';

const OPTIONS: ReadonlyArray<{ mode: ThemeMode; icon: LucideIcon }> = [
  { mode: 'light', icon: Sun },
  { mode: 'dark', icon: Moon },
  { mode: 'system', icon: Monitor },
];

/** Thème clair, sombre ou celui de l'appareil, mémorisé dans le navigateur. */
export function ThemeSwitcher() {
  const { t } = useTranslation();
  const current = useTheme();

  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map(({ mode, icon: Icon }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={current === mode}
          onClick={() => setTheme(mode)}
          className={`flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium ${current === mode ? CHOICE_ACTIVE_CLASS : CHOICE_INACTIVE_CLASS}`}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {t(`theme.${mode}`)}
        </button>
      ))}
    </div>
  );
}
