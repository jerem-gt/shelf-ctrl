import type { PlatformItem } from '@shelfctrl/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiError } from '@/tests/msw/apiError';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';
import { stubScreen } from '@/tests/stubScreen';

import { SettingsPage } from './SettingsPage';

/** Serveur de réglages simulé, avec son état : la page recharge la liste après chaque action. */
function stubServer(initial: PlatformItem[] = []) {
  let items = [...initial];
  let nextId = 100;
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const log = async (request: Request) => {
    const text = await request.text();
    calls.push({
      method: request.method,
      url: new URL(request.url).pathname,
      body: text ? JSON.parse(text) : undefined,
    });
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  };

  server.use(
    http.get('/api/platforms', () => HttpResponse.json({ items })),
    http.post('/api/platforms', async ({ request }) => {
      const body = (await log(request)) as { name: string; publishUrl?: string };
      if (items.some((item) => item.name.toLowerCase() === body.name.toLowerCase())) {
        return apiError('platform.duplicate', 409);
      }
      // Comme le serveur : adresse de dépôt en http/https seulement
      if (body.publishUrl !== undefined && !/^https?:\/\//i.test(body.publishUrl)) {
        return apiError('validation.invalid', 400);
      }
      const created = {
        id: nextId++,
        name: body.name,
        publishUrl: body.publishUrl ?? null,
        isDefault: items.length === 0,
      };
      items = [...items, created].sort((a, b) => a.name.localeCompare(b.name));
      return HttpResponse.json(created, { status: 201 });
    }),
    http.put('/api/platforms/default', async ({ request }) => {
      const body = (await log(request)) as { id: number | null };
      items = items.map((item) => ({ ...item, isDefault: item.id === body.id }));
      return new HttpResponse(null, { status: 204 });
    }),
    http.patch('/api/platforms/:id', async ({ request, params }) => {
      const body = (await log(request)) as { publishUrl: string | null };
      items = items.map((item) =>
        item.id === Number(params.id) ? { ...item, publishUrl: body.publishUrl } : item,
      );
      return HttpResponse.json(items.find((item) => item.id === Number(params.id)));
    }),
    http.delete('/api/platforms/:id', async ({ request, params }) => {
      await log(request);
      items = items.filter((item) => item.id !== Number(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { calls };
}

const URL_LABEL = "Adresse de la page de dépôt d'annonce (facultative)";
const PLATFORMS_PATH = '/settings?section=platforms';

const VINTED: PlatformItem = { id: 1, name: 'Vinted', publishUrl: null, isDefault: true };
const BDFUGUE: PlatformItem = {
  id: 2,
  name: 'BDfugue',
  publishUrl: 'https://www.bdfugue.com/vendre',
  isDefault: false,
};

/** Adresse courante et bouton « précédent » du navigateur, pour suivre l'historique. */
function HistoryProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="Adresse">{location.pathname + location.search}</output>
      <button type="button" onClick={() => void navigate(-1)}>
        Précédent
      </button>
    </>
  );
}

/** Page des réglages dans un historique : `entries`, la dernière ouverte. */
function renderInHistory(entries: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <HistoryProbe />
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<p>Ailleurs</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const menu = () => screen.getByRole('navigation', { name: 'Rubriques des réglages' });
const queryMenu = () => screen.queryByRole('navigation', { name: 'Rubriques des réglages' });
const address = () => screen.getByRole('status', { name: 'Adresse' });

describe('SettingsPage — menu sur grand écran', () => {
  beforeEach(() => {
    stubScreen(true);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('propose les rubriques, la langue et le thème, et ouvre le profil par défaut', async () => {
    renderWithProviders(<SettingsPage />, '/settings');

    const links = within(menu()).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/settings?section=profile',
      '/settings?section=twoFactor',
      '/settings?section=platforms',
    ]);
    expect(within(menu()).getByRole('link', { name: 'Profil et mot de passe' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('region', { name: 'Profil et mot de passe' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Langue' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Thème' })).toBeInTheDocument();
    expect(await screen.findByLabelText("Nom d'utilisateur")).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Toutes les rubriques' })).not.toBeInTheDocument();
  });

  it('ouvre la rubrique choisie à côté du menu, sans empiler l’historique d’une rubrique à l’autre', async () => {
    stubServer();
    const user = userEvent.setup();
    renderInHistory(['/', '/settings']);

    await user.click(within(menu()).getByRole('link', { name: 'Double authentification' }));
    await user.click(within(menu()).getByRole('link', { name: 'Plateformes de vente' }));

    expect(screen.getByRole('region', { name: 'Plateformes de vente' })).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'Vinted' })).toBeInTheDocument();
    expect(within(menu()).getByRole('link', { name: 'Plateformes de vente' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(menu()).getByRole('link', { name: 'Plateformes de vente' })).toHaveFocus();

    // Sur grand écran, une rubrique est toujours affichée : chaque choix remplace l'entrée, et le
    // retour quitte les réglages.
    await user.click(screen.getByRole('button', { name: 'Précédent' }));
    expect(address()).toHaveTextContent(/^\/$/);
  });

  it('n’empile rien en choisissant la rubrique déjà affichée par défaut', async () => {
    const user = userEvent.setup();
    renderInHistory(['/', '/settings']);

    await user.click(within(menu()).getByRole('link', { name: 'Profil et mot de passe' }));
    expect(address()).toHaveTextContent('/settings?section=profile');

    await user.click(screen.getByRole('button', { name: 'Précédent' }));
    expect(address()).toHaveTextContent(/^\/$/);
  });

  it('corrige l’adresse d’une rubrique inconnue', () => {
    renderInHistory(['/settings?section=inconnue']);

    expect(address()).toHaveTextContent(/^\/settings$/);
    expect(screen.getByRole('region', { name: 'Profil et mot de passe' })).toBeInTheDocument();
  });
});

describe('SettingsPage — menu sur mobile', () => {
  beforeEach(() => {
    stubScreen(false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('affiche le menu seul, sans rubrique ouverte ni marquée', () => {
    renderInHistory(['/settings']);

    expect(menu()).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Profil et mot de passe' }),
    ).not.toBeInTheDocument();
    expect(
      within(menu()).getByRole('link', { name: 'Profil et mot de passe' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('ouvre la rubrique seule, focus sur son titre, et revient au menu en arrière', async () => {
    stubServer();
    const user = userEvent.setup();
    renderInHistory(['/', '/settings']);

    await user.click(within(menu()).getByRole('link', { name: 'Plateformes de vente' }));

    expect(queryMenu()).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Plateformes de vente' })).toHaveFocus();
    expect(await screen.findByRole('checkbox', { name: 'Vinted' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Toutes les rubriques' }));
    expect(address()).toHaveTextContent(/^\/settings$/);
    // Le focus revient sur le lien de la rubrique quittée.
    expect(within(menu()).getByRole('link', { name: 'Plateformes de vente' })).toHaveFocus();

    // Le retour au menu n'a rien empilé : un retour de plus quitte les réglages.
    await user.click(screen.getByRole('button', { name: 'Précédent' }));
    expect(address()).toHaveTextContent(/^\/$/);
  });

  it('ne déplace pas le focus quand seule la largeur change', async () => {
    vi.unstubAllGlobals();
    const resize = stubScreen(true);
    const user = userEvent.setup();
    renderInHistory(['/settings']);

    const link = within(menu()).getByRole('link', { name: 'Double authentification' });
    await user.click(link);
    expect(link).toHaveFocus();

    act(() => resize(false));

    expect(screen.getByRole('heading', { name: 'Double authentification' })).not.toHaveFocus();
  });

  it('corrige l’adresse d’une rubrique inconnue et montre le menu', () => {
    renderInHistory(['/settings?section=inconnue']);

    expect(address()).toHaveTextContent(/^\/settings$/);
    expect(menu()).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Profil et mot de passe' }),
    ).not.toBeInTheDocument();
  });

  it('ramène au menu sans empiler quand la rubrique a été ouverte d’ailleurs', async () => {
    stubServer();
    const user = userEvent.setup();
    renderInHistory(['/sales', PLATFORMS_PATH]);

    await user.click(screen.getByRole('link', { name: 'Toutes les rubriques' }));
    expect(address()).toHaveTextContent(/^\/settings$/);

    await user.click(screen.getByRole('button', { name: 'Précédent' }));
    expect(address()).toHaveTextContent(/^\/sales$/);
  });
});

describe('SettingsPage — plateformes', () => {
  it('liste les plateformes connues, décochées, sans plateforme par défaut possible', async () => {
    stubServer();
    renderWithProviders(<SettingsPage />, PLATFORMS_PATH);

    expect(await screen.findByRole('checkbox', { name: 'Vinted' })).not.toBeChecked();
    expect(screen.getAllByRole('checkbox')).toHaveLength(6);
    expect(screen.getByText('Aucune autre plateforme.')).toBeInTheDocument();
    expect(screen.getByLabelText('Plateforme par défaut')).toBeDisabled();
  });

  it('coche une plateforme connue, la première devenant la plateforme par défaut', async () => {
    const { calls } = stubServer();
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, PLATFORMS_PATH);

    await user.click(await screen.findByRole('checkbox', { name: 'Vinted' }));

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Vinted' })).toBeChecked());
    expect(calls).toEqual([{ method: 'POST', url: '/api/platforms', body: { name: 'Vinted' } }]);
    expect(screen.getByLabelText('Plateforme par défaut')).toHaveValue('100');
  });

  it('décoche une plateforme pour la retirer', async () => {
    const { calls } = stubServer([VINTED]);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, PLATFORMS_PATH);

    await user.click(await screen.findByRole('checkbox', { name: 'Vinted' }));

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Vinted' })).not.toBeChecked());
    expect(calls).toEqual([{ method: 'DELETE', url: '/api/platforms/1', body: undefined }]);
  });

  it('ajoute une plateforme personnalisée avec son adresse de dépôt', async () => {
    const { calls } = stubServer();
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, PLATFORMS_PATH);

    await user.type(await screen.findByLabelText('Nom'), '  BDfugue ');
    await user.type(screen.getByLabelText(URL_LABEL), 'https://www.bdfugue.com/vendre');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByRole('list', { name: 'Autres plateformes' })).toHaveTextContent(
      'BDfugue',
    );
    expect(calls[0]).toEqual({
      method: 'POST',
      url: '/api/platforms',
      body: { name: 'BDfugue', publishUrl: 'https://www.bdfugue.com/vendre' },
    });
    expect(screen.getByLabelText('Nom')).toHaveValue('');
  });

  it('refuse un doublon et une adresse invalide avec un message clair', async () => {
    stubServer([VINTED]);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, PLATFORMS_PATH);

    await user.type(await screen.findByLabelText('Nom'), 'vinted');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cette plateforme existe déjà.');

    await user.clear(screen.getByLabelText('Nom'));
    await user.type(screen.getByLabelText('Nom'), 'Autre');
    await user.type(screen.getByLabelText(URL_LABEL), 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByText(/Nom ou adresse invalide/)).toBeInTheDocument();
  });

  it('change la plateforme par défaut, ou n’en garde aucune', async () => {
    const { calls } = stubServer([BDFUGUE, VINTED]);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, PLATFORMS_PATH);
    const select = await screen.findByLabelText('Plateforme par défaut');
    expect(select).toHaveValue('1');

    await user.selectOptions(select, 'BDfugue');
    await waitFor(() => expect(screen.getByLabelText('Plateforme par défaut')).toHaveValue('2'));
    await user.selectOptions(screen.getByLabelText('Plateforme par défaut'), 'Aucune');

    await waitFor(() => expect(screen.getByLabelText('Plateforme par défaut')).toHaveValue(''));
    expect(calls.map((call) => call.body)).toEqual([{ id: 2 }, { id: null }]);
  });

  it('modifie l’adresse d’une plateforme personnalisée, seulement quand elle change', async () => {
    const { calls } = stubServer([BDFUGUE]);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, PLATFORMS_PATH);

    const save = await screen.findByRole('button', { name: "Enregistrer l'adresse" });
    expect(save).toBeDisabled();
    const url = screen.getByDisplayValue('https://www.bdfugue.com/vendre');
    await user.clear(url);
    await user.type(url, 'https://www.bdfugue.com/nouveau');
    await user.click(save);

    await waitFor(() =>
      expect(calls).toEqual([
        {
          method: 'PATCH',
          url: '/api/platforms/2',
          body: { publishUrl: 'https://www.bdfugue.com/nouveau' },
        },
      ]),
    );
  });

  it('efface l’adresse en vidant le champ', async () => {
    const { calls } = stubServer([BDFUGUE]);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, PLATFORMS_PATH);

    await user.clear(await screen.findByDisplayValue('https://www.bdfugue.com/vendre'));
    await user.click(screen.getByRole('button', { name: "Enregistrer l'adresse" }));

    await waitFor(() => expect(calls[0].body).toEqual({ publishUrl: null }));
  });

  it('retire une plateforme personnalisée', async () => {
    const { calls } = stubServer([BDFUGUE]);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, PLATFORMS_PATH);

    await user.click(await screen.findByRole('button', { name: 'Retirer BDfugue' }));

    expect(await screen.findByText('Aucune autre plateforme.')).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'DELETE', url: '/api/platforms/2', body: undefined }]);
  });

  it('signale une liste impossible à charger', async () => {
    server.use(http.get('/api/platforms', () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<SettingsPage />, PLATFORMS_PATH);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
