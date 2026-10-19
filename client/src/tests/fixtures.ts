import type {
  BarcodeLookupResponse,
  BorrowerItem,
  CopyItem,
  LoanItem,
  OpenLoanItem,
  SaleItem,
  SaleListItem,
} from '@shelfctrl/types';

export const COPY_TINTIN: CopyItem = {
  id: 1,
  status: 'owned',
  condition: 'very_good',
  conditionNote: null,
  location: 'Salon',
  photoPath: null,
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
  photoPath: null,
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

export const LOAN_OPEN: LoanItem = {
  id: 1,
  copyId: 2,
  borrowerId: 1,
  borrowerName: 'Alice',
  loanedAt: '2026-10-01',
  returnedAt: null,
};

export const LOAN_DONE: LoanItem = {
  id: 2,
  copyId: 2,
  borrowerId: 2,
  borrowerName: 'Bob',
  loanedAt: '2026-01-05',
  returnedAt: '2026-01-20',
};

export const OPEN_LOAN_ALIEN: OpenLoanItem = {
  ...LOAN_OPEN,
  work: { title: 'Alien', series: null, volumeNumber: null },
  format: 'bluray',
};

export const OPEN_LOAN_TINTIN: OpenLoanItem = {
  id: 3,
  copyId: 1,
  borrowerId: 2,
  borrowerName: 'Bob',
  loanedAt: '2026-09-15',
  returnedAt: null,
  work: { title: 'Tintin au Tibet', series: 'Tintin', volumeNumber: 20 },
  format: 'book',
};

export const BORROWERS: BorrowerItem[] = [
  { id: 1, name: 'Alice', openLoans: 1 },
  { id: 2, name: 'Bob', openLoans: 0 },
];

export const SALE_LISTED: SaleItem = {
  id: 1,
  copyId: 1,
  platform: 'Vinted',
  priceCents: 1250,
  listedAt: '2026-10-01',
  soldAt: null,
};

export const SALE_SOLD: SaleItem = {
  id: 2,
  copyId: 1,
  platform: 'Leboncoin',
  priceCents: 1000,
  listedAt: '2026-09-01',
  soldAt: '2026-09-10',
};

export const SALE_LIST_LISTED: SaleListItem = {
  ...SALE_LISTED,
  work: { title: 'Tintin au Tibet', series: 'Tintin', volumeNumber: 20 },
  format: 'book',
};

export const SALE_LIST_SOLD: SaleListItem = {
  ...SALE_SOLD,
  id: 3,
  copyId: 2,
  work: { title: 'Alien', series: null, volumeNumber: null },
  format: 'bluray',
};
