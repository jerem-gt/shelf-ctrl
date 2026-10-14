import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { LoginPage } from './LoginPage';

async function fillAndSubmit(username: string, password: string) {
  const user = userEvent.setup();
  renderWithProviders(<LoginPage />);
  await user.type(screen.getByLabelText('Identifiant'), username);
  await user.type(screen.getByLabelText('Mot de passe'), password);
  await user.click(screen.getByRole('button', { name: 'Se connecter' }));
}

describe('LoginPage', () => {
  it('affiche le formulaire avec les attributs attendus par les gestionnaires de mots de passe', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('heading', { name: 'ShelfCtrl' })).toBeInTheDocument();
    expect(screen.getByLabelText('Identifiant')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
  });

  it('envoie les identifiants saisis, sans les espaces autour de l’identifiant', async () => {
    let received: unknown;
    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ username: 'admin' });
      }),
    );

    await fillAndSubmit(' admin ', 'secret password');

    await vi.waitFor(() =>
      expect(received).toEqual({ username: 'admin', password: 'secret password' }),
    );
  });

  it.each([
    [401, 'Identifiant ou mot de passe incorrect.'],
    [429, 'Trop de tentatives : réessaie dans quelques minutes.'],
    [500, 'Une erreur est survenue.'],
  ])('affiche le message adapté à une réponse %i', async (status, message) => {
    server.use(http.post('/api/auth/login', () => HttpResponse.json({}, { status })));

    await fillAndSubmit('admin', 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('Mot de passe')).toHaveValue('wrong');
  });

  it('désactive le bouton pendant la connexion', async () => {
    server.use(
      http.post('/api/auth/login', async () => {
        await delay(100);
        return HttpResponse.json({ username: 'admin' });
      }),
    );

    await fillAndSubmit('admin', 'secret');

    expect(await screen.findByRole('button', { name: 'Connexion…' })).toBeDisabled();
  });
});
