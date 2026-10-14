import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { BARCODE_TINTIN } from '@/tests/fixtures';
import { server } from '@/tests/msw/server';

import { api, ApiError } from './client';

describe('api.copies.list', () => {
  it('envoie uniquement les filtres renseignés', async () => {
    const urls: string[] = [];
    server.use(
      http.get('/api/copies', ({ request }) => {
        urls.push(new URL(request.url).search);
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );

    await api.copies.list();
    await api.copies.list({ q: 'tintin', format: 'book', status: 'owned' });
    await api.copies.list({ q: '', format: 'dvd' });

    expect(urls).toEqual(['', '?q=tintin&format=book&status=owned', '?format=dvd']);
  });

  it.each([
    [400, 'Certains champs sont invalides.'],
    [500, 'Une erreur est survenue.'],
  ])('traduit un statut %i en message', async (status, message) => {
    server.use(http.get('/api/copies', () => HttpResponse.json({}, { status })));

    const error = await api.copies.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, message });
  });

  it('signale une erreur réseau avec le statut 0', async () => {
    server.use(http.get('/api/copies', () => HttpResponse.error()));

    const error = await api.copies.list().catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, message: 'Impossible de joindre le serveur.' });
  });
});

describe('api.barcodes.lookup', () => {
  it('interroge la route du code-barres et renvoie la fiche', async () => {
    let path = '';
    server.use(
      http.get('/api/barcodes/:code', ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json(BARCODE_TINTIN);
      }),
    );

    const result = await api.barcodes.lookup('978 2203001190');

    expect(path).toBe('/api/barcodes/978%202203001190');
    expect(result.suggestion.work.title).toBe('Tintin au Tibet');
  });

  it('signale un code inconnu par une ApiError 404', async () => {
    server.use(
      http.get('/api/barcodes/:code', () =>
        HttpResponse.json({ error: 'not_found' }, { status: 404 }),
      ),
    );

    const error = await api.barcodes.lookup('9782203001190').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404 });
  });
});

describe('api.copies.create', () => {
  it('envoie le corps en JSON et renvoie l’exemplaire créé', async () => {
    let received: unknown;
    server.use(
      http.post('/api/copies', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ id: 9 }, { status: 201 });
      }),
    );
    const payload = {
      work: { title: 'Dune' },
      edition: { format: 'dvd' as const },
      condition: 'good' as const,
    };

    const created = await api.copies.create(payload);

    expect(received).toEqual(payload);
    expect(created).toEqual({ id: 9 });
  });
});
