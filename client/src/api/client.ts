import type {
  BarcodeLookupResponse,
  CopyCondition,
  CopyItem,
  CopyListResponse,
  CopyStatus,
  MediaFormat,
} from '@shelfctrl/types';

import i18n from '@/i18n';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function errorMessage(status: number): string {
  if (status === 400) {
    return i18n.t('errors.validation');
  }
  return i18n.t('errors.generic');
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(i18n.t('errors.network'), 0);
  }
  if (!res.ok) {
    throw new ApiError(errorMessage(res.status), res.status);
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

export const api = {
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
