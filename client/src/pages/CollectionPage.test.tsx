import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { CollectionPage } from './CollectionPage';

function captureSearches() {
  const searches: string[] = [];
  server.use(
    http.get('/api/copies', ({ request }) => {
      searches.push(new URL(request.url).search);
      return HttpResponse.json({ items: [], total: 0 });
    }),
  );
  return searches;
}

describe('CollectionPage', () => {
  it('affiche la liste des exemplaires et leur nombre', async () => {
    renderWithProviders(<CollectionPage />);

    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(await screen.findByText('Tintin au Tibet')).toBeInTheDocument();
    expect(screen.getByText('Alien')).toBeInTheDocument();
    expect(screen.getByText('2 exemplaires')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ajouter/ })).toHaveAttribute('href', '/add');
  });

  it('affiche un message quand la collection est vide', async () => {
    server.use(http.get('/api/copies', () => HttpResponse.json({ items: [], total: 0 })));
    renderWithProviders(<CollectionPage />);

    expect(await screen.findByText("Aucun exemplaire pour l'instant.")).toBeInTheDocument();
  });

  it('interroge l’API avec la recherche saisie', async () => {
    const searches = captureSearches();
    const user = userEvent.setup();
    renderWithProviders(<CollectionPage />);

    await user.type(screen.getByRole('searchbox', { name: 'Rechercher' }), 'herg');

    await waitFor(() => expect(searches).toContain('?q=herg'));
    expect(await screen.findByText('Aucun résultat pour ces critères.')).toBeInTheDocument();
  });

  it('interroge l’API avec les filtres de format et de statut', async () => {
    const searches = captureSearches();
    const user = userEvent.setup();
    renderWithProviders(<CollectionPage />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Format' }), 'bluray');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Statut' }), 'loaned');
    await waitFor(() => expect(searches).toContain('?format=bluray&status=loaned'));
    expect(await screen.findByText('Aucun résultat pour ces critères.')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Format' }), '');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Statut' }), '');
    expect(await screen.findByText("Aucun exemplaire pour l'instant.")).toBeInTheDocument();
  });

  it('affiche l’erreur et permet de réessayer', async () => {
    let calls = 0;
    server.use(
      http.get('/api/copies', () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({}, { status: 500 });
        }
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CollectionPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Une erreur est survenue.');

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText("Aucun exemplaire pour l'instant.")).toBeInTheDocument();
  });
});
