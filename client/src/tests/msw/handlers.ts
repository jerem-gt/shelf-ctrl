import type { CopyItem } from '@shelfctrl/types';
import { http, HttpResponse } from 'msw';

import { BORROWERS, COPIES, COPY_TINTIN, LOAN_OPEN } from '../fixtures';

export const handlers = [
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
  http.get('/api/loans', () => HttpResponse.json([])),
  http.post('/api/loans/:id/return', ({ params }) =>
    HttpResponse.json({ ...LOAN_OPEN, id: Number(params.id), returnedAt: '2026-10-14' }),
  ),
  http.get('/api/borrowers', () => HttpResponse.json(BORROWERS)),
];
