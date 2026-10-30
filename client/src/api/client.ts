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
  LoginResponse,
  MediaFormat,
  OpenLoanItem,
  PlatformItem,
  SaleItem,
  SaleListItem,
  SessionResponse,
  SetupStatusResponse,
  TitleSearchResponse,
  TotpSetupResponse,
  TrustedDeviceItem,
  UserItem,
} from '@shelfctrl/types';

import i18n from '@/i18n';

/** Corps d'erreur structuré renvoyé par l'API (cf. server/src/lib/errorCodes.ts). */
export interface ApiErrorField {
  path: string;
  code: string;
  params?: Record<string, string | number>;
  message: string;
}
export interface ApiErrorBody {
  code: string;
  message: string;
  params?: Record<string, string | number>;
  fields?: ApiErrorField[];
}

/** Erreur API : `message` est déjà traduit ; `body` porte la forme structurée (code, fields…). */
export class ApiError extends Error {
  readonly status: number;
  readonly body?: ApiErrorBody;
  constructor(message: string, status: number, body?: ApiErrorBody) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  /** Code d'erreur du serveur, quand il y en a un. */
  get code(): string | null {
    return this.body?.code ?? null;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

/** Traduit un code via le namespace i18n `errors`, avec repli sur le message FR du serveur. */
function translateCode(
  code: string,
  message: string,
  params?: Record<string, string | number>,
): string {
  return i18n.t(`errors:${code}`, { ...params, defaultValue: message });
}

/** Traduit un champ d'erreur de validation. */
export function translateErrorField(field: ApiErrorField): string {
  return translateCode(field.code, field.message, field.params);
}

/** Message d'une erreur : le détail par champ s'il y en a, sinon le code traduit. */
function formatError(body: ApiErrorBody): string {
  if (body.fields && body.fields.length > 0) {
    return body.fields.map(translateErrorField).join(' · ');
  }
  return translateCode(body.code, body.message, body.params);
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

async function readErrorBody(res: Response): Promise<ApiErrorBody | undefined> {
  try {
    const body: unknown = await res.json();
    if (typeof body === 'object' && body !== null && 'error' in body) {
      return isApiErrorBody(body.error) ? body.error : undefined;
    }
  } catch {
    // Corps absent ou qui n'est pas du JSON (proxy en erreur…) : message générique.
  }
  return undefined;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, toRequestInit(method, body));
  } catch {
    throw new ApiError(i18n.t('errors:common.network'), 0);
  }
  if (!res.ok) {
    const error = await readErrorBody(res);
    const message = error ? formatError(error) : i18n.t('errors:common.internal');
    throw new ApiError(message, res.status, error);
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
    login: (payload: LoginPayload) => request<LoginResponse>('POST', '/api/auth/login', payload),
    verifyTotp: (code: string, remember: boolean) =>
      request<SessionResponse>('POST', '/api/auth/2fa/verify', { code, remember }),
    setupTotp: () => request<TotpSetupResponse>('POST', '/api/auth/2fa/setup'),
    enableTotp: (code: string) => request<undefined>('POST', '/api/auth/2fa/enable', { code }),
    disableTotp: (password: string) =>
      request<undefined>('POST', '/api/auth/2fa/disable', { password }),
    devices: () => request<{ items: TrustedDeviceItem[] }>('GET', '/api/auth/devices'),
    forgetDevice: (id: number) => request<undefined>('DELETE', `/api/auth/devices/${id}`),
    forgetAllDevices: () => request<undefined>('DELETE', '/api/auth/devices'),
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
    disableTotp: (id: number) => request<undefined>('DELETE', `/api/users/${id}/2fa`),
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
