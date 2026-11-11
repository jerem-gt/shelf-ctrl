export type FetchFn = typeof fetch;

const REQUEST_TIMEOUT_MS = 5000;

/** Requête abandonnée au bout de 5 s ; le statut HTTP n'est pas contrôlé. */
export function fetchWithTimeout(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetchFn(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
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
