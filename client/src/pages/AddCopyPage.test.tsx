import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { COPY_TINTIN } from '@/tests/fixtures';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { AddCopyPage } from './AddCopyPage';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/add" element={<AddCopyPage />} />
      <Route path="/" element={<p>Accueil</p>} />
    </Routes>,
    '/add',
  );
}

describe('AddCopyPage', () => {
  it('envoie les champs renseignés puis revient à la collection', async () => {
    let received: unknown;
    server.use(
      http.post('/api/copies', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(COPY_TINTIN, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Titre'), '  Dune ');
    await user.type(screen.getByLabelText('Série'), 'Dune');
    await user.type(screen.getByLabelText('Numéro de tome'), '1');
    await user.selectOptions(screen.getByLabelText('Format'), 'dvd');
    await user.type(screen.getByLabelText('Code-barres (ISBN / EAN)'), '5051889000001');
    await user.selectOptions(screen.getByLabelText('État'), 'new');
    await user.type(screen.getByLabelText('Emplacement'), 'Chambre');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Accueil')).toBeInTheDocument();
    expect(received).toEqual({
      work: { title: 'Dune', series: 'Dune', volumeNumber: 1 },
      edition: { format: 'dvd', barcode: '5051889000001' },
      condition: 'new',
      location: 'Chambre',
    });
  });

  it('n’envoie pas les champs laissés vides', async () => {
    let received: unknown;
    server.use(
      http.post('/api/copies', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(COPY_TINTIN, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Titre'), 'Alien');
    await user.type(screen.getByLabelText('Série'), '   ');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await screen.findByText('Accueil');
    expect(received).toEqual({
      work: { title: 'Alien' },
      edition: { format: 'book' },
      condition: 'good',
    });
  });

  it('affiche l’erreur du serveur et reste sur le formulaire', async () => {
    server.use(http.post('/api/copies', () => HttpResponse.json({}, { status: 400 })));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Titre'), 'Dune');
    await user.type(screen.getByLabelText('Code-barres (ISBN / EAN)'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Certains champs sont invalides.');
    expect(screen.queryByText('Accueil')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
  });

  it('propose d’annuler', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Annuler' })).toHaveAttribute('href', '/');
  });
});
