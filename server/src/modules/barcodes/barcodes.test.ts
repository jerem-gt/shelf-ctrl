import type { BarcodeSuggestion } from '@shelfctrl/types';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.js';
import { createTestDbWithUser } from '../../tests/testDb.js';
import type { BarcodeProvider } from './providers/types.js';

const suggestion = (title: string): BarcodeSuggestion => ({
  work: { title, series: null, volumeNumber: null, creators: null, year: null },
  edition: { format: 'book', publisher: null, releaseYear: null, language: null },
});

function fakeProvider(
  source: BarcodeProvider['source'],
  kinds: BarcodeProvider['kinds'],
  lookup: BarcodeProvider['lookup'],
) {
  const spy = vi.fn(lookup);
  return { source, kinds, lookup: spy } satisfies BarcodeProvider;
}

function setup(providers: BarcodeProvider[]) {
  const { db } = createTestDbWithUser();
  return { db, app: createApp(db, { barcodeProviders: providers }) };
}

const TINTIN_ISBN = '9782203001190';
const VIDEO_EAN = '3333297329439';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/barcodes/:code', () => {
  it('renvoie la fiche de la première source qui connaît le code', async () => {
    const first = fakeProvider('openlibrary', ['isbn'], () =>
      Promise.resolve(suggestion('Tintin')),
    );
    const second = fakeProvider('googlebooks', ['isbn'], () =>
      Promise.resolve(suggestion('Autre')),
    );
    const { app } = setup([first, second]);

    const res = await request(app).get(`/api/barcodes/${TINTIN_ISBN}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      barcode: TINTIN_ISBN,
      kind: 'isbn',
      source: 'openlibrary',
      known: false,
      suggestion: { work: { title: 'Tintin' } },
    });
    expect(second.lookup).not.toHaveBeenCalled();
  });

  it('normalise un ISBN-10 avant d’interroger les sources', async () => {
    const provider = fakeProvider('openlibrary', ['isbn'], () =>
      Promise.resolve(suggestion('Tintin')),
    );
    const { app } = setup([provider]);

    const res = await request(app).get('/api/barcodes/2203001194');

    expect(res.body.barcode).toBe(TINTIN_ISBN);
    expect(provider.lookup).toHaveBeenCalledWith(TINTIN_ISBN);
  });

  it('passe à la source suivante quand une source échoue ou ne connaît pas le code', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken = fakeProvider('googlebooks', ['isbn'], () =>
      Promise.reject(new Error('HTTP 429')),
    );
    const unknown = fakeProvider('openlibrary', ['isbn'], () => Promise.resolve(null));
    const working = fakeProvider('upcitemdb', ['isbn'], () =>
      Promise.resolve(suggestion('Trouvé')),
    );
    const { app } = setup([broken, unknown, working]);

    const res = await request(app).get(`/api/barcodes/${TINTIN_ISBN}`);

    expect(res.body.source).toBe('upcitemdb');
    expect(warn).toHaveBeenCalledWith('[barcode] googlebooks : HTTP 429');
  });

  it('consigne une erreur qui n’est pas une instance d’Error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Rejet volontaire d'une valeur qui n'est pas une Error, pour couvrir le message de repli.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const broken = fakeProvider('googlebooks', ['isbn'], () => Promise.reject('boom'));
    const { app } = setup([broken]);

    const res = await request(app).get(`/api/barcodes/${TINTIN_ISBN}`);

    expect(res.status).toBe(404);
    expect(warn).toHaveBeenCalledWith('[barcode] googlebooks : erreur inconnue');
  });

  it('n’interroge que les sources adaptées au type de code', async () => {
    const book = fakeProvider('openlibrary', ['isbn'], () => Promise.resolve(suggestion('Livre')));
    const video = fakeProvider('upcitemdb', ['ean'], () => Promise.resolve(suggestion('Film')));
    const { app } = setup([book, video]);

    const res = await request(app).get(`/api/barcodes/${VIDEO_EAN}`);

    expect(res.body).toMatchObject({ kind: 'ean', source: 'upcitemdb' });
    expect(book.lookup).not.toHaveBeenCalled();
  });

  it('répond 404 quand aucune source ne connaît le code', async () => {
    const { app } = setup([fakeProvider('openlibrary', ['isbn'], () => Promise.resolve(null))]);

    const res = await request(app).get(`/api/barcodes/${TINTIN_ISBN}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('barcode.not_found');
  });

  it('répond 400 pour un code invalide sans interroger les sources', async () => {
    const provider = fakeProvider('openlibrary', ['isbn'], () => Promise.resolve(null));
    const { app } = setup([provider]);

    const res = await request(app).get('/api/barcodes/1234');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('barcode.invalid');
    expect(provider.lookup).not.toHaveBeenCalled();
  });

  it('renvoie l’édition déjà connue sans interroger les sources', async () => {
    const provider = fakeProvider('openlibrary', ['isbn'], () =>
      Promise.resolve(suggestion('Distant')),
    );
    const { app } = setup([provider]);
    await request(app)
      .post('/api/copies')
      .send({
        work: { title: 'Tintin au Tibet', series: 'Tintin', volumeNumber: 20, creators: 'Hergé' },
        edition: { format: 'book', barcode: '2203001194', publisher: 'Casterman' },
      });

    const res = await request(app).get(`/api/barcodes/${TINTIN_ISBN}`);

    expect(res.body).toMatchObject({
      source: 'local',
      known: true,
      suggestion: {
        work: { title: 'Tintin au Tibet', series: 'Tintin', volumeNumber: 20 },
        edition: { format: 'book', publisher: 'Casterman' },
      },
    });
    expect(provider.lookup).not.toHaveBeenCalled();
  });
});
