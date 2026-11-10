import type { MediaKind, TitleSearchResult } from '@shelfctrl/types';

export interface TitleSearchProvider {
  source: TitleSearchResult['source'];
  /** Type de média que la source connaît : seule une recherche de ce type l'interroge. */
  kind: MediaKind;
  /** Une erreur (réseau, quota…) est levée ; une recherche sans résultat renvoie `[]`. */
  search(query: string): Promise<TitleSearchResult[]>;
}
