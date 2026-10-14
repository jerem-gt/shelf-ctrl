import type { CopyItem } from '@shelfctrl/types';
import { http, HttpResponse } from 'msw';

import { COPIES, COPY_TINTIN } from '../fixtures';

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
];
