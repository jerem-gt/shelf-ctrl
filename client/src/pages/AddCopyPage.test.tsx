import type { TitleSearchResponse } from '@shelfctrl/types';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { mockCamera, restoreCamera } from '@/tests/cameraMocks';
import { BARCODE_TINTIN, COPY_TINTIN } from '@/tests/fixtures';
import { apiError } from '@/tests/msw/apiError';
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
    await user.click(screen.getByRole('radio', { name: 'Film / série / anime' }));
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

  it('commence par le type, livre par défaut, le format n’étant à choisir que pour un film', async () => {
    const user = userEvent.setup();
    renderPage();

    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['book', 'movie', 'game']);
    expect(screen.getByRole('radio', { name: 'Livre / BD' })).toBeChecked();
    expect(screen.queryByLabelText('Format')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Film / série / anime' }));
    expect(screen.getByLabelText('Format')).toHaveValue('dvd');
    expect(screen.getAllByRole('option').map((option) => option.getAttribute('value'))).toEqual(
      expect.arrayContaining(['dvd', 'bluray', 'uhd4k']),
    );
  });

  it('propose la console d’un jeu vidéo et l’envoie, studio à la place des auteurs', async () => {
    let received: unknown;
    server.use(
      http.post('/api/copies', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(COPY_TINTIN, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByLabelText('Console')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Jeu vidéo' }));
    await user.type(screen.getByLabelText('Titre'), 'Halo 3');
    await user.type(screen.getByLabelText('Studio (développeur)'), 'Bungie');
    await user.type(screen.getByLabelText('Console'), 'Xbox 360');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await screen.findByText('Accueil');
    expect(received).toMatchObject({
      work: { title: 'Halo 3', creators: 'Bungie' },
      edition: { format: 'game', console: 'Xbox 360' },
    });
  });

  it('oublie la console quand le format n’est plus un jeu', async () => {
    let received: { edition: Record<string, unknown> } | undefined;
    server.use(
      http.post('/api/copies', async ({ request }) => {
        received = (await request.json()) as typeof received;
        return HttpResponse.json(COPY_TINTIN, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'Jeu vidéo' }));
    await user.type(screen.getByLabelText('Console'), 'PS5');
    await user.click(screen.getByRole('radio', { name: 'Film / série / anime' }));
    await user.selectOptions(screen.getByLabelText('Format'), 'bluray');
    await user.type(screen.getByLabelText('Titre'), 'Alien');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await screen.findByText('Accueil');
    expect(received?.edition).toEqual({ format: 'bluray' });
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
    server.use(http.post('/api/copies', () => apiError('validation.invalid', 400)));
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

  it('reprend format et console d’un jeu trouvé par son code-barres', async () => {
    stubLookup(200, {
      barcode: '0045496590741',
      kind: 'ean',
      source: 'upcitemdb',
      known: false,
      suggestion: {
        work: {
          title: 'Super Mario Odyssey',
          series: null,
          volumeNumber: null,
          creators: null,
          year: null,
        },
        edition: {
          format: 'game',
          publisher: 'Nintendo',
          releaseYear: null,
          language: null,
          console: 'Nintendo Switch',
        },
      },
    });
    await searchFor('0045496590741');

    await screen.findByRole('status');
    expect(screen.getByRole('radio', { name: 'Jeu vidéo' })).toBeChecked();
    expect(screen.getByLabelText('Console')).toHaveValue('Nintendo Switch');
  });

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
    expect(screen.getByRole('radio', { name: 'Livre / BD' })).toBeChecked();
    expect(screen.getByLabelText('Code-barres (ISBN / EAN)')).toHaveValue('9782203001190');
  });

  it('conserve la saisie quand la fiche ne renseigne pas un champ', async () => {
    stubLookup(200, {
      ...BARCODE_TINTIN,
      suggestion: {
        work: { title: 'Alien', series: null, volumeNumber: null, creators: null, year: null },
        edition: {
          format: null,
          publisher: null,
          releaseYear: null,
          language: null,
          console: null,
        },
      },
    });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Série'), 'Saga');
    await user.click(screen.getByRole('radio', { name: 'Film / série / anime' }));
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
    stubLookup(status, {});
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
          edition: {
            format: 'book',
            publisher: 'Casterman',
            releaseYear: 2006,
            language: 'fr',
            console: null,
          },
        },
        consoles: [],
      },
      {
        barcode: null,
        source: 'tmdb',
        suggestion: {
          work: { title: 'Tintin', series: null, volumeNumber: null, creators: null, year: 2011 },
          edition: {
            format: null,
            publisher: null,
            releaseYear: null,
            language: null,
            console: null,
          },
        },
        consoles: [],
      },
    ],
    configured: true,
  } satisfies TitleSearchResponse;

  it('cite toutes les consoles d’un jeu, sans en préremplir quand il y en a plusieurs', async () => {
    const game = (title: string, consoles: string[]) => ({
      barcode: null,
      source: 'igdb' as const,
      suggestion: {
        work: { title, series: null, volumeNumber: null, creators: 'Naughty Dog', year: 2022 },
        edition: {
          format: 'game' as const,
          publisher: null,
          releaseYear: 2022,
          language: null,
          console: consoles.length === 1 ? consoles[0] : null,
        },
      },
      consoles,
    });
    server.use(
      http.get('/api/titles/search', () =>
        HttpResponse.json({
          results: [
            game('The Last of Us Part I', ['PlayStation 5', 'PC']),
            game('The Last of Us', ['PlayStation 3']),
          ],
          configured: true,
        } satisfies TitleSearchResponse),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'Jeu vidéo' }));
    await user.type(screen.getByLabelText('Titre, série ou auteur'), 'last of us{Enter}');

    expect(await screen.findByText('Naughty Dog · 2022 · PlayStation 5 / PC')).toBeInTheDocument();
    expect(screen.getByText('Naughty Dog · 2022 · PlayStation 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Choisir : The Last of Us Part I' }));
    expect(screen.getByLabelText('Console')).toHaveValue('');
  });

  it('indique la source de chaque résultat', async () => {
    server.use(http.get('/api/titles/search', () => HttpResponse.json(RESULTS)));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Titre, série ou auteur'), 'tintin{Enter}');

    const items = within(
      await screen.findByRole('list', { name: 'Résultats de la recherche' }),
    ).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('via la BnF');
    expect(items[1]).toHaveTextContent('via TMDB');
  });

  it('préremplit le formulaire avec le résultat choisi', async () => {
    let query: string | null = null;
    let kind: string | null = null;
    server.use(
      http.get('/api/titles/search', ({ request }) => {
        query = new URL(request.url).searchParams.get('q');
        kind = new URL(request.url).searchParams.get('kind');
        return HttpResponse.json(RESULTS);
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Titre, série ou auteur'), 'tintin tibet{Enter}');
    await user.click(await screen.findByRole('button', { name: 'Choisir : Tintin au Tibet' }));

    expect(query).toBe('tintin tibet');
    expect(kind).toBe('book');
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

    await user.click(screen.getByRole('radio', { name: 'Film / série / anime' }));
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

  it('cherche parmi les jeux quand le type choisi est le jeu vidéo', async () => {
    const kinds: (string | null)[] = [];
    server.use(
      http.get('/api/titles/search', ({ request }) => {
        kinds.push(new URL(request.url).searchParams.get('kind'));
        return HttpResponse.json(RESULTS);
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'Jeu vidéo' }));
    await user.type(screen.getByLabelText('Titre, série ou auteur'), 'zelda{Enter}');
    await screen.findByRole('list', { name: 'Résultats de la recherche' });

    // Changer de type efface les résultats de l'autre type.
    await user.click(screen.getByRole('radio', { name: 'Film / série / anime' }));
    expect(
      screen.queryByRole('list', { name: 'Résultats de la recherche' }),
    ).not.toBeInTheDocument();
    expect(kinds).toEqual(['game']);
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
    server.use(
      http.get('/api/titles/search', () => HttpResponse.json({ results: [], configured: true })),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Titre, série ou auteur'), 'zzzz');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(await screen.findByText(/Aucun résultat/)).toBeInTheDocument();
  });

  it.each([
    [
      'Film / série / anime',
      'La recherche de films et de séries n’est pas configurée',
      'TMDB_API_KEY',
    ],
    ['Jeu vidéo', 'La recherche de jeux vidéo n’est pas configurée', 'IGDB_CLIENT_ID'],
  ])('explique qu’aucune source n’est configurée (%s)', async (kind, message, variable) => {
    server.use(
      http.get('/api/titles/search', () => HttpResponse.json({ results: [], configured: false })),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: kind }));
    await user.type(screen.getByLabelText('Titre, série ou auteur'), 'zelda{Enter}');

    const status = await screen.findByText(new RegExp(message.replace('’', "'")));
    expect(status).toHaveTextContent(variable);
    expect(screen.queryByText(/Aucun résultat/)).not.toBeInTheDocument();
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
