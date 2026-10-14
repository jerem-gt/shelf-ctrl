import { describe, expect, it } from 'vitest';

import { createGoogleBooksProvider } from './googleBooks.js';
import { createDefaultProviders } from './index.js';
import { createOpenLibraryProvider } from './openLibrary.js';
import { createTmdbEnricher } from './tmdb.js';
import { extractVolume, extractYear, type FetchFn } from './types.js';
import { createUpcItemDbProvider } from './upcItemDb.js';
import { cleanVideoTitle, detectVideoFormat } from './video.js';

function urlOf(input: Parameters<FetchFn>[0]): string {
  if (typeof input === 'string') {
    return input;
  }
  return input instanceof URL ? input.href : input.url;
}

function fakeFetch(body: unknown, status = 200) {
  const urls: string[] = [];
  const fetchFn: FetchFn = (input) => {
    urls.push(urlOf(input));
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };
  return { fetchFn, urls };
}

function failingFetch(): FetchFn {
  return () => Promise.reject(new TypeError('fetch failed'));
}

describe('extractYear / extractVolume', () => {
  it('lit l’année et le tome quand ils sont présents', () => {
    expect(extractYear('October 1, 1988')).toBe(1988);
    expect(extractYear('sans date')).toBeNull();
    expect(extractYear(undefined)).toBeNull();
    expect(extractVolume('One piece - Édition originale Vol.11 Le plus grand bandit')).toBe(11);
    expect(extractVolume('Astérix, tome 3')).toBe(3);
    expect(extractVolume('Tintin au Tibet')).toBeNull();
  });
});

describe('Open Library', () => {
  const entry = {
    title: 'Tintin au Tibet',
    authors: [{ name: 'Hergé' }],
    publishers: [{ name: 'Casterman' }],
    publish_date: '1960',
    subjects: [{ name: 'Fiction' }, { name: 'series:Les Aventures de Tintin' }],
  };

  it('extrait titre, auteurs, éditeur, année et série', async () => {
    const { fetchFn, urls } = fakeFetch({ 'ISBN:9782203001190': entry });
    const suggestion = await createOpenLibraryProvider(fetchFn).lookup('9782203001190');

    expect(urls[0]).toContain('bibkeys=ISBN:9782203001190');
    expect(suggestion).toEqual({
      work: {
        title: 'Tintin au Tibet',
        series: 'Les Aventures de Tintin',
        volumeNumber: null,
        creators: 'Hergé',
        year: null,
      },
      edition: { format: 'book', publisher: 'Casterman', releaseYear: 1960, language: null },
    });
  });

  it('tolère une fiche réduite au titre', async () => {
    const { fetchFn } = fakeFetch({ x: { title: 'Dune Vol.2' } });
    const suggestion = await createOpenLibraryProvider(fetchFn).lookup('9782203001190');

    expect(suggestion?.work).toMatchObject({
      title: 'Dune Vol.2',
      volumeNumber: 2,
      creators: null,
    });
    expect(suggestion?.edition).toMatchObject({ publisher: null, releaseYear: null });
  });

  it('renvoie null pour un code inconnu ou une réponse inattendue', async () => {
    const provider = (body: unknown) => createOpenLibraryProvider(fakeFetch(body).fetchFn);
    expect(await provider({}).lookup('9782203001190')).toBeNull();
    expect(await provider({ x: { sans: 'titre' } }).lookup('9782203001190')).toBeNull();
  });

  it('propage les erreurs HTTP et réseau', async () => {
    await expect(
      createOpenLibraryProvider(fakeFetch({}, 503).fetchFn).lookup('9782203001190'),
    ).rejects.toThrow('HTTP 503');
    await expect(createOpenLibraryProvider(failingFetch()).lookup('9782203001190')).rejects.toThrow(
      'fetch failed',
    );
  });
});

describe('Google Books', () => {
  it('envoie la clé et extrait la fiche', async () => {
    const { fetchFn, urls } = fakeFetch({
      items: [
        {
          volumeInfo: {
            title: 'Blake et Mortimer, tome 1',
            authors: ['Edgar P. Jacobs', 'Autre'],
            publisher: 'Dargaud',
            publishedDate: '2012-05-01',
            language: 'fr',
          },
        },
      ],
    });
    const suggestion = await createGoogleBooksProvider('clé secrète', fetchFn).lookup(
      '9782203001190',
    );

    expect(urls[0]).toContain('q=isbn:9782203001190');
    expect(urls[0]).toContain('key=cl%C3%A9%20secr%C3%A8te');
    expect(suggestion).toEqual({
      work: {
        title: 'Blake et Mortimer, tome 1',
        series: null,
        volumeNumber: 1,
        creators: 'Edgar P. Jacobs, Autre',
        year: null,
      },
      edition: { format: 'book', publisher: 'Dargaud', releaseYear: 2012, language: 'fr' },
    });
  });

  it('renvoie null sans résultat et propage une erreur de quota', async () => {
    expect(
      await createGoogleBooksProvider('k', fakeFetch({ totalItems: 0 }).fetchFn).lookup(
        '9782203001190',
      ),
    ).toBeNull();
    await expect(
      createGoogleBooksProvider('k', fakeFetch({}, 429).fetchFn).lookup('9782203001190'),
    ).rejects.toThrow('HTTP 429');
  });
});

describe('titres vidéo', () => {
  it.each([
    ['Blade Runner 2049 [4K Ultra HD]', 'uhd4k', 'Blade Runner 2049'],
    ['Alien - Blu-ray', 'bluray', 'Alien'],
    ['Le Parrain (DVD)', 'dvd', 'Le Parrain'],
    ['Heat Blu-ray Steelbook Édition Collector', 'bluray', 'Heat Édition Collector'],
    ['Amélie Poulain', null, 'Amélie Poulain'],
    ['DVD', 'dvd', 'DVD'],
  ])('lit le format et nettoie « %s »', (title, format, cleaned) => {
    expect(detectVideoFormat(title)).toBe(format);
    expect(cleanVideoTitle(title)).toBe(cleaned);
  });
});

describe('UPCitemdb', () => {
  it('déduit le titre et le format de l’intitulé produit', async () => {
    const { fetchFn, urls } = fakeFetch({ code: 'OK', items: [{ title: 'Alien [Blu-ray]' }] });
    const suggestion = await createUpcItemDbProvider(fetchFn).lookup('3333297329439');

    expect(urls[0]).toContain('upc=3333297329439');
    expect(suggestion?.work.title).toBe('Alien');
    expect(suggestion?.edition.format).toBe('bluray');
  });

  it('renvoie null quand aucun produit ne correspond', async () => {
    const { fetchFn } = fakeFetch({ code: 'OK', items: [] });
    expect(await createUpcItemDbProvider(fetchFn).lookup('3333297329439')).toBeNull();
  });

  it('lève une erreur quand le service limite le débit ou répond de travers', async () => {
    await expect(
      createUpcItemDbProvider(fakeFetch({ code: 'TOO_FAST' }).fetchFn).lookup('3333297329439'),
    ).rejects.toThrow('TOO_FAST');
    await expect(
      createUpcItemDbProvider(fakeFetch({ autre: 1 }).fetchFn).lookup('3333297329439'),
    ).rejects.toThrow('Réponse inattendue');
  });
});

describe('TMDB', () => {
  const suggestion = {
    work: {
      title: 'blade runner 2049',
      series: null,
      volumeNumber: null,
      creators: null,
      year: null,
    },
    edition: { format: 'bluray' as const, publisher: null, releaseYear: null, language: null },
  };

  it('remplace le titre et l’année quand le film correspond', async () => {
    const { fetchFn, urls } = fakeFetch({
      results: [{ title: 'Blade Runner 2049', release_date: '2017-10-04' }],
    });
    const enriched = await createTmdbEnricher('clé', fetchFn)(suggestion);

    expect(urls[0]).toContain('query=blade%20runner%202049');
    expect(urls[0]).toContain('language=fr-FR');
    expect(enriched.work).toMatchObject({ title: 'Blade Runner 2049', year: 2017 });
    expect(enriched.edition).toEqual(suggestion.edition);
  });

  it('garde la fiche d’origine si le film est sans rapport, absent ou si l’appel échoue', async () => {
    const unrelated = fakeFetch({ results: [{ title: 'Titanic', release_date: '1997-12-19' }] });
    expect(await createTmdbEnricher('k', unrelated.fetchFn)(suggestion)).toBe(suggestion);

    const empty = fakeFetch({ results: [] });
    expect(await createTmdbEnricher('k', empty.fetchFn)(suggestion)).toBe(suggestion);

    expect(await createTmdbEnricher('k', failingFetch())(suggestion)).toBe(suggestion);
  });

  it('compare strictement les titres très courts', async () => {
    const short = { ...suggestion, work: { ...suggestion.work, title: 'It' } };
    const { fetchFn } = fakeFetch({ results: [{ title: 'Itinéraire' }] });
    expect(await createTmdbEnricher('k', fetchFn)(short)).toBe(short);
  });
});

describe('createDefaultProviders', () => {
  it('n’active que les sources sans clé par défaut', () => {
    expect(createDefaultProviders({}).map((p) => p.source)).toEqual([
      'bnf',
      'openlibrary',
      'upcitemdb',
    ]);
  });

  it('place Google Books après la BnF quand sa clé est renseignée', () => {
    const sources = createDefaultProviders({ GOOGLE_BOOKS_API_KEY: 'k' }).map((p) => p.source);
    expect(sources).toEqual(['bnf', 'googlebooks', 'openlibrary', 'upcitemdb']);
  });

  it('enrichit les fiches vidéo avec TMDB quand sa clé est renseignée', async () => {
    const calls: string[] = [];
    const fetchFn: FetchFn = (input) => {
      const url = urlOf(input);
      calls.push(url);
      const body = url.includes('themoviedb')
        ? { results: [{ title: 'Alien', release_date: '1979-05-25' }] }
        : { code: 'OK', items: [{ title: 'alien blu-ray' }] };
      return Promise.resolve(new Response(JSON.stringify(body)));
    };
    const upc = createDefaultProviders({ TMDB_API_KEY: 'k' }, fetchFn).find(
      (p) => p.source === 'upcitemdb',
    );

    const suggestion = await upc?.lookup('3333297329439');
    expect(suggestion?.work).toMatchObject({ title: 'Alien', year: 1979 });
    expect(calls).toHaveLength(2);

    const none: FetchFn = () =>
      Promise.resolve(new Response(JSON.stringify({ code: 'OK', items: [] })));
    const upcEmpty = createDefaultProviders({ TMDB_API_KEY: 'k' }, none).find(
      (p) => p.source === 'upcitemdb',
    );
    expect(await upcEmpty?.lookup('3333297329439')).toBeNull();
  });
});
