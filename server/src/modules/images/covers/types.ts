import type { MediaFormat } from '@shelfctrl/types';

export type FetchFn = typeof fetch;

/** Ce que l'on sait d'une édition pour lui trouver une pochette. */
export interface CoverQuery {
  format: MediaFormat;
  barcode: string | null;
  title: string;
  year: number | null;
}

export interface CoverProvider {
  source: string;
  /** Faux quand la source ne peut rien pour cette édition (pas d'ISBN, pas de clé…). */
  supports(query: CoverQuery): boolean;
  /** `null` : pas de pochette. Une erreur (réseau, quota…) est levée. */
  find(query: CoverQuery): Promise<Buffer | null>;
}

const REQUEST_TIMEOUT_MS = 8000;
const MAX_BYTES = 10 * 1024 * 1024;

/** Télécharge une image ; `null` si l'URL n'en renvoie pas (404, autre type de contenu, trop lourde). */
export async function fetchImage(fetchFn: FetchFn, url: string): Promise<Buffer | null> {
  const res = await fetchFn(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  if (!res.headers.get('content-type')?.startsWith('image/')) {
    return null;
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  return bytes.length > 0 && bytes.length <= MAX_BYTES ? bytes : null;
}
