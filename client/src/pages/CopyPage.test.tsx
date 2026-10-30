import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { apiError } from '@/tests/msw/apiError';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { CopyPage } from './CopyPage';

function renderPage(id: string | number = 1) {
  return renderWithProviders(
    <Routes>
      <Route path="/copies/:id" element={<CopyPage />} />
      <Route path="/" element={<p>Accueil</p>} />
    </Routes>,
    `/copies/${id}`,
  );
}

describe('CopyPage — consultation', () => {
  it('affiche la fiche complète de l’exemplaire', async () => {
    renderPage();

    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Tintin au Tibet' })).toBeInTheDocument();
    expect(screen.getByText('Tintin · Tome 20')).toBeInTheDocument();
    expect(screen.getByText('En rayon')).toBeInTheDocument();
    expect(screen.getByText('Livre / BD')).toBeInTheDocument();
    expect(screen.getByText('9782203001190')).toBeInTheDocument();
    expect(screen.getByText('Casterman')).toBeInTheDocument();
    expect(screen.getByText('Hergé')).toBeInTheDocument();
    expect(screen.getByText('Très bon état')).toBeInTheDocument();
    expect(screen.getByText('Salon')).toBeInTheDocument();
    expect(screen.getByText('14/10/2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retour à la collection' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('affiche les sections prêts et vente en consultation, pas pendant une modification', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Prêts' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Vente' })).toBeInTheDocument();
    expect(await screen.findByText('Jamais prêté.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(screen.queryByRole('heading', { name: 'Prêts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Vente' })).not.toBeInTheDocument();
  });

  it('remplace les champs vides par un tiret et masque la série absente', async () => {
    renderPage(2);

    expect(await screen.findByRole('heading', { name: 'Alien' })).toBeInTheDocument();
    expect(screen.getByText('Prêté')).toBeInTheDocument();
    expect(screen.queryByText(/Tome/)).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(5);
  });

  it.each([
    ['inconnu', 99],
    ['invalide', 'abc'],
  ])('indique qu’un exemplaire %s est introuvable', async (_label, id) => {
    server.use(http.get('/api/copies/:id', () => apiError('copy.not_found', 404)));
    renderPage(id);

    expect(await screen.findByRole('alert')).toHaveTextContent('Exemplaire introuvable.');
    expect(screen.getByRole('link', { name: 'Retour à la collection' })).toBeInTheDocument();
  });

  it('affiche le message générique pour une autre erreur', async () => {
    server.use(http.get('/api/copies/:id', () => HttpResponse.json({}, { status: 500 })));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Une erreur est survenue.');
  });
});

describe('CopyPage — modification', () => {
  async function openEditor() {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Modifier' }));
    return user;
  }

  it('préremplit le formulaire avec les valeurs actuelles', async () => {
    await openEditor();

    expect(screen.getByLabelText('État')).toHaveValue('very_good');
    expect(screen.getByLabelText("Note sur l'état")).toHaveValue('');
    expect(screen.getByLabelText('Emplacement')).toHaveValue('Salon');
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
  });

  it('envoie les changements, y compris l’effacement d’un champ, puis referme le formulaire', async () => {
    let received: unknown;
    server.use(
      http.patch('/api/copies/:id', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({});
      }),
    );
    const user = await openEditor();

    await user.selectOptions(screen.getByLabelText('État'), 'poor');
    await user.type(screen.getByLabelText("Note sur l'état"), '  Dos abîmé ');
    await user.clear(screen.getByLabelText('Emplacement'));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('button', { name: 'Modifier' })).toBeInTheDocument();
    expect(received).toEqual({ condition: 'poor', conditionNote: 'Dos abîmé', location: null });
  });

  it('annule sans rien envoyer', async () => {
    let called = false;
    server.use(
      http.patch('/api/copies/:id', () => {
        called = true;
        return HttpResponse.json({});
      }),
    );
    const user = await openEditor();

    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('affiche l’erreur et garde le formulaire ouvert', async () => {
    server.use(http.patch('/api/copies/:id', () => HttpResponse.json({}, { status: 500 })));
    const user = await openEditor();

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Une erreur est survenue.');
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
  });
});

describe('CopyPage — suppression', () => {
  async function askDeletion() {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Supprimer' }));
    return user;
  }

  it('demande confirmation en prévenant que l’historique est supprimé', async () => {
    await askDeletion();

    const dialog = screen.getByRole('alertdialog', { name: 'Supprimer cet exemplaire ?' });
    expect(dialog).toHaveTextContent('Son historique de prêts et de ventes sera supprimé aussi.');
  });

  it('supprime l’exemplaire après confirmation puis revient à la collection', async () => {
    let deleted = '';
    server.use(
      http.delete('/api/copies/:id', ({ params }) => {
        deleted = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = await askDeletion();

    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }));

    expect(await screen.findByText('Accueil')).toBeInTheDocument();
    expect(deleted).toBe('1');
  });

  it('annule sans rien supprimer', async () => {
    let called = false;
    server.use(
      http.delete('/api/copies/:id', () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = await askDeletion();

    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('affiche l’erreur et reste sur la fiche si la suppression échoue', async () => {
    server.use(http.delete('/api/copies/:id', () => HttpResponse.json({}, { status: 500 })));
    const user = await askDeletion();

    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Une erreur est survenue.');
    expect(screen.queryByText('Accueil')).not.toBeInTheDocument();
  });
});
