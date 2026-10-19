import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.js';
import { createDb, initDatabase } from '../../db/init.js';
import { createBnfTitleSearch } from './providers/bnf.js';
import { createDefaultTitleSearchProviders } from './providers/index.js';
import { createOpenLibraryTitleSearch } from './providers/openLibrary.js';
import { createTmdbTitleSearch } from './providers/tmdb.js';
import type { TitleSearchProvider } from './providers/types.js';

function bnfRecord(fields: string): string {
  return `<srw:recordData><mxc:record xmlns:mxc="x" format="UNIMARC">${fields}</mxc:record></srw:recordData>`;
}

const datafield = (tag: string, subfields: Record<string, string>) =>
  `<mxc:datafield tag="${tag}" ind1=" " ind2=" ">${Object.entries(subfields)
    .map(([code, value]) => `<mxc:subfield code="${code}">${value}</mxc:subfield>`)
    .join('')}</mxc:datafield>`;

const BNF_XML = `<srw:records>${bnfRecord(
  datafield('010', { a: '978-2-203-00119-0' }) +
    datafield('200', { a: 'Tintin au Tibet' }) +
    datafield('214', { c: 'Casterman', d: '2006' }),
)}${bnfRecord(datafield('200', { a: 'Tintin et les Picaros' }))}${bnfRecord(
  datafield('010', { a: 'pas un isbn' }) + datafield('200', { a: 'Tintin &amp; Milou' }),
)}</srw:records>`;

const fakeFetch = (body: unknown, status = 200) =>
  vi
    .fn()
    .mockResolvedValue(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
    );

const stubProvider = (
  source: TitleSearchProvider['source'],
  search: TitleSearchProvider['search'],
): TitleSearchProvider => ({ source, search });

function setup(providers: TitleSearchProvider[]) {
  const db = createDb(':memory:');
  initDatabase(db);
  return createApp(db, {
    barcodeProviders: [],
    llmProvider: null,
    titleSearchProviders: providers,
  });
}

const result = (barcode: string | null, title: string) => ({
  barcode,
  source: 'bnf' as const,
  suggestion: {
    work: { title, series: null, volumeNumber: null, creators: null, year: null },
    edition: { format: null, publisher: null, releaseYear: null, language: null },
  },
});

describe('GET /api/titles/search', () => {
  it('fusionne les sources et retire les doublons de code-barres', async () => {
    const app = setup([
      stubProvider('bnf', () => Promise.resolve([result('9782203001190', 'A'), result(null, 'B')])),
      stubProvider('openlibrary', () =>
        Promise.resolve([result('9782203001190', 'A bis'), result(null, 'C')]),
      ),
    ]);

    const res = await request(app).get('/api/titles/search').query({ q: 'tintin' });

    expect(res.status).toBe(200);
    expect(
      res.body.results.map(
        (r: { suggestion: { work: { title: string } } }) => r.suggestion.work.title,
      ),
    ).toEqual(['A', 'B', 'C']);
  });

  it('laisse une place à chaque source quand la liste est tronquée', async () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      result(`book-${index}`, `Livre ${index}`),
    );
    const app = setup([
      stubProvider('bnf', () => Promise.resolve(many)),
      stubProvider('tmdb', () => Promise.resolve([result(null, 'Film 1'), result(null, 'Film 2')])),
    ]);

    const res = await request(app).get('/api/titles/search').query({ q: 'tintin' });

    const titles = res.body.results.map(
      (r: { suggestion: { work: { title: string } } }) => r.suggestion.work.title,
    );
    expect(titles).toHaveLength(20);
    expect(titles.slice(0, 4)).toEqual(['Livre 0', 'Film 1', 'Livre 1', 'Film 2']);
  });

  it('retire les doublons sans code-barres de même titre et de même année', async () => {
    const app = setup([
      stubProvider('openlibrary', () =>
        Promise.resolve([result(null, 'Alien'), result(null, 'Alien 2')]),
      ),
      stubProvider('tmdb', () => Promise.resolve([result(null, ' alien ')])),
    ]);

    const res = await request(app).get('/api/titles/search').query({ q: 'alien' });

    expect(res.body.results).toHaveLength(2);
  });

  it('ignore une source en erreur', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const app = setup([
      stubProvider('bnf', () => Promise.reject(new Error('HTTP 500'))),
      stubProvider('openlibrary', () => Promise.resolve([result(null, 'C')])),
    ]);

    const res = await request(app).get('/api/titles/search').query({ q: 'tintin' });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
  });

  it('renvoie une liste vide quand rien n’est trouvé', async () => {
    const app = setup([stubProvider('bnf', () => Promise.resolve([]))]);

    const res = await request(app).get('/api/titles/search').query({ q: 'zzzz' });

    expect(res.body).toEqual({ results: [] });
  });

  it('rejette une requête absente ou trop courte', async () => {
    const app = setup([]);

    expect((await request(app).get('/api/titles/search')).status).toBe(400);
    expect((await request(app).get('/api/titles/search').query({ q: ' a ' })).status).toBe(400);
  });
});

describe('providers de recherche par titre', () => {
  it('BnF : lit titre, éditeur (zone 214) et ISBN normalisé, et neutralise les guillemets', async () => {
    const fetchFn = fakeFetch(BNF_XML);

    const results = await createBnfTitleSearch(fetchFn).search('tintin "tibet"');

    const url = new URL(fetchFn.mock.calls[0][0] as string);
    expect(url.searchParams.get('query')).toBe(
      'bib.title all "tintin  tibet" and bib.doctype any "a"',
    );
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      barcode: '9782203001190',
      source: 'bnf',
      suggestion: {
        work: { title: 'Tintin au Tibet' },
        edition: { format: 'book', publisher: 'Casterman', releaseYear: 2006 },
      },
    });
    expect(results[1].barcode).toBeNull();
    expect(results[2].barcode).toBeNull();
    expect(results[2].suggestion.work.title).toBe('Tintin & Milou');
  });

  it('BnF : une saisie réduite à des guillemets n’appelle pas la BnF', async () => {
    const fetchFn = fakeFetch(BNF_XML);

    expect(await createBnfTitleSearch(fetchFn).search('""')).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('BnF : aucune notice → liste vide', async () => {
    expect(await createBnfTitleSearch(fakeFetch('<srw:records/>')).search('zzz')).toEqual([]);
  });

  it('BnF : une réponse HTTP en échec lève une erreur', async () => {
    await expect(createBnfTitleSearch(fakeFetch('', 500)).search('x y')).rejects.toThrow(
      'HTTP 500',
    );
  });

  it('Open Library : garde le premier ISBN valide', async () => {
    const fetchFn = fakeFetch({
      docs: [
        {
          title: 'Tintin au Tibet',
          author_name: ['Hergé'],
          first_publish_year: 1960,
          publisher: ['Casterman'],
          isbn: ['123', '9782203001190'],
        },
        { title: 'Sans ISBN' },
      ],
    });

    const results = await createOpenLibraryTitleSearch(fetchFn).search('tintin');

    expect(results[0]).toMatchObject({
      barcode: '9782203001190',
      source: 'openlibrary',
      suggestion: {
        work: { title: 'Tintin au Tibet', creators: 'Hergé', year: 1960 },
        edition: { publisher: 'Casterman' },
      },
    });
    expect(results[1].barcode).toBeNull();
  });

  it('TMDB : titre et année, sans code-barres ni support', async () => {
    const fetchFn = fakeFetch({
      results: [{ title: 'Le Fabuleux Destin', release_date: '2001-04-25' }],
    });

    const results = await createTmdbTitleSearch('key', fetchFn).search('amelie');

    expect(results).toEqual([
      {
        barcode: null,
        source: 'tmdb',
        suggestion: {
          work: {
            title: 'Le Fabuleux Destin',
            series: null,
            volumeNumber: null,
            creators: null,
            year: 2001,
          },
          edition: { format: null, publisher: null, releaseYear: null, language: null },
        },
      },
    ]);
  });

  it('TMDB n’est actif qu’avec sa clé', () => {
    expect(createDefaultTitleSearchProviders({}).map((p) => p.source)).toEqual([
      'bnf',
      'openlibrary',
    ]);
    expect(createDefaultTitleSearchProviders({ TMDB_API_KEY: 'k' }).map((p) => p.source)).toEqual([
      'bnf',
      'openlibrary',
      'tmdb',
    ]);
  });
});
