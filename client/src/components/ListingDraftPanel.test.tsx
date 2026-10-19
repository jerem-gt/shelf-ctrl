import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { SALE_LISTED } from '@/tests/fixtures';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { ListingDraftPanel } from './ListingDraftPanel';

const DRAFT = {
  title: 'Tintin au Tibet',
  description: 'BD en bon état.',
  suggestedPriceCents: 850,
};

function stubDraft(captured: { body?: unknown } = {}) {
  server.use(
    http.post('/api/copies/:id/listing-draft', async ({ request }) => {
      captured.body = await request.json();
      return HttpResponse.json(DRAFT);
    }),
  );
  return captured;
}

describe('ListingDraftPanel', () => {
  it('génère un brouillon pour la plateforme de l’annonce', async () => {
    const captured = stubDraft();
    const user = userEvent.setup();
    renderWithProviders(<ListingDraftPanel copyId={1} sale={SALE_LISTED} />);

    await user.click(screen.getByRole('button', { name: 'Générer une annonce' }));

    expect(await screen.findByLabelText('Titre')).toHaveValue('Tintin au Tibet');
    expect(screen.getByLabelText('Description')).toHaveValue('BD en bon état.');
    expect(screen.getByText(/Prix suggéré : 8,50/)).toBeInTheDocument();
    expect(captured.body).toEqual({ platform: SALE_LISTED.platform ?? undefined });
  });

  it('applique le prix suggéré à l’annonce', async () => {
    stubDraft();
    let patched: unknown;
    server.use(
      http.patch('/api/copies/:id/sale', async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json(SALE_LISTED);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ListingDraftPanel copyId={1} sale={SALE_LISTED} />);

    await user.click(screen.getByRole('button', { name: 'Générer une annonce' }));
    await user.click(await screen.findByRole('button', { name: 'Utiliser ce prix' }));

    await waitFor(() => expect(patched).toEqual({ priceCents: 850 }));
  });

  it('ne propose pas d’appliquer le prix sans annonce', async () => {
    stubDraft();
    const user = userEvent.setup();
    renderWithProviders(<ListingDraftPanel copyId={1} sale={null} />);

    await user.click(screen.getByRole('button', { name: 'Générer une annonce' }));

    expect(await screen.findByLabelText('Titre')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Utiliser ce prix' })).not.toBeInTheDocument();
  });

  it('signale un serveur sans fournisseur LLM', async () => {
    server.use(
      http.post('/api/copies/:id/listing-draft', () =>
        HttpResponse.json({ error: 'llm_not_configured' }, { status: 503 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ListingDraftPanel copyId={1} sale={null} />);

    await user.click(screen.getByRole('button', { name: 'Générer une annonce' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('pas configurée');
  });
});
