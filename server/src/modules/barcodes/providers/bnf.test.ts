import { describe, expect, it } from 'vitest';

import { createBnfProvider } from './bnf.js';
import type { FetchFn } from './types.js';

type Field = [tag: string, subfields: [code: string, value: string][]];

/** Réponse SRU `unimarcxchange` minimale, à la structure de celle du catalogue de la BnF. */
function sru(fields: Field[] | null): string {
  const datafields = (fields ?? [])
    .map(
      ([tag, subfields]) =>
        `<mxc:datafield tag="${tag}" ind1=" " ind2=" ">${subfields
          .map(([code, value]) => `<mxc:subfield code="${code}">${value}</mxc:subfield>`)
          .join('')}</mxc:datafield>`,
    )
    .join('');
  const records = fields
    ? `<srw:records><srw:record><srw:recordData><mxc:record xmlns:mxc="info:lc/xmlns/marcxchange-v2" format="UNIMARC"><mxc:leader>     cam  22        450 </mxc:leader>${datafields}</mxc:record></srw:recordData></srw:record></srw:records>`
    : '<srw:records/>';
  return `<?xml version="1.0" encoding="UTF-8"?><srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/"><srw:numberOfRecords>${fields ? 1 : 0}</srw:numberOfRecords>${records}</srw:searchRetrieveResponse>`;
}

function fakeFetch(body: string, status = 200) {
  const urls: string[] = [];
  const fetchFn: FetchFn = (input) => {
    urls.push(typeof input === 'string' ? input : 'autre');
    return Promise.resolve(new Response(body, { status }));
  };
  return { fetchFn, urls };
}

const lookup = (fields: Field[] | null, code = '9782203001190') =>
  createBnfProvider(fakeFetch(sru(fields)).fetchFn).lookup(code);

describe('BnF', () => {
  it('cherche l’ISBN-13 et l’ISBN-10 dans la même requête', async () => {
    const { fetchFn, urls } = fakeFetch(sru(null));
    await createBnfProvider(fetchFn).lookup('9782203001190');

    const params = new URL(urls[0]).searchParams;
    expect(new URL(urls[0]).origin).toBe('https://catalogue.bnf.fr');
    expect(params.get('recordSchema')).toBe('unimarcxchange');
    expect(params.get('maximumRecords')).toBe('1');
    expect(params.get('query')).toBe('bib.isbn adj "9782203001190" or bib.isbn adj "2203001194"');
  });

  it('ne cherche que l’ISBN-13 quand il n’a pas d’équivalent ISBN-10 (préfixe 979)', async () => {
    const { fetchFn, urls } = fakeFetch(sru(null));
    await createBnfProvider(fetchFn).lookup('9791234567896');

    expect(new URL(urls[0]).searchParams.get('query')).toBe('bib.isbn adj "9791234567896"');
  });

  it('extrait titre, série, tome, auteurs, éditeur, année et langue', async () => {
    const suggestion = await lookup([
      ['101', [['a', 'fre']]],
      [
        '200',
        [
          ['a', 'Tintin au Tibet'],
          ['b', 'Texte imprimé'],
          ['f', 'Hergé'],
        ],
      ],
      [
        '210',
        [
          ['a', 'Tournai'],
          ['c', 'Casterman'],
          ['d', '1991'],
        ],
      ],
      [
        '225',
        [
          ['a', 'Les Aventures de Tintin'],
          ['v', '20'],
        ],
      ],
      [
        '461',
        [
          ['t', 'Les Aventures de Tintin'],
          ['v', '20'],
        ],
      ],
      [
        '700',
        [
          ['a', 'Hergé'],
          ['4', '070'],
        ],
      ],
    ]);

    expect(suggestion).toEqual({
      work: {
        title: 'Tintin au Tibet',
        series: 'Les Aventures de Tintin',
        volumeNumber: 20,
        creators: 'Hergé',
        year: null,
      },
      edition: { format: 'book', publisher: 'Casterman', releaseYear: 1991, language: 'fr' },
    });
  });

  it('ignore la collection d’éditeur sans numéro et les traducteurs, garde les illustrateurs', async () => {
    const suggestion = await lookup([
      ['200', [['a', 'Le pire brigand de tout East-Blue']]],
      [
        '225',
        [
          ['a', 'One Piece'],
          ['v', '11'],
        ],
      ],
      [
        '225',
        [
          ['a', 'Shonen manga'],
          ['x', '1761-2268'],
        ],
      ],
      [
        '700',
        [
          ['a', 'Oda'],
          ['b', 'Eiichirō'],
        ],
      ],
      [
        '701',
        [
          ['a', 'Oda'],
          ['b', 'Eiichirō'],
        ],
      ],
      [
        '702',
        [
          ['a', 'Rabahi'],
          ['b', 'Djamel'],
          ['4', '730'],
        ],
      ],
      [
        '702',
        [
          ['a', 'Robin'],
          ['b', 'Thierry'],
          ['4', '440'],
        ],
      ],
    ]);

    expect(suggestion?.work).toMatchObject({
      series: 'One Piece',
      volumeNumber: 11,
      creators: 'Eiichirō Oda, Thierry Robin',
    });
  });

  it('retrouve série et tome dans la zone 461 pour une intégrale (cas réel Valérian)', async () => {
    const suggestion = await lookup(
      [
        ['101', [['a', 'fre']]],
        [
          '200',
          [
            ['a', 'Valérian et Laureline'],
            ['e', 'l&apos;intégrale'],
            ['h', 'Volume 1'],
          ],
        ],
        [
          '210',
          [
            ['c', 'Dargaud'],
            ['d', 'DL 2007'],
          ],
        ],
        [
          '461',
          [
            ['t', 'Valérian et Laureline'],
            ['v', '1'],
          ],
        ],
        [
          '700',
          [
            ['a', 'Mézières'],
            ['b', 'Jean-Claude'],
          ],
        ],
        [
          '701',
          [
            ['a', 'Christin'],
            ['b', 'Pierre'],
          ],
        ],
      ],
      '9782205060164',
    );

    expect(suggestion).toEqual({
      work: {
        title: "Valérian et Laureline : l'intégrale",
        series: 'Valérian et Laureline',
        volumeNumber: 1,
        creators: 'Jean-Claude Mézières, Pierre Christin',
        year: null,
      },
      edition: { format: 'book', publisher: 'Dargaud', releaseYear: 2007, language: 'fr' },
    });
  });

  it('utilise le titre propre du tome quand le titre de la série est en zone $a', async () => {
    const suggestion = await lookup([
      [
        '200',
        [
          ['a', 'Astérix'],
          ['h', '1'],
          ['i', 'Astérix le Gaulois'],
        ],
      ],
    ]);

    expect(suggestion?.work).toMatchObject({
      title: 'Astérix le Gaulois',
      series: 'Astérix',
      volumeNumber: 1,
    });
  });

  it('n’invente ni série ni tome pour une collection d’éditeur sans numéro', async () => {
    const suggestion = await lookup([
      ['200', [['a', 'Maus']]],
      [
        '225',
        [
          ['a', 'Collection poche'],
          ['x', '1234-5678'],
        ],
      ],
    ]);

    expect(suggestion?.work).toMatchObject({ title: 'Maus', series: null, volumeNumber: null });
    expect(suggestion?.edition).toMatchObject({
      publisher: null,
      releaseYear: null,
      language: null,
    });
  });

  it('garde le code de langue inconnu tel quel et décode les entités XML', async () => {
    const suggestion = await lookup([
      ['101', [['a', 'ita']]],
      ['200', [['a', 'Tom &amp; Jerry &#233; &#xE9; &lt;3&gt; &quot;ok&quot;']]],
    ]);

    expect(suggestion?.edition.language).toBe('ita');
    expect(suggestion?.work.title).toBe('Tom & Jerry é é <3> "ok"');
  });

  it('ne prend pas pour une notice une balise dont le nom commence par mxc:record', async () => {
    const xml = sru([['200', [['a', 'Tintin au Tibet']]]]).replace(
      '<srw:records>',
      '<srw:records><mxc:recordPosition>1</mxc:recordPosition>',
    );
    const { fetchFn } = fakeFetch(xml);

    const suggestion = await createBnfProvider(fetchFn).lookup('9782203001190');

    expect(suggestion?.work.title).toBe('Tintin au Tibet');
  });

  it('renvoie null sans notice, ou sans titre', async () => {
    expect(await lookup(null)).toBeNull();
    expect(await lookup([['210', [['c', 'Dargaud']]]])).toBeNull();
    expect(
      await createBnfProvider(fakeFetch('<html>pas du SRU</html>').fetchFn).lookup('9782203001190'),
    ).toBeNull();
  });

  it('propage une erreur HTTP', async () => {
    await expect(
      createBnfProvider(fakeFetch('', 503).fetchFn).lookup('9782203001190'),
    ).rejects.toThrow('HTTP 503');
  });
});
