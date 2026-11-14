import { ChevronDown, LogOut, Settings, UserRound, Users } from 'lucide-react';
import { type FocusEvent, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';

import { useLogout, useMe } from '@/hooks/useAuth';
import { ACCOUNT_ROUTES, matchesAnyRoute } from '@/lib/navigation';

const ITEM_CLASS =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-emphasis disabled:opacity-60';

function itemClass({ isActive }: { isActive: boolean }) {
  return isActive ? `${ITEM_CLASS} font-medium text-content` : `${ITEM_CLASS} text-content-muted`;
}

/**
 * Menu du compte connecté : réglages, administration (admin seulement) et déconnexion, séparés de la
 * navigation de la collection. Le focus entre dans le menu à l'ouverture ; il se ferme au choix d'une
 * entrée, au clic extérieur, quand le focus le quitte, à Échap (focus rendu au bouton) et au
 * changement de page (retour arrière du navigateur, par exemple).
 */
export function AccountMenu() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const logout = useLogout();
  const { pathname } = useLocation();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);
  const [openedOnPath, setOpenedOnPath] = useState(pathname);

  // Changer de page referme le menu (état ajusté au rendu, sans effet).
  if (open && openedOnPath !== pathname) {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    firstItemRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    setOpenedOnPath(pathname);
    setOpen((value) => !value);
  };
  const close = () => setOpen(false);
  // Tab hors du menu (vers un autre élément de la page) le referme.
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next !== null && !event.currentTarget.contains(next)) {
      close();
    }
  };
  const highlighted = open || matchesAnyRoute(pathname, ACCOUNT_ROUTES);

  return (
    <div ref={rootRef} onBlur={onBlur} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-surface-emphasis hover:text-content ${
          highlighted ? 'bg-surface-emphasis text-content' : 'text-content-subtle'
        }`}
      >
        <UserRound aria-hidden className="size-5 shrink-0" />
        <span className="max-w-28 truncate sm:max-w-40">{me?.username}</span>
        {/* L'espace sépare le nom du compte du libellé dans le nom accessible (« jerem Menu du compte »). */}{' '}
        <span className="sr-only">{t('nav.accountMenu')}</span>
        <ChevronDown
          aria-hidden
          className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <nav
          id={panelId}
          aria-label={t('nav.account')}
          className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-lg"
        >
          <ul>
            <li>
              <NavLink ref={firstItemRef} to="/settings" onClick={close} className={itemClass}>
                <Settings aria-hidden className="size-4" />
                {t('nav.settings')}
              </NavLink>
            </li>
            {me?.isAdmin === true && (
              <li>
                <NavLink to="/admin" onClick={close} className={itemClass}>
                  <Users aria-hidden className="size-4" />
                  {t('nav.users')}
                </NavLink>
              </li>
            )}
            <li className="mt-1 border-t border-line-subtle pt-1">
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className={`${ITEM_CLASS} text-content-muted hover:text-danger`}
              >
                <LogOut aria-hidden className="size-4" />
                {t('nav.logout')}
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
