import { http, HttpResponse } from 'msw';

import { COPIES, COPY_TINTIN } from '../fixtures';

export const handlers = [
  http.get('/api/copies', () => HttpResponse.json({ items: COPIES, total: COPIES.length })),
  http.post('/api/copies', () => HttpResponse.json(COPY_TINTIN, { status: 201 })),
];
