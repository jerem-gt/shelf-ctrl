import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { SALE_LIST_LISTED, SALE_LIST_SOLD } from '@/tests/fixtures';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { SalesPage } from './SalesPage';

const stubSales = (sales: object[]) =>
  server.use(http.get('/api/sales', () => HttpResponse.json(sales)));

describe('SalesPage', () => {
  it('liste les exemplaires en vente par défaut', async () => {
    stubSales([SALE_LIST_LISTED, SALE_LIST_SOLD]);
    renderWithProviders(<SalesPage />);

    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    const item = await screen.findByRole('listitem');

    expect(within(item).getByRole('link', { name: 'Tintin au Tibet' })).toHaveAttribute(
      'href',
      '/copies/1',
    );
    expect(item).toHaveTextContent('Tintin · Tome 20');
    expect(item).toHaveTextContent(/Vinted · 12,50\s€ · en vente depuis le 01\/10\/2026/);
    expect(screen.getByRole('tab', { name: 'En vente' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText(/Total des ventes/)).not.toBeInTheDocument();
  });

  it('liste les ventes avec leur total dans l’onglet « Vendus »', async () => {
    stubSales([
      SALE_LIST_LISTED,
      SALE_LIST_SOLD,
      { ...SALE_LIST_SOLD, id: 4, copyId: 5, priceCents: 550, platform: null },
      { ...SALE_LIST_SOLD, id: 5, copyId: 6, priceCents: null },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<SalesPage />);

    await user.click(await screen.findByRole('tab', { name: 'Vendus' }));

    expect(screen.getByRole('tab', { name: 'Vendus' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(/^Total des ventes : 15,50\s€$/)).toBeInTheDocument();
    expect(screen.getAllByText(/vendu le 10\/09\/2026/)).toHaveLength(3);
    expect(screen.getByText(/Leboncoin · 10,00\s€ · vendu le 10\/09\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/^Leboncoin · prix non renseigné · vendu le/)).toBeInTheDocument();
    expect(screen.getByText(/^5,50\s€ · vendu le/)).toBeInTheDocument();
    expect(screen.queryByText('Tintin au Tibet')).not.toBeInTheDocument();
  });

  it('affiche un message par onglet quand il est vide', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SalesPage />);

    expect(await screen.findByText('Aucun exemplaire en vente.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Vendus' }));
    expect(screen.getByText('Aucune vente enregistrée.')).toBeInTheDocument();
  });

  it('affiche l’erreur de chargement', async () => {
    server.use(http.get('/api/sales', () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<SalesPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Une erreur est survenue.');
  });

  it('affiche une vente directe sans date d’annonce ni de vente connue', async () => {
    stubSales([{ ...SALE_LIST_LISTED, listedAt: null, platform: null, priceCents: null }]);
    renderWithProviders(<SalesPage />);

    expect(await screen.findByText('prix non renseigné')).toBeInTheDocument();
  });
});
