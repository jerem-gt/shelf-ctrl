export type FetchFn = typeof fetch;

const REQUEST_TIMEOUT_MS = 5000;
/** Une image est plus lourde qu'une réponse d'API : elle a droit à plus de temps. */
const IMAGE_TIMEOUT_MS = 8000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Requête abandonnée au bout du délai (5 s par défaut) ; le statut HTTP n'est pas contrôlé. */
export function fetchWithTimeout(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  return fetchFn(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/** Lève `<label> <statut>` (« HTTP 429 ») si la réponse n'est pas un succès. */
export function ensureOk(res: Response, label = 'HTTP'): Response {
  if (!res.ok) {
    throw new Error(`${label} ${res.status}`);
  }
  return res;
}

async function fetchOk(fetchFn: FetchFn, url: string, accept: string): Promise<Response> {
  return ensureOk(await fetchWithTimeout(fetchFn, url, { headers: { Accept: accept } }));
}

export async function fetchJson(fetchFn: FetchFn, url: string): Promise<unknown> {
  return (await fetchOk(fetchFn, url, 'application/json')).json();
}

export async function fetchText(fetchFn: FetchFn, url: string): Promise<string> {
  return (await fetchOk(fetchFn, url, 'application/xml')).text();
}

/** Télécharge une image ; `null` si l'URL n'en renvoie pas (404, autre type de contenu, trop lourde). */
export async function fetchImage(fetchFn: FetchFn, url: string): Promise<Buffer | null> {
  const res = await fetchWithTimeout(fetchFn, url, {}, IMAGE_TIMEOUT_MS);
  if (res.status === 404) {
    return null;
  }
  ensureOk(res);
  if (!res.headers.get('content-type')?.startsWith('image/')) {
    return null;
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  return bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES ? bytes : null;
}
