import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { apiError } from '@/tests/msw/apiError';
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
    ['auth.invalid_credentials', 401, 'Identifiant ou mot de passe incorrect.'],
    ['auth.too_many_attempts', 429, 'Trop de tentatives : réessaie dans quelques minutes.'],
    ['common.internal', 500, 'Une erreur est survenue.'],
  ])('affiche le message adapté au code %s', async (code, status, message) => {
    server.use(http.post('/api/auth/login', () => apiError(code, status)));

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

  describe('double authentification', () => {
    const requireTotp = () =>
      server.use(http.post('/api/auth/login', () => HttpResponse.json({ totpRequired: true })));

    it('demande le code après le mot de passe et l’envoie avec « se souvenir »', async () => {
      requireTotp();
      let received: unknown;
      server.use(
        http.post('/api/auth/2fa/verify', async ({ request }) => {
          received = await request.json();
          return HttpResponse.json({ id: 1, username: 'admin' });
        }),
      );
      const user = userEvent.setup();

      await fillAndSubmit('admin', 'secret');

      const code = await screen.findByLabelText('Code à 6 chiffres');
      expect(code).toHaveAttribute('autocomplete', 'one-time-code');
      expect(screen.getByRole('button', { name: 'Vérifier' })).toBeDisabled();
      await user.type(code, '12 34-56');
      expect(code).toHaveValue('123456');
      await user.click(screen.getByLabelText('Se souvenir de cet appareil pendant 30 jours'));
      await user.click(screen.getByRole('button', { name: 'Vérifier' }));

      await vi.waitFor(() => expect(received).toEqual({ code: '123456', remember: true }));
    });

    it('affiche l’erreur d’un code refusé', async () => {
      requireTotp();
      server.use(http.post('/api/auth/2fa/verify', () => apiError('auth.totp_invalid', 401)));
      const user = userEvent.setup();

      await fillAndSubmit('admin', 'secret');
      await user.type(await screen.findByLabelText('Code à 6 chiffres'), '000000');
      await user.click(screen.getByRole('button', { name: 'Vérifier' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Code invalide ou déjà utilisé : attends le suivant.',
      );
    });

    it('revient au mot de passe avec le message quand l’attente du code a expiré', async () => {
      requireTotp();
      server.use(http.post('/api/auth/2fa/verify', () => apiError('auth.totp_token_invalid', 401)));
      const user = userEvent.setup();

      await fillAndSubmit('admin', 'secret');
      await user.type(await screen.findByLabelText('Code à 6 chiffres'), '123456');
      await user.click(screen.getByRole('button', { name: 'Vérifier' }));

      expect(await screen.findByLabelText('Mot de passe')).toHaveValue('');
      expect(screen.getByRole('alert')).toHaveTextContent(
        'La connexion a expiré : saisis de nouveau ton mot de passe.',
      );
      await user.type(screen.getByLabelText('Mot de passe'), 'secret');
      await user.click(screen.getByRole('button', { name: 'Se connecter' }));
      expect(await screen.findByLabelText('Code à 6 chiffres')).toBeInTheDocument();
    });

    it('revient au mot de passe, vidé', async () => {
      requireTotp();
      const user = userEvent.setup();

      await fillAndSubmit('admin', 'secret');
      await user.click(await screen.findByRole('button', { name: 'Retour' }));

      expect(screen.getByLabelText('Identifiant')).toHaveValue('admin');
      expect(screen.getByLabelText('Mot de passe')).toHaveValue('');
    });
  });
});
