// Types de réponse de l'auth : module commun de ctrl-shared (fichier de types seul, sans dépendance).
import type { UserItem as AuthUserItem } from '@jerem-gt/ctrl-shared/server/auth/types';

/** Support physique d'une édition. */
export const MEDIA_FORMATS = ['book', 'dvd', 'bluray', 'uhd4k', 'game'] as const;
export type MediaFormat = (typeof MEDIA_FORMATS)[number];

/** Type de média choisi en premier à l'ajout : il borne les formats et les sources de recherche. */
export const MEDIA_KINDS = ['book', 'movie', 'game'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** Formats de chaque type, le premier étant celui par défaut. */
export const FORMATS_BY_KIND: Record<MediaKind, readonly [MediaFormat, ...MediaFormat[]]> = {
  book: ['book'],
  movie: ['dvd', 'bluray', 'uhd4k'],
  game: ['game'],
};

/** Type d'un format (`bluray` → `movie`). */
export function kindOfFormat(format: MediaFormat): MediaKind {
  return MEDIA_KINDS.find((kind) => FORMATS_BY_KIND[kind].includes(format)) ?? 'book';
}

/**
 * Le format d'un jeu vidéo : le seul qui a une console, et dont les auteurs sont un studio. Seule
 * écriture de cette valeur pour cette règle, SQL compris (passé en paramètre aux requêtes).
 */
export const GAME_FORMAT = 'game' satisfies MediaFormat;

/** Un jeu vidéo ? (format vide ou inconnu d'un filtre ou d'une fiche : faux). */
export function isGameFormat(format: MediaFormat | '' | null | undefined): boolean {
  return format === GAME_FORMAT;
}

/** Console à garder pour ce format : la valeur pour un jeu vidéo, `null` pour tout autre format. */
export function consoleOf(
  format: MediaFormat | null | undefined,
  value: string | null | undefined,
): string | null {
  return isGameFormat(format) && value ? value : null;
}

/**
 * Consoles proposées pour un jeu vidéo (`format` = `game`), des plus récentes aux plus anciennes
 * par constructeur. La console d'une édition reste un texte libre : cette liste n'est qu'une aide.
 */
export const GAME_CONSOLES = [
  'PlayStation 5',
  'PlayStation 4',
  'PlayStation 3',
  'PlayStation 2',
  'PlayStation',
  'PS Vita',
  'PSP',
  'Nintendo Switch 2',
  'Nintendo Switch',
  'Wii U',
  'Wii',
  'GameCube',
  'Nintendo 64',
  'Super Nintendo',
  'NES',
  'Nintendo 3DS',
  'Nintendo DS',
  'Game Boy Advance',
  'Game Boy Color',
  'Game Boy',
  'Xbox Series X|S',
  'Xbox One',
  'Xbox 360',
  'Xbox',
  'PC',
  'Dreamcast',
  'Saturn',
  'Mega Drive',
  'Master System',
] as const;
export type GameConsole = (typeof GAME_CONSOLES)[number];

/** Longueur maximale du nom d'une console. */
export const CONSOLE_MAX_LENGTH = 50;

/** État d'un exemplaire, du meilleur au pire (aligné sur les échelles Vinted / eBay). */
export const COPY_CONDITIONS = ['new', 'very_good', 'good', 'acceptable', 'poor'] as const;
export type CopyCondition = (typeof COPY_CONDITIONS)[number];

/** Statut dérivé des mouvements (prêts, ventes) : jamais stocké. */
export const COPY_STATUSES = ['owned', 'loaned', 'listed', 'sold'] as const;
export type CopyStatus = (typeof COPY_STATUSES)[number];

export interface WorkSummary {
  id: number;
  title: string;
  series: string | null;
  volumeNumber: number | null;
  creators: string | null;
  year: number | null;
}

export interface EditionSummary {
  id: number;
  format: MediaFormat;
  barcode: string | null;
  publisher: string | null;
  releaseYear: number | null;
  language: string | null;
  /** Console d'un jeu vidéo (texte libre, cf. `GAME_CONSOLES`) ; `null` pour les autres formats. */
  console: string | null;
  /** Nom du fichier de la pochette (servi par `/covers/<nom>`). */
  coverPath: string | null;
}

/** Un exemplaire physique avec son édition et son œuvre. */
export interface CopyItem {
  id: number;
  status: CopyStatus;
  condition: CopyCondition;
  conditionNote: string | null;
  location: string | null;
  /** Nom du fichier de la photo de l'exemplaire (servi par `/photos/<nom>`). */
  photoPath: string | null;
  createdAt: string;
  edition: EditionSummary;
  work: WorkSummary;
}

/** Consoles des jeux de la collection (filtre de la collection). */
export interface ConsoleListResponse {
  consoles: string[];
}

export interface CopyListResponse {
  items: CopyItem[];
  total: number;
}

/** Un prêt d'exemplaire ; `returnedAt` vaut `null` tant qu'il est en cours. Dates au format AAAA-MM-JJ. */
export interface LoanItem {
  id: number;
  copyId: number;
  borrowerId: number;
  borrowerName: string;
  loanedAt: string;
  returnedAt: string | null;
}

/** Prêt en cours avec de quoi identifier l'exemplaire dans une liste. */
export interface OpenLoanItem extends LoanItem {
  work: Pick<WorkSummary, 'title' | 'series' | 'volumeNumber'>;
  format: MediaFormat;
}

export interface BorrowerItem {
  id: number;
  name: string;
  openLoans: number;
}

/**
 * Mise en vente ou vente d'un exemplaire (au plus une par exemplaire). Sans `soldAt` : en vente ;
 * avec : vendu. `listedAt` est `null` pour une vente directe. Prix en centimes, dates AAAA-MM-JJ.
 */
export interface SaleItem {
  id: number;
  copyId: number;
  platform: string | null;
  priceCents: number | null;
  listedAt: string | null;
  soldAt: string | null;
}

/** Vente avec de quoi identifier l'exemplaire dans une liste. */
export interface SaleListItem extends SaleItem {
  work: Pick<WorkSummary, 'title' | 'series' | 'volumeNumber'>;
  format: MediaFormat;
}

/** `isbn` : livre (préfixe 978/979) ; `ean` : tout autre code (vidéo, jeu vidéo). */
export type BarcodeKind = 'isbn' | 'ean';

export type BarcodeSource =
  'local' | 'bnf' | 'openlibrary' | 'googlebooks' | 'upcitemdb' | 'tmdb' | 'igdb';

/** Fiche proposée pour un code-barres : à relire par l'utilisateur avant enregistrement. */
export interface BarcodeSuggestion {
  work: Omit<WorkSummary, 'id'>;
  edition: {
    format: MediaFormat | null;
    publisher: string | null;
    releaseYear: number | null;
    language: string | null;
    console: string | null;
  };
}

export interface BarcodeLookupResponse {
  /** Code normalisé (ISBN-13, EAN-13…). */
  barcode: string;
  kind: BarcodeKind;
  source: BarcodeSource;
  /** Une édition portant ce code existe déjà dans la collection. */
  known: boolean;
  suggestion: BarcodeSuggestion;
}

/** Une œuvre ou édition trouvée par titre ; `barcode` est `null` quand la source n'en donne pas. */
export interface TitleSearchResult {
  barcode: string | null;
  source: BarcodeSource;
  suggestion: BarcodeSuggestion;
  /**
   * Toutes les consoles d'un jeu vidéo, pour que l'utilisateur voie entre lesquelles choisir ;
   * vide hors jeu. `suggestion.edition.console` n'est rempli que s'il n'y en a qu'une.
   */
  consoles: string[];
}

export interface TitleSearchResponse {
  results: TitleSearchResult[];
  /**
   * Faux quand aucune source n'est configurée pour le type demandé (clé TMDB ou identifiants
   * IGDB absents) : la liste est alors vide quelle que soit la recherche.
   */
  configured: boolean;
}

/** Plateforme de vente du compte (réglages). */
export interface PlatformItem {
  id: number;
  name: string;
  /** Adresse de dépôt d'une plateforme personnalisée ; `null` pour une plateforme connue. */
  publishUrl: string | null;
  /** La plateforme présélectionnée à la mise en vente (au plus une). */
  isDefault: boolean;
}

/** Colonnes reconnues d'un fichier CSV d'import. */
export const IMPORT_FIELDS = [
  'title',
  'series',
  'volume',
  'creators',
  'format',
  'console',
  'barcode',
  'publisher',
  'year',
  'language',
  'condition',
  'note',
  'location',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_ISSUE_CODES = [
  'missing_title',
  'missing_format',
  'invalid_format',
  'invalid_condition',
  'invalid_volume',
  'invalid_year',
  'invalid_barcode',
  'too_long',
  'not_found_online',
  'invalid',
] as const;
export type ImportIssueCode = (typeof IMPORT_ISSUE_CODES)[number];

/** Problème d'une ligne ; `field` désigne la colonne concernée quand il y en a une. */
export interface ImportIssue {
  code: ImportIssueCode;
  field: ImportField | null;
}

/** Une ligne du fichier, numérotée comme dans un tableur (l'en-tête est la ligne 1). */
export interface ImportRowPreview {
  line: number;
  title: string | null;
  barcode: string | null;
  issues: ImportIssue[];
  /** Une édition identique existe déjà, ou apparaît plus haut dans le fichier. */
  duplicate: boolean;
  /** Des champs seront complétés en ligne à partir du code-barres. */
  willComplete: boolean;
}

export interface ImportPreview {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  /** Lignes dont des champs seront cherchés en ligne. */
  toComplete: number;
  /** En-têtes du fichier que l'import ne reconnaît pas (ignorés). */
  ignoredColumns: string[];
  rows: ImportRowPreview[];
}

export interface ImportRowFailure {
  line: number;
  title: string | null;
  issues: ImportIssue[];
}

/** Avancement d'un import en cours ou terminé (suivi par l'interface). */
export interface ImportJob {
  id: string;
  status: 'running' | 'done' | 'failed';
  total: number;
  processed: number;
  created: number;
  /** Exemplaires dont des champs ont été complétés en ligne. */
  completed: number;
  coversFound: number;
  failures: ImportRowFailure[];
}

// Auth et comptes : types du module commun de ctrl-shared (une seule définition des formes de l'API).
export type {
  LoginResponse,
  SessionResponse,
  SetupStatusResponse,
  TotpSetupResponse,
  TrustedDeviceItem,
} from '@jerem-gt/ctrl-shared/server/auth/types';

/** Langues de l'interface (le client a un dossier `locales/<langue>/` par langue). */
export type ShelfLang = 'fr' | 'en';

/** Statistiques d'un compte sur la page Utilisateurs. */
export interface UserStats {
  copyCount: number;
  /** Date d'ajout du dernier exemplaire, `null` sans exemplaire. */
  lastCopyAt: string | null;
}

/** Compte vu par un admin (page Utilisateurs). */
export type UserItem = AuthUserItem<UserStats>;

export interface HealthResponse {
  status: 'ok';
}
