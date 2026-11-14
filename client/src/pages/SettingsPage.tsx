import { ChevronLeft } from 'lucide-react';
import { type ComponentType, type RefObject, useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';

import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PlatformsSettings } from '@/components/PlatformsSettings';
import { ProfileCard } from '@/components/ProfileCard';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { TwoFactorCard } from '@/components/TwoFactorCard';
import { MD_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import {
  isSettingsSection,
  SETTINGS_SECTIONS,
  settingsPath,
  type SettingsSection,
} from '@/lib/navigation';

/** Groupes du menu, dans leur ordre d'affichage ; titre traduit sous `settings.menu.<groupe>`. */
const MENU_GROUPS = ['account', 'sales'] as const;

/** Groupe et contenu de chaque rubrique (le menu se construit de là) ; libellé `settings.menu.<rubrique>`. */
const SECTIONS: Record<
  SettingsSection,
  { group: (typeof MENU_GROUPS)[number]; Content: ComponentType }
> = {
  profile: { group: 'account', Content: ProfileCard },
  twoFactor: { group: 'account', Content: TwoFactorCard },
  platforms: { group: 'sales', Content: PlatformsSettings },
};

/** Rubrique affichée sur grand écran quand l'adresse n'en désigne aucune. */
const DEFAULT_SECTION: SettingsSection = 'profile';

const menuKey = (key: string) => `settings.menu.${key}`;

const ITEM_CLASS = 'block rounded-md px-3 py-2 text-sm font-medium';
const ITEM_ACTIVE = `${ITEM_CLASS} bg-primary text-primary-fg`;
const ITEM_IDLE = `${ITEM_CLASS} text-content-secondary hover:bg-surface-emphasis hover:text-content`;

/**
 * Marque d'une entrée d'historique ouverte depuis le menu seul (mobile) : le retour au menu y revient
 * en arrière plutôt que d'empiler une page (sinon le retour d'Android rouvrirait la rubrique).
 */
type SettingsLocationState = { fromMenu?: boolean } | null;

/** Comment les liens du menu naviguent : remplacer l'entrée courante ou non, et ce qu'ils marquent. */
type MenuNavigation = { replace: boolean; state: { fromMenu: boolean } };

function SettingsMenu({
  shown,
  navigation,
}: Readonly<{ shown: SettingsSection | null; navigation: MenuNavigation }>) {
  const { t } = useTranslation();
  const languageId = useId();
  const themeId = useId();

  return (
    <div className="flex w-full flex-col gap-5 md:w-60 md:shrink-0 md:border-r md:border-line-subtle md:pr-6">
      <nav aria-label={t('settings.menuLabel')} className="flex flex-col gap-4">
        {MENU_GROUPS.map((group) => (
          <div key={group} className="flex flex-col gap-1">
            <h3 className="px-3 text-xs font-semibold tracking-wider text-content-subtle uppercase">
              {t(menuKey(group))}
            </h3>
            <ul className="flex flex-col gap-0.5">
              {SETTINGS_SECTIONS.filter((section) => SECTIONS[section].group === group).map(
                (section) => (
                  <li key={section}>
                    <Link
                      to={settingsPath(section)}
                      replace={navigation.replace}
                      state={navigation.state}
                      data-section={section}
                      aria-current={section === shown ? 'page' : undefined}
                      className={section === shown ? ITEM_ACTIVE : ITEM_IDLE}
                    >
                      {t(menuKey(section))}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </nav>
      <div className="flex flex-col gap-4 border-t border-line-subtle pt-4">
        <section aria-labelledby={languageId} className="flex flex-col gap-2">
          <h3 id={languageId} className="text-sm font-medium text-content-secondary">
            {t('language.title')}
          </h3>
          <LanguageSwitcher />
        </section>
        <section aria-labelledby={themeId} className="flex flex-col gap-2">
          <h3 id={themeId} className="text-sm font-medium text-content-secondary">
            {t('theme.title')}
          </h3>
          <ThemeSwitcher />
        </section>
      </div>
    </div>
  );
}

/** Retour au menu (mobile) : en arrière si l'on vient du menu, sinon vers le menu sans empiler. */
function BackToMenu({ fromMenu }: Readonly<BackToMenuProps>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const className =
    'flex items-center gap-1 self-start text-sm text-content-muted hover:text-content';
  const content = (
    <>
      <ChevronLeft aria-hidden className="size-4" />
      {t('settings.back')}
    </>
  );

  if (fromMenu) {
    return (
      <button type="button" onClick={() => void navigate(-1)} className={className}>
        {content}
      </button>
    );
  }
  return (
    <Link to="/settings" replace className={className}>
      {content}
    </Link>
  );
}

/** Retour au menu à afficher (mobile seulement), et si l'on vient du menu. */
type BackToMenuProps = { fromMenu: boolean };

function SettingsContent({
  section,
  titleRef,
  back,
}: Readonly<{
  section: SettingsSection;
  titleRef: RefObject<HTMLHeadingElement | null>;
  back: BackToMenuProps | null;
}>) {
  const { t } = useTranslation();
  const titleId = useId();
  const { Content } = SECTIONS[section];
  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-1 flex-col gap-4">
      {back && <BackToMenu fromMenu={back.fromMenu} />}
      <h3 id={titleId} ref={titleRef} tabIndex={-1} className="rounded-sm text-lg font-semibold">
        {t(menuKey(section))}
      </h3>
      <Content />
    </section>
  );
}

/**
 * Réglages du compte, sur le modèle de cash-ctrl : menu des rubriques à gauche, rubrique ouverte à
 * droite (le profil par défaut) ; sur mobile, le menu seul, puis la rubrique avec un retour. En plus
 * de cash-ctrl : la rubrique est dans l'adresse (le retour d'Android ramène au menu) et seul ce qui
 * est affiché est monté.
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const location = useLocation();
  const isDesktop = useMediaQuery(MD_QUERY);
  const layoutRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousRef = useRef<SettingsSection | null>(null);

  const requested = params.get('section');
  // Rubrique désignée par l'adresse, si elle existe.
  const selected = isSettingsSection(requested) ? requested : null;
  // Rubrique affichée : la désignée, ou celle par défaut sur grand écran ; aucune sur le menu mobile.
  const shown = selected ?? (isDesktop ? DEFAULT_SECTION : null);
  const fromMenu = (location.state as SettingsLocationState)?.fromMenu === true;
  // Une rubrique déjà affichée est remplacée par la suivante ; depuis le menu seul, on empile.
  const navigation: MenuNavigation = {
    replace: shown !== null,
    state: { fromMenu: shown === null || fromMenu },
  };

  // Sur mobile, le menu et le contenu s'échangent : le focus suit, vers le titre de la rubrique
  // ouverte, ou au retour vers le lien de celle qu'on quitte. Seul un changement de rubrique le
  // déplace, pas un changement de largeur ; sur grand écran, il reste sur le lien cliqué.
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = selected;
    if (isDesktop || previous === selected) {
      return;
    }
    if (selected === null) {
      layoutRef.current?.querySelector<HTMLAnchorElement>(`[data-section="${previous}"]`)?.focus();
    } else {
      titleRef.current?.focus();
    }
  }, [selected, isDesktop]);

  // Rubrique inconnue : l'adresse est corrigée, sans entrée d'historique.
  if (requested !== null && selected === null) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold">{t('settings.title')}</h2>
      <div ref={layoutRef} className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        {(isDesktop || selected === null) && <SettingsMenu shown={shown} navigation={navigation} />}
        {shown !== null && (
          <SettingsContent
            section={shown}
            titleRef={titleRef}
            back={isDesktop ? null : { fromMenu }}
          />
        )}
      </div>
    </div>
  );
}
