import { matchPath } from 'react-router';

/** Pages rattachées à la collection, hors la liste elle-même : ajout, import, fiche d'un exemplaire. */
export const COLLECTION_ROUTES = ['/add', '/import', '/copies/:id'] as const;

/** Pages du compte, à l'écart de la gestion de la collection. */
export const ACCOUNT_ROUTES = ['/settings', '/admin'] as const;

/** L'adresse correspond-elle exactement à l'une de ces routes (motifs de react-router) ? */
export function matchesAnyRoute(pathname: string, routes: readonly string[]): boolean {
  return routes.some((route) => matchPath(route, pathname) !== null);
}
