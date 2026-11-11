export type FetchFn = typeof fetch;

const REQUEST_TIMEOUT_MS = 5000;

async function fetchOk(fetchFn: FetchFn, url: string, accept: string): Promise<Response> {
  const res = await fetchFn(url, {
    headers: { Accept: accept },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res;
}

export async function fetchJson(fetchFn: FetchFn, url: string): Promise<unknown> {
  return (await fetchOk(fetchFn, url, 'application/json')).json();
}

export async function fetchText(fetchFn: FetchFn, url: string): Promise<string> {
  return (await fetchOk(fetchFn, url, 'application/xml')).text();
}
