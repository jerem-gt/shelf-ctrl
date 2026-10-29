import type { CopyItem } from '@shelfctrl/types';
import { http, HttpResponse } from 'msw';

import {
  BORROWERS,
  COPIES,
  COPY_TINTIN,
  LOAN_OPEN,
  SALE_LISTED,
  SALE_SOLD,
  SESSION_ADMIN,
  USER_ADMIN,
  USER_BOB,
} from '../fixtures';

export const handlers = [
  http.get('/api/auth/me', () => HttpResponse.json(SESSION_ADMIN)),
  http.post('/api/auth/login', () => HttpResponse.json(SESSION_ADMIN)),
  http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/auth/setup', () => HttpResponse.json({ required: false })),
  http.post('/api/auth/setup', () => HttpResponse.json(SESSION_ADMIN)),
  http.patch('/api/auth/profile', async ({ request }) => {
    const { username, email } = (await request.json()) as { username?: string; email?: string };
    return HttpResponse.json({
      ...SESSION_ADMIN,
      ...(username === undefined ? {} : { username }),
      ...(email === undefined ? {} : { email }),
    });
  }),
  http.post('/api/auth/change-password', () => new HttpResponse(null, { status: 204 })),
  http.post('/api/auth/password/forgot', () => new HttpResponse(null, { status: 204 })),
  http.post('/api/auth/password/reset', () => new HttpResponse(null, { status: 204 })),
  http.post('/api/auth/test-email', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/users', () => HttpResponse.json({ items: [USER_ADMIN, USER_BOB] })),
  http.post('/api/users', async ({ request }) => {
    const body = (await request.json()) as { username: string };
    return HttpResponse.json({ ...USER_BOB, id: 3, username: body.username }, { status: 201 });
  }),
  http.patch('/api/users/:id', () => HttpResponse.json(USER_BOB)),
  http.delete('/api/users/:id', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/copies', () => HttpResponse.json({ items: COPIES, total: COPIES.length })),
  http.post('/api/copies', () => HttpResponse.json(COPY_TINTIN, { status: 201 })),
  http.get('/api/copies/:id', ({ params }) => {
    const copy = COPIES.find((candidate) => candidate.id === Number(params.id));
    if (copy) {
      return HttpResponse.json(copy);
    }
    return HttpResponse.json({ error: 'not_found' }, { status: 404 });
  }),
  http.patch('/api/copies/:id', async ({ request }) => {
    const changes = (await request.json()) as Partial<CopyItem>;
    return HttpResponse.json({ ...COPY_TINTIN, ...changes });
  }),
  http.delete('/api/copies/:id', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/copies/:id/loans', () => HttpResponse.json([])),
  http.post('/api/copies/:id/loans', async ({ request, params }) => {
    const body = (await request.json()) as { borrowerName: string; loanedAt?: string };
    return HttpResponse.json(
      {
        ...LOAN_OPEN,
        copyId: Number(params.id),
        borrowerName: body.borrowerName,
        loanedAt: body.loanedAt ?? LOAN_OPEN.loanedAt,
      },
      { status: 201 },
    );
  }),
  http.put('/api/editions/:id/cover', () => HttpResponse.json({ coverPath: '1-aaaaaaaaaa.webp' })),
  http.delete('/api/editions/:id/cover', () => new HttpResponse(null, { status: 204 })),
  http.post('/api/editions/:id/cover/fetch', () => HttpResponse.json({ fetched: true })),
  http.put('/api/copies/:id/photo', () => HttpResponse.json({ photoPath: '1-bbbbbbbbbb.webp' })),
  http.delete('/api/copies/:id/photo', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/platforms', () => HttpResponse.json({ items: [] })),
  http.get('/api/loans', () => HttpResponse.json([])),
  http.post('/api/loans/:id/return', ({ params }) =>
    HttpResponse.json({ ...LOAN_OPEN, id: Number(params.id), returnedAt: '2026-10-14' }),
  ),
  http.get('/api/borrowers', () => HttpResponse.json(BORROWERS)),
  http.get('/api/copies/:id/sale', () => HttpResponse.json(null)),
  http.post('/api/copies/:id/sale', () => HttpResponse.json(SALE_LISTED, { status: 201 })),
  http.post('/api/copies/:id/sale/sold', () => HttpResponse.json(SALE_SOLD)),
  http.patch('/api/copies/:id/sale', () => HttpResponse.json(SALE_LISTED)),
  http.delete('/api/copies/:id/sale', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/sales', () => HttpResponse.json([])),
];
