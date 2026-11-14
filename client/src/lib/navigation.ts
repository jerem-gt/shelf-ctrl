import { matchPath } from 'react-router';

/** Pages rattachées à la collection, hors la liste elle-même : ajout, import, fiche d'un exemplaire. */
export const COLLECTION_ROUTES = ['/add', '/import', '/copies/:id'] as const;

/** Pages du compte, à l'écart de la gestion de la collection. */
export const ACCOUNT_ROUTES = ['/settings', '/admin'] as const;

/** Rubriques de la page Réglages, désignées dans l'adresse (`/settings?section=…`). */
export const SETTINGS_SECTIONS = ['profile', 'twoFactor', 'platforms'] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(value: string | null): value is SettingsSection {
  return SETTINGS_SECTIONS.some((section) => section === value);
}

/** Adresse d'une rubrique des réglages, pour y mener depuis ailleurs (ex. plateformes depuis la vente). */
export function settingsPath(section: SettingsSection): string {
  return `/settings?section=${section}`;
}

/** L'adresse correspond-elle exactement à l'une de ces routes (motifs de react-router) ? */
export function matchesAnyRoute(pathname: string, routes: readonly string[]): boolean {
  return routes.some((route) => matchPath(route, pathname) !== null);
}
