import type {
  BarcodeLookupResponse,
  BorrowerItem,
  CopyCondition,
  CopyItem,
  CopyListResponse,
  CopyStatus,
  ImportJob,
  ImportPreview,
  LoanItem,
  MediaFormat,
  OpenLoanItem,
  PlatformItem,
  SaleItem,
  SaleListItem,
  SessionResponse,
  SetupStatusResponse,
  TitleSearchResponse,
  UserItem,
} from '@shelfctrl/types';

import i18n from '@/i18n';

export class ApiError extends Error {
  readonly status: number;
  /** Code d'erreur du serveur (`error` du corps JSON), quand il y en a un. */
  readonly code: string | null;
  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const ERROR_KEYS: Record<number, string> = {
  400: 'errors.validation',
  401: 'errors.unauthorized',
  409: 'errors.conflict',
  413: 'errors.imageTooLarge',
  415: 'errors.invalidImage',
  429: 'errors.tooManyAttempts',
};

/** Message propre au code d'erreur du serveur s'il est traduit, sinon celui du statut HTTP. */
function errorMessage(status: number, code: string | null): string {
  const codeKey = `errors.codes.${code}`;
  if (code !== null && i18n.exists(codeKey)) {
    return i18n.t(codeKey);
  }
  return i18n.t(ERROR_KEYS[status] ?? 'errors.generic');
}

/** Un fichier part tel quel avec son type MIME ; tout le reste est envoyé en JSON. */
function toRequestInit(method: string, body: unknown): RequestInit {
  if (body === undefined) {
    return { method };
  }
  if (body instanceof Blob) {
    return { method, headers: { 'Content-Type': body.type || 'application/octet-stream' }, body };
  }
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

// Type non « simple » au sens CORS : un formulaire d'un autre site ne peut pas l'envoyer (anti-CSRF).
function asOctetStream(file: Blob): Blob {
  return file.slice(0, file.size, 'application/octet-stream');
}

async function readErrorCode(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json();
    if (typeof body === 'object' && body !== null && 'error' in body) {
      return typeof body.error === 'string' ? body.error : null;
    }
  } catch {
    // Corps absent ou qui n'est pas du JSON : le statut suffit.
  }
  return null;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, toRequestInit(method, body));
  } catch {
    throw new ApiError(i18n.t('errors.network'), 0);
  }
  if (!res.ok) {
    const code = await readErrorCode(res);
    throw new ApiError(errorMessage(res.status, code), res.status, code);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export interface CopyFilters {
  q?: string;
  format?: MediaFormat;
  status?: CopyStatus;
}

export interface CreateCopyPayload {
  work: {
    title: string;
    series?: string;
    volumeNumber?: number;
    creators?: string;
  };
  edition: {
    format: MediaFormat;
    barcode?: string;
    publisher?: string;
  };
  condition: CopyCondition;
  conditionNote?: string;
  location?: string;
}

/** Champs modifiables d'un exemplaire ; `null` efface une note ou un emplacement. */
export interface UpdateCopyPayload {
  condition?: CopyCondition;
  conditionNote?: string | null;
  location?: string | null;
}

function toQueryString(filters: CopyFilters): string {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set('q', filters.q);
  }
  if (filters.format) {
    params.set('format', filters.format);
  }
  if (filters.status) {
    params.set('status', filters.status);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export interface LendPayload {
  borrowerName: string;
  /** AAAA-MM-JJ ; par défaut aujourd'hui côté serveur. */
  loanedAt?: string;
}

/** Plateforme et prix (en centimes) d'une annonce ou d'une vente ; `null` efface une valeur. */
export interface SalePayload {
  platform?: string | null;
  priceCents?: number | null;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface SetupPayload extends LoginPayload {
  token: string;
}

/** Nom et e-mail du compte connecté ; `email: null` l'efface. */
export interface ProfilePayload {
  currentPassword: string;
  username?: string;
  email?: string | null;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  email?: string | null;
  isAdmin?: boolean;
}

export interface UpdateUserPayload {
  username?: string;
  password?: string;
  email?: string | null;
  isAdmin?: boolean;
}

export const api = {
  platforms: {
    list: () => request<{ items: PlatformItem[] }>('GET', '/api/platforms'),
    add: (payload: { name: string; publishUrl?: string }) =>
      request<PlatformItem>('POST', '/api/platforms', payload),
    setUrl: (id: number, publishUrl: string | null) =>
      request<PlatformItem>('PATCH', `/api/platforms/${id}`, { publishUrl }),
    remove: (id: number) => request<undefined>('DELETE', `/api/platforms/${id}`),
    setDefault: (id: number | null) => request<undefined>('PUT', '/api/platforms/default', { id }),
  },
  import: {
    templateUrl: '/api/import/template',
    preview: (file: Blob) =>
      request<ImportPreview>('POST', '/api/import/preview', asOctetStream(file)),
    start: (file: Blob) => request<ImportJob>('POST', '/api/import', asOctetStream(file)),
    job: (id: string) => request<ImportJob>('GET', `/api/import/${encodeURIComponent(id)}`),
  },
  images: {
    uploadCover: (editionId: number, file: Blob) =>
      request<{ coverPath: string }>('PUT', `/api/editions/${editionId}/cover`, file),
    removeCover: (editionId: number) =>
      request<undefined>('DELETE', `/api/editions/${editionId}/cover`),
    fetchCover: (editionId: number) =>
      request<{ fetched: true }>('POST', `/api/editions/${editionId}/cover/fetch`),
    uploadPhoto: (copyId: number, file: Blob) =>
      request<{ photoPath: string }>('PUT', `/api/copies/${copyId}/photo`, file),
    removePhoto: (copyId: number) => request<undefined>('DELETE', `/api/copies/${copyId}/photo`),
  },
  auth: {
    me: () => request<SessionResponse>('GET', '/api/auth/me'),
    login: (payload: LoginPayload) => request<SessionResponse>('POST', '/api/auth/login', payload),
    logout: () => request<undefined>('POST', '/api/auth/logout'),
    setupStatus: () => request<SetupStatusResponse>('GET', '/api/auth/setup'),
    setup: (payload: SetupPayload) => request<SessionResponse>('POST', '/api/auth/setup', payload),
    updateProfile: (payload: ProfilePayload) =>
      request<SessionResponse>('PATCH', '/api/auth/profile', payload),
    changePassword: (current: string, next: string) =>
      request<undefined>('POST', '/api/auth/change-password', { current, next }),
    forgotPassword: (identifier: string) =>
      request<undefined>('POST', '/api/auth/password/forgot', { identifier }),
    resetPassword: (token: string, password: string) =>
      request<undefined>('POST', '/api/auth/password/reset', { token, password }),
    testEmail: () => request<undefined>('POST', '/api/auth/test-email'),
  },
  users: {
    list: () => request<{ items: UserItem[] }>('GET', '/api/users'),
    create: (payload: CreateUserPayload) => request<UserItem>('POST', '/api/users', payload),
    update: (id: number, payload: UpdateUserPayload) =>
      request<UserItem>('PATCH', `/api/users/${id}`, payload),
    remove: (id: number) => request<undefined>('DELETE', `/api/users/${id}`),
  },
  sales: {
    all: () => request<SaleListItem[]>('GET', '/api/sales'),
    forCopy: (copyId: number) => request<SaleItem | null>('GET', `/api/copies/${copyId}/sale`),
    listForSale: (copyId: number, payload: SalePayload & { listedAt?: string }) =>
      request<SaleItem>('POST', `/api/copies/${copyId}/sale`, payload),
    sell: (copyId: number, payload: SalePayload & { soldAt?: string }) =>
      request<SaleItem>('POST', `/api/copies/${copyId}/sale/sold`, payload),
    update: (copyId: number, payload: SalePayload) =>
      request<SaleItem>('PATCH', `/api/copies/${copyId}/sale`, payload),
    remove: (copyId: number) => request<undefined>('DELETE', `/api/copies/${copyId}/sale`),
  },
  borrowers: {
    list: () => request<BorrowerItem[]>('GET', '/api/borrowers'),
  },
  loans: {
    open: () => request<OpenLoanItem[]>('GET', '/api/loans'),
    forCopy: (copyId: number) => request<LoanItem[]>('GET', `/api/copies/${copyId}/loans`),
    lend: (copyId: number, payload: LendPayload) =>
      request<LoanItem>('POST', `/api/copies/${copyId}/loans`, payload),
    giveBack: (loanId: number, returnedAt?: string) =>
      request<LoanItem>('POST', `/api/loans/${loanId}/return`, { returnedAt }),
  },
  titles: {
    search: (query: string) =>
      request<TitleSearchResponse>('GET', `/api/titles/search?q=${encodeURIComponent(query)}`),
  },
  barcodes: {
    lookup: (code: string) =>
      request<BarcodeLookupResponse>('GET', `/api/barcodes/${encodeURIComponent(code)}`),
  },
  copies: {
    list: (filters: CopyFilters = {}) =>
      request<CopyListResponse>('GET', `/api/copies${toQueryString(filters)}`),
    get: (id: number) => request<CopyItem>('GET', `/api/copies/${id}`),
    create: (payload: CreateCopyPayload) => request<CopyItem>('POST', '/api/copies', payload),
    update: (id: number, payload: UpdateCopyPayload) =>
      request<CopyItem>('PATCH', `/api/copies/${id}`, payload),
    remove: (id: number) => request<undefined>('DELETE', `/api/copies/${id}`),
  },
};
