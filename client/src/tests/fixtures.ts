import type { BarcodeLookupResponse, CopyItem } from '@shelfctrl/types';

export const COPY_TINTIN: CopyItem = {
  id: 1,
  status: 'owned',
  condition: 'very_good',
  conditionNote: null,
  location: 'Salon',
  createdAt: '2026-10-14 10:00:00',
  edition: {
    id: 1,
    format: 'book',
    barcode: '9782203001190',
    publisher: 'Casterman',
    releaseYear: null,
    language: null,
    coverPath: null,
  },
  work: {
    id: 1,
    title: 'Tintin au Tibet',
    series: 'Tintin',
    volumeNumber: 20,
    creators: 'Hergé',
    year: null,
  },
};

export const COPY_ALIEN: CopyItem = {
  id: 2,
  status: 'loaned',
  condition: 'good',
  conditionNote: null,
  location: null,
  createdAt: '2026-10-14 11:00:00',
  edition: {
    id: 2,
    format: 'bluray',
    barcode: null,
    publisher: null,
    releaseYear: null,
    language: null,
    coverPath: null,
  },
  work: { id: 2, title: 'Alien', series: null, volumeNumber: null, creators: null, year: null },
};

export const COPIES = [COPY_TINTIN, COPY_ALIEN];

export const BARCODE_TINTIN: BarcodeLookupResponse = {
  barcode: '9782203001190',
  kind: 'isbn',
  source: 'openlibrary',
  known: false,
  suggestion: {
    work: {
      title: 'Tintin au Tibet',
      series: 'Les Aventures de Tintin',
      volumeNumber: 20,
      creators: 'Hergé',
      year: null,
    },
    edition: { format: 'book', publisher: 'Casterman', releaseYear: 1960, language: null },
  },
};
