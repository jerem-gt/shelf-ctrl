import type { TitleSearchResult } from '@shelfctrl/types';

export interface TitleSearchProvider {
  source: TitleSearchResult['source'];
  /** Une erreur (réseau, quota…) est levée ; une recherche sans résultat renvoie `[]`. */
  search(query: string): Promise<TitleSearchResult[]>;
}
