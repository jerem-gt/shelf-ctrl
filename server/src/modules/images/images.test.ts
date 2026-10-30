import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.js';
import { createTestDbWithUser } from '../../tests/testDb.js';
import { createOpenLibraryCoverProvider } from './covers/openLibrary.js';
import { createTmdbCoverProvider } from './covers/tmdb.js';
import type { CoverProvider } from './covers/types.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

function setup(coverProviders: CoverProvider[] = []) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfctrl-images-'));
  tempDirs.push(dataDir);
  const { db } = createTestDbWithUser();
  const app = createApp(db, {
    barcodeProviders: [],
    titleSearchProviders: [],
    images: { dataDir, coverProviders },
  });
  const files = (kind: 'covers' | 'photos') => fs.readdirSync(path.join(dataDir, 'images', kind));
  return { app, db, dataDir, files };
}

type TestApp = ReturnType<typeof setup>['app'];

const png = (color: string, width = 40, height = 60) =>
  sharp({ create: { width, height, channels: 3, background: color } })
    .png()
    .toBuffer();

async function createCopy(app: TestApp, barcode?: string) {
  const res = await request(app)
    .post('/api/copies')
    .send({ work: { title: 'Tintin au Tibet' }, edition: { format: 'book', barcode } });
  return res.body as { id: number; edition: { id: number; coverPath: string | null } };
}

const putImage = (app: TestApp, url: string, body: Buffer, type = 'image/png') =>
  request(app).put(url).set('Content-Type', type).send(body);

const getCopy = async (app: TestApp, id: number) =>
  (await request(app).get(`/api/copies/${id}`)).body as {
    photoPath: string | null;
    edition: { coverPath: string | null };
  };

describe('pochette d’une édition', () => {
  it('convertit l’image en WebP, l’enregistre et la sert avec un cache immuable', async () => {
    const { app, files } = setup();
    const copy = await createCopy(app);

    const res = await putImage(app, `/api/editions/${copy.edition.id}/cover`, await png('#f00'));

    expect(res.status).toBe(200);
    expect(res.body.coverPath).toMatch(new RegExp(`^${copy.edition.id}-[0-9a-f]{10}\\.webp$`));
    expect(files('covers')).toEqual([res.body.coverPath]);
    expect((await getCopy(app, copy.id)).edition.coverPath).toBe(res.body.coverPath);

    const served = await request(app).get(`/covers/${res.body.coverPath}`);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/webp');
    expect(served.headers['cache-control']).toContain('immutable');
  });

  it('réduit une grande image sans l’agrandir', async () => {
    const { app } = setup();
    const copy = await createCopy(app);

    const res = await putImage(
      app,
      `/api/editions/${copy.edition.id}/cover`,
      await png('#00f', 2000, 3000),
    );
    const served = await request(app)
      .get(`/covers/${res.body.coverPath}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    const meta = await sharp(served.body as Buffer).metadata();
    expect(meta.height).toBe(900);
    expect(meta.width).toBe(600);
  });

  it('remplace l’ancienne pochette et supprime son fichier', async () => {
    const { app, files } = setup();
    const copy = await createCopy(app);
    const url = `/api/editions/${copy.edition.id}/cover`;

    const first = await putImage(app, url, await png('#f00'));
    const second = await putImage(app, url, await png('#0f0'));

    expect(second.body.coverPath).not.toBe(first.body.coverPath);
    expect(files('covers')).toEqual([second.body.coverPath]);
  });

  it('accepte un fichier sans type MIME connu et en vérifie le contenu', async () => {
    const { app, files } = setup();
    const copy = await createCopy(app);
    const url = `/api/editions/${copy.edition.id}/cover`;

    const valid = await putImage(app, url, await png('#f00'), 'application/octet-stream');
    const garbage = await putImage(app, url, Buffer.from('x'), 'application/octet-stream');

    expect(valid.status).toBe(200);
    expect(garbage.status).toBe(415);
    expect(files('covers')).toEqual([valid.body.coverPath]);
  });

  it('rejette un contenu qui n’est pas une image', async () => {
    const { app, files } = setup();
    const copy = await createCopy(app);
    const url = `/api/editions/${copy.edition.id}/cover`;

    const garbage = await putImage(app, url, Buffer.from('pas une image'));
    const wrongType = await putImage(app, url, await png('#f00'), 'application/json');

    expect(garbage.status).toBe(415);
    expect(garbage.body.error.code).toBe('image.invalid');
    expect(wrongType.status).toBe(415);
    expect(files('covers')).toEqual([]);
  });

  it('répond 404 pour une édition inconnue', async () => {
    const { app, files } = setup();

    const res = await putImage(app, '/api/editions/999/cover', await png('#f00'));

    expect(res.status).toBe(404);
    expect(files('covers')).toEqual([]);
  });

  it('retire la pochette et son fichier', async () => {
    const { app, files } = setup();
    const copy = await createCopy(app);
    const url = `/api/editions/${copy.edition.id}/cover`;
    await putImage(app, url, await png('#f00'));

    expect((await request(app).delete(url)).status).toBe(204);

    expect(files('covers')).toEqual([]);
    expect((await getCopy(app, copy.id)).edition.coverPath).toBeNull();
    expect((await request(app).delete('/api/editions/999/cover')).status).toBe(404);
  });
});

describe('photo d’un exemplaire', () => {
  it('enregistre, remplace puis retire la photo', async () => {
    const { app, files } = setup();
    const copy = await createCopy(app);
    const url = `/api/copies/${copy.id}/photo`;

    const first = await putImage(app, url, await png('#f00'));
    expect(first.status).toBe(200);
    expect((await getCopy(app, copy.id)).photoPath).toBe(first.body.photoPath);
    expect((await request(app).get(`/photos/${first.body.photoPath}`)).status).toBe(200);

    const second = await putImage(app, url, await png('#0f0'));
    expect(files('photos')).toEqual([second.body.photoPath]);

    expect((await request(app).delete(url)).status).toBe(204);
    expect(files('photos')).toEqual([]);
    expect((await getCopy(app, copy.id)).photoPath).toBeNull();
  });

  it('répond 404 pour un exemplaire inconnu et 415 pour une image illisible', async () => {
    const { app } = setup();
    const copy = await createCopy(app);

    expect((await putImage(app, '/api/copies/999/photo', await png('#f00'))).status).toBe(404);
    expect((await putImage(app, `/api/copies/${copy.id}/photo`, Buffer.from('x'))).status).toBe(
      415,
    );
    expect((await request(app).delete('/api/copies/999/photo')).status).toBe(404);
  });
});

describe('suppression d’un exemplaire', () => {
  it('supprime sa photo, et la pochette avec la dernière édition', async () => {
    const { app, files } = setup();
    const copy = await createCopy(app);
    await putImage(app, `/api/copies/${copy.id}/photo`, await png('#f00'));
    await putImage(app, `/api/editions/${copy.edition.id}/cover`, await png('#0f0'));

    expect((await request(app).delete(`/api/copies/${copy.id}`)).status).toBe(204);

    expect(files('photos')).toEqual([]);
    expect(files('covers')).toEqual([]);
  });

  it('répond 204 même si un fichier ne peut pas être supprimé', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { app, db, dataDir } = setup();
    const copy = await createCopy(app);
    // Un dossier au nom attendu : `rm` sans `recursive` échoue dessus.
    const stuck = `${copy.id}-aaaaaaaaaa.webp`;
    fs.mkdirSync(path.join(dataDir, 'images', 'photos', stuck));
    db.prepare('UPDATE copies SET photo_path = ? WHERE id = ?').run(stuck, copy.id);

    const res = await request(app).delete(`/api/copies/${copy.id}`);

    expect(res.status).toBe(204);
    expect((await request(app).get(`/api/copies/${copy.id}`)).status).toBe(404);
  });

  it('garde la pochette tant qu’un autre exemplaire de l’édition existe', async () => {
    const { app, files } = setup();
    const first = await createCopy(app, '9782203001190');
    const second = await createCopy(app, '9782203001190');
    await putImage(app, `/api/editions/${first.edition.id}/cover`, await png('#0f0'));

    await request(app).delete(`/api/copies/${first.id}`);
    expect(files('covers')).toHaveLength(1);

    await request(app).delete(`/api/copies/${second.id}`);
    expect(files('covers')).toEqual([]);
  });
});

describe('pochette trouvée en ligne', () => {
  const provider = (find: CoverProvider['find'], supports = true): CoverProvider => ({
    source: 'fake',
    supports: () => supports,
    find,
  });

  it('est récupérée en arrière-plan à l’ajout d’un exemplaire', async () => {
    const image = await png('#f00');
    const { app, files } = setup([provider(() => Promise.resolve(image))]);
    const copy = await createCopy(app);

    await vi.waitFor(async () => {
      expect((await getCopy(app, copy.id)).edition.coverPath).not.toBeNull();
    });
    expect(files('covers')).toHaveLength(1);
  });

  it('n’écrase pas une pochette déjà présente à l’ajout d’un second exemplaire', async () => {
    const find = vi.fn().mockResolvedValue(await png('#f00'));
    const { app } = setup([provider(find)]);
    const first = await createCopy(app, '9782203001190');
    await vi.waitFor(async () => {
      expect((await getCopy(app, first.id)).edition.coverPath).not.toBeNull();
    });

    await createCopy(app, '9782203001190');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(find).toHaveBeenCalledTimes(1);
  });

  it('ne remplace pas une pochette envoyée pendant la recherche d’arrière-plan', async () => {
    const online = await png('#0f0');
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { app, files } = setup([provider(() => gate.then(() => online))]);
    const copy = await createCopy(app);

    const manual = await putImage(app, `/api/editions/${copy.edition.id}/cover`, await png('#f00'));
    release();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect((await getCopy(app, copy.id)).edition.coverPath).toBe(manual.body.coverPath);
    expect(files('covers')).toEqual([manual.body.coverPath]);
  });

  it('ignore une source en erreur et passe à la suivante', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const image = await png('#f00');
    const { app } = setup([
      provider(() => Promise.reject(new Error('HTTP 500'))),
      provider(() => Promise.resolve(image)),
    ]);
    const copy = await createCopy(app);

    const res = await request(app).post(`/api/editions/${copy.edition.id}/cover/fetch`);

    expect(res.status).toBe(200);
    expect((await getCopy(app, copy.id)).edition.coverPath).not.toBeNull();
  });

  it('ignore une source qui renvoie une image illisible', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { app } = setup([provider(() => Promise.resolve(Buffer.from('<html>')))]);
    const copy = await createCopy(app);

    const res = await request(app).post(`/api/editions/${copy.edition.id}/cover/fetch`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('image.no_cover_found');
  });

  it('remplace la pochette existante sur demande, 404 si aucune source n’en a', async () => {
    const image = await png('#0f0');
    const { app } = setup([provider(() => Promise.resolve(image))]);
    const copy = await createCopy(app);
    const manual = await putImage(app, `/api/editions/${copy.edition.id}/cover`, await png('#f00'));

    const res = await request(app).post(`/api/editions/${copy.edition.id}/cover/fetch`);

    expect(res.status).toBe(200);
    expect((await getCopy(app, copy.id)).edition.coverPath).not.toBe(manual.body.coverPath);
    expect((await request(app).post('/api/editions/999/cover/fetch')).status).toBe(404);

    const none = setup([provider(() => Promise.resolve(null))]);
    const other = await createCopy(none.app);
    expect(
      (await request(none.app).post(`/api/editions/${other.edition.id}/cover/fetch`)).body.error
        .code,
    ).toBe('image.no_cover_found');
  });
});

describe('sources de pochettes', () => {
  const imageResponse = (status = 200, type = 'image/jpeg') =>
    new Response(status === 200 ? new Uint8Array([1, 2, 3]) : null, {
      status,
      headers: { 'content-type': type },
    });
  const book = { format: 'book', barcode: '9782203001190', title: 'Tintin', year: null } as const;

  it('Open Library : ISBN uniquement, 404 → pas de pochette', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(imageResponse())
      .mockResolvedValueOnce(imageResponse(404));
    const provider = createOpenLibraryCoverProvider(fetchFn);

    expect(provider.supports(book)).toBe(true);
    expect(provider.supports({ ...book, barcode: '5051889000001' })).toBe(false);
    expect(provider.supports({ ...book, barcode: null })).toBe(false);
    expect(provider.supports({ ...book, format: 'dvd' })).toBe(false);

    expect(await provider.find(book)).toEqual(Buffer.from([1, 2, 3]));
    expect(fetchFn.mock.calls[0][0]).toBe(
      'https://covers.openlibrary.org/b/isbn/9782203001190-L.jpg?default=false',
    );
    expect(await provider.find(book)).toBeNull();
  });

  it('Open Library : un contenu qui n’est pas une image est ignoré, une erreur HTTP est levée', async () => {
    const html = vi.fn().mockResolvedValue(imageResponse(200, 'text/html'));
    expect(await createOpenLibraryCoverProvider(html).find(book)).toBeNull();

    const failing = vi.fn().mockResolvedValue(imageResponse(500));
    await expect(createOpenLibraryCoverProvider(failing).find(book)).rejects.toThrow('HTTP 500');
  });

  it('TMDB : retient l’affiche du film dont le titre et l’année concordent', async () => {
    const search = (results: object[]) => new Response(JSON.stringify({ results }));
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        search([
          {
            title: 'Alien, le huitième passager',
            release_date: '1986-01-01',
            poster_path: '/x.jpg',
          },
          { title: 'Alien', release_date: '1979-05-25', poster_path: '/alien.jpg' },
        ]),
      )
      .mockResolvedValueOnce(imageResponse());
    const provider = createTmdbCoverProvider('key', fetchFn);
    const query = { format: 'bluray', barcode: null, title: 'Alien', year: 1979 } as const;

    expect(provider.supports(query)).toBe(true);
    expect(provider.supports(book)).toBe(false);
    expect(await provider.find(query)).toEqual(Buffer.from([1, 2, 3]));
    expect(fetchFn.mock.calls[1][0]).toBe('https://image.tmdb.org/t/p/w500/alien.jpg');
  });

  it('TMDB : aucun film concordant → pas d’affiche', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ results: [{ title: 'Autre chose', poster_path: '/a.jpg' }] }),
        ),
      );
    const query = { format: 'dvd', barcode: null, title: 'Alien', year: null } as const;

    expect(await createTmdbCoverProvider('key', fetchFn).find(query)).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('accès aux fichiers', () => {
  it('exige une session pour les images quand l’authentification est active', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfctrl-images-'));
    tempDirs.push(dataDir);
    const { db } = createTestDbWithUser();
    const app = createApp(db, {
      barcodeProviders: [],
      titleSearchProviders: [],
      images: { dataDir, coverProviders: [] },
      auth: { sessionSecret: 'x'.repeat(32), secureCookies: false },
    });

    expect((await request(app).get('/covers/1-aaaaaaaaaa.webp')).status).toBe(401);
    expect((await request(app).get('/photos/1-aaaaaaaaaa.webp')).status).toBe(401);
  });

  it('répond 404 pour un fichier inexistant', async () => {
    const { app } = setup();

    expect((await request(app).get('/covers/1-aaaaaaaaaa.webp')).status).toBe(404);
  });
});
