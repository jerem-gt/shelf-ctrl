import type { MediaKind, TitleSearchResponse, TitleSearchResult } from '@shelfctrl/types';

import type { TitleSearchProvider } from './providers/types.js';

const MAX_RESULTS = 20;

/** Un résultat de chaque source à tour de rôle : aucune ne monopolise la liste tronquée. */
function interleave(lists: TitleSearchResult[][]): TitleSearchResult[] {
  const merged: TitleSearchResult[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index++) {
    for (const list of lists) {
      if (index < list.length) {
        merged.push(list[index]);
      }
    }
  }
  return merged;
}

/** Même édition : même code-barres. Sans code, même titre et même année (casse ignorée). */
function identityOf({ barcode, suggestion }: TitleSearchResult): string {
  if (barcode !== null) {
    return `code:${barcode}`;
  }
  const { title, year } = suggestion.work;
  return `titre:${title.trim().toLowerCase()}|${year ?? ''}`;
}

/** Garde la première occurrence de chaque édition. */
function dedupe(results: TitleSearchResult[]): TitleSearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const identity = identityOf(result);
    if (seen.has(identity)) {
      return false;
    }
    seen.add(identity);
    return true;
  });
}

export function createTitlesService(providers: readonly TitleSearchProvider[]) {
  return {
    /**
     * Interroge en parallèle les sources du type demandé (livres, films ou jeux vidéo), toutes
     * sans type. Une source en erreur est ignorée ; sans résultat, la liste est vide.
     * `configured` est faux quand aucune source ne connaît ce type.
     */
    async search(query: string, kind?: MediaKind): Promise<TitleSearchResponse> {
      const selected = providers.filter((provider) => kind === undefined || provider.kind === kind);
      const settled = await Promise.allSettled(selected.map((provider) => provider.search(query)));

      const lists: TitleSearchResult[][] = [];
      settled.forEach((outcome, index) => {
        if (outcome.status === 'fulfilled') {
          lists.push(outcome.value);
        } else {
          const reason =
            outcome.reason instanceof Error ? outcome.reason.message : 'erreur inconnue';
          console.warn(`[titles] ${selected[index].source} : ${reason}`);
        }
      });

      return {
        results: dedupe(interleave(lists)).slice(0, MAX_RESULTS),
        configured: selected.length > 0,
      };
    },
  };
}
