import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { SESSION_ADMIN } from '@/tests/fixtures';
import { apiError } from '@/tests/msw/apiError';
import { server } from '@/tests/msw/server';

import App from './App';

const unauthorized = () => apiError('common.unauthorized', 401);

/** Simule un serveur à état : la session existe tant que `state.loggedIn` est vrai. */
function stubSession(loggedIn: boolean) {
  const state = { loggedIn };
  server.use(
    http.get('/api/auth/me', () =>
      state.loggedIn ? HttpResponse.json(SESSION_ADMIN) : unauthorized(),
    ),
    http.post('/api/auth/login', () => {
      state.loggedIn = true;
      return HttpResponse.json(SESSION_ADMIN);
    }),
    http.post('/api/auth/logout', () => {
      state.loggedIn = false;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return state;
}

describe('App connectée', () => {
  it("affiche le nom de l'application et la collection", async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'ShelfCtrl' })).toBeInTheDocument();
    expect(await screen.findByText('Tintin au Tibet')).toBeInTheDocument();
  });

  it('propose la navigation entre la collection, les prêts et les ventes', async () => {
    render(<App />);

    const nav = await screen.findByRole('navigation', { name: 'Navigation' });
    expect(within(nav).getByRole('link', { name: 'Collection' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: 'Prêts' })).toHaveAttribute('href', '/loans');
    expect(within(nav).getByRole('link', { name: 'Ventes' })).toHaveAttribute('href', '/sales');
  });

  it('montre le lien Utilisateurs aux seuls administrateurs', async () => {
    const { unmount } = render(<App />);
    const nav = await screen.findByRole('navigation', { name: 'Navigation' });
    expect(within(nav).getByRole('link', { name: 'Utilisateurs' })).toHaveAttribute(
      'href',
      '/admin',
    );
    unmount();

    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ ...SESSION_ADMIN, isAdmin: false })),
    );
    render(<App />);
    const userNav = await screen.findByRole('navigation', { name: 'Navigation' });
    expect(within(userNav).queryByRole('link', { name: 'Utilisateurs' })).not.toBeInTheDocument();
  });

  it('se déconnecte et revient à la page de connexion', async () => {
    stubSession(true);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Se déconnecter' }));

    expect(await screen.findByLabelText('Identifiant')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByText('Tintin au Tibet')).not.toBeInTheDocument();
  });

  it('ramène à la page de connexion quand la session expire en cours d’usage', async () => {
    const state = stubSession(true);
    server.use(
      http.get('/api/copies', () => {
        state.loggedIn = false;
        return unauthorized();
      }),
    );
    render(<App />);

    expect(await screen.findByLabelText('Identifiant')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});

describe('App déconnectée', () => {
  it('affiche la page de connexion sans rien charger d’autre', async () => {
    stubSession(false);
    render(<App />);

    expect(await screen.findByLabelText('Identifiant')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('ouvre l’application après une connexion réussie', async () => {
    stubSession(false);
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText('Identifiant'), 'admin');
    await user.type(screen.getByLabelText('Mot de passe'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Tintin au Tibet')).toBeInTheDocument();
    expect(screen.queryByLabelText('Identifiant')).not.toBeInTheDocument();
  });

  it('reste sur la page de connexion avec un message quand les identifiants sont refusés', async () => {
    stubSession(false);
    server.use(http.post('/api/auth/login', () => apiError('auth.invalid_credentials', 401)));
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText('Identifiant'), 'admin');
    await user.type(screen.getByLabelText('Mot de passe'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Identifiant ou mot de passe incorrect.',
    );
    expect(screen.getByLabelText('Identifiant')).toBeInTheDocument();
  });

  it('affiche l’erreur quand le serveur est injoignable', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.error()));
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de joindre le serveur.');
    expect(screen.queryByLabelText('Identifiant')).not.toBeInTheDocument();
  });
});

describe('App sans compte ni session', () => {
  afterEach(() => {
    globalThis.history.pushState({}, '', '/');
  });

  it('demande la création du premier compte, puis ouvre l’application', async () => {
    const state = stubSession(false);
    let received: unknown;
    server.use(
      http.get('/api/auth/setup', () => HttpResponse.json({ required: !state.loggedIn })),
      http.post('/api/auth/setup', async ({ request }) => {
        received = await request.json();
        state.loggedIn = true;
        return HttpResponse.json(SESSION_ADMIN);
      }),
    );
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Jeton d'installation"), ' abc ');
    await user.type(screen.getByLabelText("Nom d'utilisateur"), 'jerem');
    await user.type(screen.getByLabelText('Mot de passe'), 'long-enough');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'long-enough');
    await user.click(screen.getByRole('button', { name: 'Créer le compte' }));

    expect(await screen.findByText('Tintin au Tibet')).toBeInTheDocument();
    expect(received).toEqual({ token: 'abc', username: 'jerem', password: 'long-enough' });
  });

  it('mène de la connexion au mot de passe oublié, et retour', async () => {
    stubSession(false);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('link', { name: 'Mot de passe oublié ?' }));
    expect(await screen.findByLabelText('Identifiant ou e-mail')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Retour à la connexion' }));
    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('ouvre le lien de réinitialisation sans session', async () => {
    stubSession(false);
    globalThis.history.pushState({}, '', '/reset-password?token=abc');
    render(<App />);

    expect(await screen.findByLabelText('Nouveau mot de passe')).toBeInTheDocument();
  });
});
