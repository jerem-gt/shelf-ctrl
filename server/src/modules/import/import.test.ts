import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { BarcodeSuggestion, ImportJob, ImportPreview } from '@shelfctrl/types';
import sharp from 'sharp';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.js';
import { createTestDbWithUser } from '../../tests/testDb.js';
import type { BarcodeProvider } from '../barcodes/providers/types.js';
import type { CoverProvider } from '../images/covers/types.js';
import { MAX_ROWS } from './rows.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

const ISBN_TINTIN = '9782203001190';
const ISBN_PRINCE = '9782070612758';
const EAN_ALIEN = '5051889000006';

const suggestion = (title: string, overrides: Partial<BarcodeSuggestion['edition']> = {}) =>
  ({
    work: { title, series: null, volumeNumber: null, creators: 'Auteur en ligne', year: 1979 },
    edition: {
      format: null,
      publisher: 'Éditeur en ligne',
      releaseYear: null,
      language: null,
      ...overrides,
    },
  }) satisfies BarcodeSuggestion;

/** Source de codes-barres simulée : seuls ces trois codes sont connus. */
function fakeProvider(delay?: Promise<void>, malformed: string[] = []): BarcodeProvider {
  const known: Record<string, BarcodeSuggestion> = {
    [ISBN_PRINCE]: suggestion('Le Petit Prince', { format: 'book' }),
    [EAN_ALIEN]: suggestion('Alien', { format: 'bluray' }),
    [ISBN_TINTIN]: suggestion('Titre en ligne', { format: 'book' }),
  };
  return {
    source: 'bnf',
    kinds: ['isbn', 'ean'],
    async lookup(code) {
      await delay;
      if (malformed.includes(code)) {
        // Une source qui répond n'importe quoi : la ligne échoue, pas tout l'import.
        return {} as BarcodeSuggestion;
      }
      return known[code] ?? null;
    },
  };
}

const png = () =>
  sharp({ create: { width: 20, height: 30, channels: 3, background: '#f00' } })
    .png()
    .toBuffer();

function setup(
  options: { delay?: Promise<void>; covers?: CoverProvider[]; malformed?: string[] } = {},
) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfctrl-import-'));
  tempDirs.push(dataDir);
  const { db } = createTestDbWithUser();
  return createApp(db, {
    barcodeProviders: [fakeProvider(options.delay, options.malformed)],
    titleSearchProviders: [],
    images: { dataDir, coverProviders: options.covers ?? [] },
  });
}

type TestApp = ReturnType<typeof setup>;

const csv = (...lines: string[]) => `${lines.join('\n')}\n`;
const preview = (app: TestApp, body: string | Buffer, type = 'application/octet-stream') =>
  request(app).post('/api/import/preview').set('Content-Type', type).send(body);
const start = (app: TestApp, body: string, type = 'application/octet-stream') =>
  request(app).post('/api/import').set('Content-Type', type).send(body);

async function runImport(app: TestApp, body: string): Promise<ImportJob> {
  const res = await start(app, body);
  expect(res.status).toBe(202);
  const id = (res.body as ImportJob).id;
  let job = res.body as ImportJob;
  await vi.waitFor(async () => {
    job = (await request(app).get(`/api/import/${id}`)).body as ImportJob;
    expect(job.status).not.toBe('running');
  });
  return job;
}

const listCopies = async (app: TestApp) =>
  (await request(app).get('/api/copies?limit=200')).body.items as {
    work: {
      title: string;
      series: string | null;
      volumeNumber: number | null;
      creators: string | null;
    };
    edition: {
      format: string;
      barcode: string | null;
      publisher: string | null;
      coverPath: string | null;
    };
    condition: string;
    conditionNote: string | null;
    location: string | null;
  }[];

describe('GET /api/import/template', () => {
  it('fournit un modèle CSV lisible par Excel (BOM, séparateur ;) que l’aperçu accepte', async () => {
    const app = setup();

    const res = await request(app).get('/api/import/template');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text.startsWith('﻿Titre;Série;Tome;')).toBe(true);

    const check = await preview(app, res.text);
    expect(check.status).toBe(200);
    expect((check.body as ImportPreview).invalid).toBe(0);
  });

  it('fournit le modèle en anglais, que l’aperçu accepte aussi', async () => {
    const app = setup();

    const res = await request(app).get('/api/import/template?lang=en');

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('shelfctrl-template.csv');
    expect(res.text.startsWith('﻿Title;Series;Volume;')).toBe(true);

    const check = await preview(app, res.text);
    expect(check.status).toBe(200);
    expect((check.body as ImportPreview).invalid).toBe(0);
  });

  it('refuse une langue inconnue', async () => {
    const res = await request(setup()).get('/api/import/template?lang=de');

    expect(res.status).toBe(400);
  });
});

describe('POST /api/import/preview', () => {
  it('compte lignes valides, invalides, doublons et lignes à compléter, sans rien écrire', async () => {
    const app = setup();
    await request(app)
      .post('/api/copies')
      .send({ work: { title: 'Déjà là' }, edition: { format: 'book', barcode: ISBN_TINTIN } });

    const res = await preview(
      app,
      csv(
        'Titre;Code-barres;Format;Prix',
        `Tintin;${ISBN_TINTIN};Livre;5`,
        `;${ISBN_PRINCE};;7`,
        `Autre;${ISBN_PRINCE};;7`,
        'Sans format;;cassette;1',
        ';;;',
      ),
    );

    const body = res.body as ImportPreview;
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      total: 4,
      valid: 3,
      invalid: 1,
      duplicates: 2,
      toComplete: 3,
      ignoredColumns: ['Prix'],
    });
    expect(body.rows[3]).toMatchObject({
      line: 5,
      issues: [{ code: 'invalid_format', field: 'format' }],
    });
    expect((await request(app).get('/api/copies')).body.total).toBe(1);
  });

  it('détecte un doublon sans code-barres malgré les majuscules accentuées', async () => {
    const app = setup();
    await request(app)
      .post('/api/copies')
      .send({ work: { title: 'Éclipse' }, edition: { format: 'book' } });

    const res = await preview(app, csv('Titre', 'éclipse', 'ÉCLIPSE', 'Autre chose'));

    // `lower()` de SQLite ne replie que l'ASCII : seul un repli en JavaScript les retrouve.
    expect((res.body as ImportPreview).rows.map((row) => row.duplicate)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('détecte un doublon sans code-barres par titre, série, tome et support', async () => {
    const app = setup();
    await request(app)
      .post('/api/copies')
      .send({
        work: { title: 'Le Lotus bleu', series: 'Tintin', volumeNumber: 5 },
        edition: { format: 'book' },
      });

    const res = await preview(
      app,
      csv('Titre;Série;Tome', 'le lotus bleu;TINTIN;5', 'Le Lotus bleu;Tintin;6'),
    );

    expect((res.body as ImportPreview).rows.map((row) => row.duplicate)).toEqual([true, false]);
  });

  it.each([
    ['un fichier vide', '', 'import.empty_file'],
    ['un fichier sans colonne utile', 'Auteur;Éditeur\nHergé;Casterman\n', 'import.no_columns'],
    ['un fichier sans ligne', 'Titre;Tome\n', null],
  ])('%s', async (_name, body, error) => {
    const res = await preview(setup(), body);

    if (error === null) {
      expect(res.body).toMatchObject({ total: 0, valid: 0 });
    } else {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(error);
    }
  });

  it('refuse un fichier de trop de lignes', async () => {
    const lines = [
      'Titre',
      ...Array.from({ length: MAX_ROWS + 1 }, (_, index) => `Livre ${index}`),
    ];

    const res = await preview(setup(), csv(...lines));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'import.too_many_rows',
      params: { max: MAX_ROWS },
    });
  });

  it('refuse un contenu qui n’est pas du texte', async () => {
    const res = await preview(setup(), JSON.stringify({ a: 1 }), 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('import.empty_file');
  });

  it('ignore un corps text/plain, envoyable par un formulaire cross-site (anti-CSRF)', async () => {
    const body = csv('Titre;Auteurs', 'Le Lotus bleu;Hergé');

    for (const res of [
      await preview(setup(), body, 'text/plain'),
      await start(setup(), body, 'text/plain'),
    ]) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('import.empty_file');
    }
  });

  it('lit un fichier Windows-1252 et un fichier sans type MIME', async () => {
    const latin1 = Buffer.from('Titre;Auteurs\nLe Lotus bleu;Hergé\n', 'latin1');

    const res = await preview(setup(), latin1, 'application/octet-stream');

    expect(res.status).toBe(200);
    expect((res.body as ImportPreview).rows[0].title).toBe('Le Lotus bleu');
  });
});

describe('POST /api/import', () => {
  it('crée les exemplaires du fichier, avec toutes leurs informations', async () => {
    const app = setup();

    const job = await runImport(
      app,
      csv(
        'Titre;Série;Tome;Auteurs;Format;Code-barres;Éditeur;Année;Langue;État;Note;Emplacement',
        `Tintin au Tibet;Tintin;20;Hergé;Livre;${ISBN_TINTIN};Casterman;1960;fr;Très bon état;coins écornés;Salon`,
        'Alien;;;Ridley Scott;Blu-ray;;;1979;;Bon état;;Chambre',
      ),
    );

    expect(job).toMatchObject({ status: 'done', total: 2, processed: 2, created: 2, failures: [] });
    const items = await listCopies(app);
    expect(items).toHaveLength(2);
    expect(items.find((item) => item.work.title === 'Tintin au Tibet')).toMatchObject({
      work: { series: 'Tintin', volumeNumber: 20, creators: 'Hergé' },
      edition: { format: 'book', barcode: ISBN_TINTIN, publisher: 'Casterman' },
      condition: 'very_good',
      conditionNote: 'coins écornés',
      location: 'Salon',
    });
    expect(items.find((item) => item.work.title === 'Alien')).toMatchObject({
      edition: { format: 'bluray' },
      condition: 'good',
    });
  });

  it('complète en ligne une ligne réduite à son code-barres', async () => {
    const app = setup();

    const job = await runImport(app, csv('Code-barres', ISBN_PRINCE, EAN_ALIEN));

    expect(job).toMatchObject({ created: 2, completed: 2, failures: [] });
    const items = await listCopies(app);
    expect(items.find((item) => item.edition.barcode === ISBN_PRINCE)).toMatchObject({
      work: { title: 'Le Petit Prince', creators: 'Auteur en ligne' },
      edition: { format: 'book', publisher: 'Éditeur en ligne' },
    });
    expect(items.find((item) => item.edition.barcode === EAN_ALIEN)?.edition.format).toBe('bluray');
  });

  it('garde les valeurs du fichier face à celles trouvées en ligne', async () => {
    const app = setup();

    await runImport(app, csv('Titre;Code-barres', `Mon titre;${ISBN_TINTIN}`));

    const [item] = await listCopies(app);
    expect(item.work.title).toBe('Mon titre');
    // Le titre était fourni : seuls les champs vides sont comblés.
    expect(item.work.creators).toBe('Auteur en ligne');
    expect(item.edition.publisher).toBe('Éditeur en ligne');
  });

  it('signale la ligne dont le code-barres est introuvable et sans titre', async () => {
    const app = setup();

    const job = await runImport(app, csv('Code-barres', '9782800101248', ISBN_PRINCE));

    expect(job).toMatchObject({ created: 1, processed: 2 });
    expect(job.failures).toEqual([
      { line: 2, title: null, issues: [{ code: 'not_found_online', field: 'title' }] },
    ]);
  });

  it('crée la ligne à partir du fichier quand la recherche en ligne ne trouve rien', async () => {
    const app = setup();

    const job = await runImport(app, csv('Titre;Code-barres', 'Inconnu;9782800101248'));

    expect(job).toMatchObject({ created: 1, completed: 0, failures: [] });
  });

  it('signale un code vidéo (EAN) sans support, ni fichier ni fiche', async () => {
    const app = setup();

    const job = await runImport(app, csv('Titre;Code-barres', 'Film inconnu;4006381333931'));

    expect(job.failures).toEqual([
      { line: 2, title: 'Film inconnu', issues: [{ code: 'missing_format', field: 'format' }] },
    ]);
  });

  it('rapporte les lignes invalides sans bloquer les autres', async () => {
    const app = setup();

    const job = await runImport(
      app,
      csv('Titre;Tome;État', 'Bon;1;Neuf', 'Mauvais tome;x;Neuf', 'Mauvais état;2;bof', ';;'),
    );

    expect(job).toMatchObject({ total: 3, processed: 3, created: 1 });
    expect(job.failures).toEqual([
      { line: 3, title: 'Mauvais tome', issues: [{ code: 'invalid_volume', field: 'volume' }] },
      {
        line: 4,
        title: 'Mauvais état',
        issues: [{ code: 'invalid_condition', field: 'condition' }],
      },
    ]);
    expect(await listCopies(app)).toHaveLength(1);
  });

  it('rapporte une ligne qui plante et poursuit l’import au lieu de l’abandonner', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = setup({ malformed: [ISBN_TINTIN] });

    const job = await runImport(app, csv('Code-barres', ISBN_TINTIN, ISBN_PRINCE, EAN_ALIEN));

    expect(job).toMatchObject({ status: 'done', total: 3, processed: 3, created: 2 });
    expect(job.failures).toEqual([
      { line: 2, title: null, issues: [{ code: 'invalid', field: null }] },
    ]);
    expect(await listCopies(app)).toHaveLength(2);
  });

  it('crée un exemplaire de plus pour un doublon, sur la même édition', async () => {
    const app = setup();

    const job = await runImport(
      app,
      csv('Titre;Code-barres', `Tintin;${ISBN_TINTIN}`, `Tintin;${ISBN_TINTIN}`),
    );

    expect(job.created).toBe(2);
    const items = await listCopies(app);
    expect(items).toHaveLength(2);
    expect(new Set(items.map((item) => item.edition.barcode)).size).toBe(1);
  });

  it('cherche la pochette de chaque nouvelle édition', async () => {
    const image = await png();
    const covers: CoverProvider[] = [
      { source: 'fake', supports: () => true, find: () => Promise.resolve(image) },
    ];
    const app = setup({ covers });

    const job = await runImport(app, csv('Titre', 'A', 'B'));

    expect(job).toMatchObject({ created: 2, coversFound: 2 });
    const items = await listCopies(app);
    expect(items.every((item) => item.edition.coverPath !== null)).toBe(true);
  });

  it('refuse un second import tant que le premier tourne', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const app = setup({ delay: gate });

    const first = await start(app, csv('Code-barres', ISBN_PRINCE));
    const second = await start(app, csv('Titre', 'X'));
    const running = (await request(app).get(`/api/import/${first.body.id}`)).body as ImportJob;
    release();

    expect(first.status).toBe(202);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('import.running');
    expect(running.status).toBe('running');

    await vi.waitFor(async () => {
      const done = (await request(app).get(`/api/import/${first.body.id}`)).body as ImportJob;
      expect(done.status).toBe('done');
    });
    expect((await start(app, csv('Titre', 'Y'))).status).toBe(202);
  });

  it('répond 404 pour un import inconnu et 400 pour un fichier inutilisable', async () => {
    const app = setup();

    expect((await request(app).get('/api/import/inconnu')).status).toBe(404);
    expect((await start(app, '')).status).toBe(400);
    expect((await start(app, 'Auteur\nHergé\n')).body.error.code).toBe('import.no_columns');
  });
});
