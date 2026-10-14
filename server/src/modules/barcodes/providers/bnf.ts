import type { BarcodeSuggestion } from '@shelfctrl/types';

import { isbn13ToIsbn10 } from '../barcode.js';
import { type BarcodeProvider, extractYear, type FetchFn, fetchText } from './types.js';
import { parseUnimarc, type Subfield, subfield, type UnimarcFields } from './unimarc.js';

const SRU_URL = 'https://catalogue.bnf.fr/api/SRU';
const ILLUSTRATOR_ROLE = '440';

const LANGUAGES: Record<string, string> = { fre: 'fr', eng: 'en', jpn: 'ja', ger: 'de', spa: 'es' };

function parseNumber(value: string | undefined): number | null {
  const match = value ? /\d+/.exec(value) : null;
  return match ? Number(match[0]) : null;
}

/**
 * Série et tome : la zone 225 (collection) qui porte un numéro, sinon la zone 461 (ensemble).
 * Une collection d'éditeur sans numéro (« Shonen manga ») n'est pas une série.
 */
function findSeries(fields: UnimarcFields): { series: string | null; volume: number | null } {
  const numbered = fields.get('225')?.find((field) => subfield(field, 'v'));
  if (numbered) {
    return {
      series: subfield(numbered, 'a') ?? null,
      volume: parseNumber(subfield(numbered, 'v')),
    };
  }
  const parent = fields.get('461')?.find((field) => subfield(field, 't'));
  if (parent) {
    return { series: subfield(parent, 't') ?? null, volume: parseNumber(subfield(parent, 'v')) };
  }
  return { series: null, volume: null };
}

function personName(field: Subfield[]): string {
  return [subfield(field, 'b'), subfield(field, 'a')].filter(Boolean).join(' ');
}

/** Auteurs principaux (700, 701) et illustrateurs (702 de rôle 440) ; les traducteurs sont exclus. */
function findCreators(fields: UnimarcFields): string | null {
  const people = [
    ...(fields.get('700') ?? []),
    ...(fields.get('701') ?? []),
    ...(fields.get('702') ?? []).filter((field) => subfield(field, '4') === ILLUSTRATOR_ROLE),
  ]
    .map(personName)
    .filter(Boolean);
  return [...new Set(people)].join(', ') || null;
}

function toSuggestion(fields: UnimarcFields): BarcodeSuggestion | null {
  const titleField = fields.get('200')?.[0];
  const main = subfield(titleField, 'a');
  if (!main) {
    return null;
  }
  // Zones $h/$i : titre propre du tome quand le titre de la série est en $a.
  const part = subfield(titleField, 'i');
  const subtitle = subfield(titleField, 'e');
  let title = main;
  if (part) {
    title = part;
  } else if (subtitle) {
    title = `${main} : ${subtitle}`;
  }

  const found = findSeries(fields);
  const publication = fields.get('210')?.[0];
  const language = subfield(fields.get('101')?.[0], 'a');

  return {
    work: {
      title,
      series: found.series ?? (part ? main : null),
      volumeNumber: found.volume ?? (part ? parseNumber(subfield(titleField, 'h')) : null),
      creators: findCreators(fields),
      year: null,
    },
    edition: {
      format: 'book',
      publisher: subfield(publication, 'c') ?? null,
      releaseYear: extractYear(subfield(publication, 'd')),
      language: language ? (LANGUAGES[language] ?? language) : null,
    },
  };
}

/**
 * Catalogue de la BnF (SRU, gratuit et sans clé) : très complet pour les livres français, avec
 * série et numéro de tome. Les anciennes notices n'ont que l'ISBN-10 : on cherche les deux formes.
 */
export function createBnfProvider(fetchFn: FetchFn = fetch): BarcodeProvider {
  return {
    source: 'bnf',
    kinds: ['isbn'],
    async lookup(code) {
      const query = [code, isbn13ToIsbn10(code)]
        .filter((isbn) => isbn !== null)
        .map((isbn) => `bib.isbn adj "${isbn}"`)
        .join(' or ');
      const params = new URLSearchParams({
        version: '1.2',
        operation: 'searchRetrieve',
        maximumRecords: '1',
        recordSchema: 'unimarcxchange',
        query,
      });
      const fields = parseUnimarc(await fetchText(fetchFn, `${SRU_URL}?${params}`));
      return fields ? toSuggestion(fields) : null;
    },
  };
}
