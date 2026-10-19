import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { mockCamera, restoreCamera } from '@/tests/cameraMocks';
import { BARCODE_TINTIN, COPY_TINTIN } from '@/tests/fixtures';
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

describe('AddCopyPage — recherche par code-barres', () => {
  const stubLookup = (status: number, body: JsonBodyType) =>
    server.use(http.get('/api/barcodes/:code', () => HttpResponse.json(body, { status })));

  async function searchFor(code: string) {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Code-barres (ISBN / EAN)'), code);
    await user.click(screen.getByRole('button', { name: 'Rechercher la fiche' }));
    return user;
  }

  it('désactive la recherche tant qu’aucun code n’est saisi', async () => {
    const user = userEvent.setup();
    renderPage();
    const button = screen.getByRole('button', { name: 'Rechercher la fiche' });

    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText('Code-barres (ISBN / EAN)'), '9');
    expect(button).toBeEnabled();
  });

  it('remplit le formulaire avec la fiche trouvée', async () => {
    stubLookup(200, BARCODE_TINTIN);
    await searchFor('2203001194');

    expect(await screen.findByRole('status')).toHaveTextContent(
      "Fiche trouvée via Open Library : vérifie les informations avant d'enregistrer.",
    );
    expect(screen.getByLabelText('Titre')).toHaveValue('Tintin au Tibet');
    expect(screen.getByLabelText('Série')).toHaveValue('Les Aventures de Tintin');
    expect(screen.getByLabelText('Numéro de tome')).toHaveValue(20);
    expect(screen.getByLabelText('Auteurs / réalisateurs')).toHaveValue('Hergé');
    expect(screen.getByLabelText('Éditeur')).toHaveValue('Casterman');
    expect(screen.getByLabelText('Format')).toHaveValue('book');
    expect(screen.getByLabelText('Code-barres (ISBN / EAN)')).toHaveValue('9782203001190');
  });

  it('conserve la saisie quand la fiche ne renseigne pas un champ', async () => {
    stubLookup(200, {
      ...BARCODE_TINTIN,
      suggestion: {
        work: { title: 'Alien', series: null, volumeNumber: null, creators: null, year: null },
        edition: { format: null, publisher: null, releaseYear: null, language: null },
      },
    });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Série'), 'Saga');
    await user.selectOptions(screen.getByLabelText('Format'), 'bluray');
    await user.type(screen.getByLabelText('Code-barres (ISBN / EAN)'), '5051889000006');
    await user.click(screen.getByRole('button', { name: 'Rechercher la fiche' }));

    await screen.findByRole('status');
    expect(screen.getByLabelText('Titre')).toHaveValue('Alien');
    expect(screen.getByLabelText('Série')).toHaveValue('Saga');
    expect(screen.getByLabelText('Format')).toHaveValue('bluray');
  });

  it('signale une édition déjà présente dans la collection', async () => {
    stubLookup(200, { ...BARCODE_TINTIN, source: 'local', known: true });
    await searchFor('9782203001190');

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Cette édition est déjà dans ta collection',
    );
  });

  it.each([
    [404, 'Aucune fiche trouvée pour ce code : saisis les informations à la main.'],
    [400, 'Code-barres invalide : vérifie la saisie.'],
    [500, 'Une erreur est survenue.'],
  ])('affiche un message adapté pour une réponse %i', async (status, message) => {
    stubLookup(status, { error: 'x' });
    await searchFor('9782203001190');

    expect(await screen.findByRole('status')).toHaveTextContent(message);
    expect(screen.getByLabelText('Titre')).toHaveValue('');
  });
});

describe('AddCopyPage — scan caméra', () => {
  afterEach(() => {
    restoreCamera();
  });

  it('masque le bouton et explique pourquoi quand le scan est indisponible', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: 'Scanner' })).not.toBeInTheDocument();
    expect(screen.getByText(/Le scan n.est pas disponible ici/)).toBeInTheDocument();
  });

  it('scanne un code puis préremplit la fiche', async () => {
    mockCamera({ reads: [['9782203001190']] });
    let requested = '';
    server.use(
      http.get('/api/barcodes/:code', ({ params }) => {
        requested = String(params.code);
        return HttpResponse.json(BARCODE_TINTIN);
      }),
    );
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByText(/Le scan n.est pas disponible ici/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Scanner' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('status')).toHaveTextContent('Fiche trouvée via Open Library');
    expect(requested).toBe('9782203001190');
    expect(screen.getByLabelText('Code-barres (ISBN / EAN)')).toHaveValue('9782203001190');
    expect(screen.getByLabelText('Titre')).toHaveValue('Tintin au Tibet');
  });

  it('ferme le scan sans rien modifier', async () => {
    mockCamera({ reads: [[]] });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Scanner' }));
    await user.click(await screen.findByRole('button', { name: 'Fermer' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Code-barres (ISBN / EAN)')).toHaveValue('');
  });
});

describe('AddCopyPage — recherche par titre', () => {
  const RESULTS = {
    results: [
      {
        barcode: '9782203001190',
        source: 'bnf',
        suggestion: {
          work: {
            title: 'Tintin au Tibet',
            series: 'Tintin',
            volumeNumber: 20,
            creators: 'Hergé',
            year: null,
          },
          edition: { format: 'book', publisher: 'Casterman', releaseYear: 2006, language: 'fr' },
        },
      },
      {
        barcode: null,
        source: 'tmdb',
        suggestion: {
          work: { title: 'Tintin', series: null, volumeNumber: null, creators: null, year: 2011 },
          edition: { format: null, publisher: null, releaseYear: null, language: null },
        },
      },
    ],
  };

  it('préremplit le formulaire avec le résultat choisi', async () => {
    let query: string | null = null;
    server.use(
      http.get('/api/titles/search', ({ request }) => {
        query = new URL(request.url).searchParams.get('q');
        return HttpResponse.json(RESULTS);
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Titre, série ou auteur'), 'tintin tibet{Enter}');
    await user.click(await screen.findByRole('button', { name: 'Choisir : Tintin au Tibet' }));

    expect(query).toBe('tintin tibet');
    expect(screen.getByLabelText('Titre')).toHaveValue('Tintin au Tibet');
    expect(screen.getByLabelText('Série')).toHaveValue('Tintin');
    expect(screen.getByLabelText('Numéro de tome')).toHaveValue(20);
    expect(screen.getByLabelText('Éditeur')).toHaveValue('Casterman');
    expect(screen.getByLabelText('Code-barres (ISBN / EAN)')).toHaveValue('9782203001190');
    expect(screen.getByText(/Fiche reprise de la BnF/)).toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'Résultats de la recherche' }),
    ).not.toBeInTheDocument();
  });

  it('garde le code-barres et le format saisis quand le résultat n’en fournit pas', async () => {
    server.use(http.get('/api/titles/search', () => HttpResponse.json(RESULTS)));
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByLabelText('Format'), 'bluray');
    await user.type(screen.getByLabelText('Code-barres (ISBN / EAN)'), '5051889000001');
    await user.type(screen.getByLabelText('Titre, série ou auteur'), 'tintin');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));
    await user.click(await screen.findByRole('button', { name: 'Choisir : Tintin' }));

    expect(screen.getByLabelText('Titre')).toHaveValue('Tintin');
    expect(screen.getByLabelText('Format')).toHaveValue('bluray');
    expect(screen.getByLabelText('Code-barres (ISBN / EAN)')).toHaveValue('5051889000001');
  });

  it('retire le code-barres venu d’une autre fiche quand le résultat n’en a pas', async () => {
    server.use(
      http.get('/api/barcodes/:code', () => HttpResponse.json(BARCODE_TINTIN)),
      http.get('/api/titles/search', () => HttpResponse.json(RESULTS)),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Code-barres (ISBN / EAN)'), '9782203001190');
    await user.click(screen.getByRole('button', { name: 'Rechercher la fiche' }));
    await screen.findByText(/Fiche trouvée/);
    await user.type(screen.getByLabelText('Titre, série ou auteur'), 'tintin');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));
    await user.click(await screen.findByRole('button', { name: 'Choisir : Tintin' }));

    expect(screen.getByLabelText('Titre')).toHaveValue('Tintin');
    expect(screen.getByLabelText('Code-barres (ISBN / EAN)')).toHaveValue('');
  });

  it('n’envoie pas le formulaire en validant la recherche avec Entrée', async () => {
    let created = false;
    server.use(
      http.get('/api/titles/search', () => HttpResponse.json(RESULTS)),
      http.post('/api/copies', () => {
        created = true;
        return HttpResponse.json(COPY_TINTIN, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Titre'), 'Dune');
    await user.type(screen.getByLabelText('Titre, série ou auteur'), 'tintin{Enter}');

    await screen.findByRole('list', { name: 'Résultats de la recherche' });
    expect(created).toBe(false);
  });

  it('signale une recherche sans résultat', async () => {
    server.use(http.get('/api/titles/search', () => HttpResponse.json({ results: [] })));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Titre, série ou auteur'), 'zzzz');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(await screen.findByText(/Aucun résultat/)).toBeInTheDocument();
  });

  it('demande au moins deux caractères sans appeler le serveur', async () => {
    let called = false;
    server.use(
      http.get('/api/titles/search', () => {
        called = true;
        return HttpResponse.json(RESULTS);
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Titre, série ou auteur'), 'a');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(screen.getByText('Saisis au moins 2 caractères.')).toBeInTheDocument();
    expect(called).toBe(false);
  });
});
