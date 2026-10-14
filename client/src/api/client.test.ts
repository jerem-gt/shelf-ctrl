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

describe('api.copies.get / update / remove', () => {
  it('lit un exemplaire par son identifiant', async () => {
    const copy = await api.copies.get(2);
    expect(copy.work.title).toBe('Alien');
  });

  it('envoie les modifications en PATCH, y compris les effacements', async () => {
    let received: unknown;
    server.use(
      http.patch('/api/copies/:id', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ id: 1 });
      }),
    );

    await api.copies.update(1, { condition: 'poor', location: null });

    expect(received).toEqual({ condition: 'poor', location: null });
  });

  it('supprime un exemplaire sans corps de réponse', async () => {
    let method = '';
    server.use(
      http.delete('/api/copies/:id', ({ request }) => {
        method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(api.copies.remove(1)).resolves.toBeUndefined();
    expect(method).toBe('DELETE');
  });

  it('signale un exemplaire inconnu par une ApiError 404', async () => {
    const error = await api.copies.get(99).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404 });
  });
});

describe('api.loans / api.borrowers', () => {
  it('lit les emprunteurs, les prêts en cours et l’historique d’un exemplaire', async () => {
    expect(await api.borrowers.list()).toHaveLength(2);
    expect(await api.loans.open()).toEqual([]);
    expect(await api.loans.forCopy(1)).toEqual([]);
  });

  it('enregistre un prêt puis son retour avec leurs dates', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/copies/:id/loans', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ id: 5 }, { status: 201 });
      }),
      http.post('/api/loans/:id/return', async ({ request, params }) => {
        bodies.push({ id: params.id, ...((await request.json()) as object) });
        return HttpResponse.json({ id: 5 });
      }),
    );

    await api.loans.lend(1, { borrowerName: 'Alice', loanedAt: '2026-10-01' });
    await api.loans.giveBack(5, '2026-10-10');

    expect(bodies).toEqual([
      { borrowerName: 'Alice', loanedAt: '2026-10-01' },
      { id: '5', returnedAt: '2026-10-10' },
    ]);
  });

  it('traduit un conflit (409) en message', async () => {
    server.use(http.post('/api/copies/:id/loans', () => HttpResponse.json({}, { status: 409 })));

    const error = await api.loans.lend(1, { borrowerName: 'Alice' }).catch((e: unknown) => e);
    expect(error).toMatchObject({
      status: 409,
      message: "Cette action n'est plus possible : l'état de l'exemplaire a changé.",
    });
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
