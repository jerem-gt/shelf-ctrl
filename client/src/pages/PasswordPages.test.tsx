import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { SetupPage } from './SetupPage';

describe('ForgotPasswordPage', () => {
  it('envoie l’identifiant puis affiche le même message que le compte existe ou non', async () => {
    let received: unknown;
    server.use(
      http.post('/api/auth/password/forgot', async ({ request }) => {
        received = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Identifiant ou e-mail'), ' alice@example.com ');
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Si un compte correspond');
    expect(received).toEqual({ identifier: 'alice@example.com' });
  });

  it('affiche la limitation des demandes', async () => {
    server.use(
      http.post('/api/auth/password/forgot', () =>
        HttpResponse.json({ error: 'too_many_attempts' }, { status: 429 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Identifiant ou e-mail'), 'alice');
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de tentatives');
  });
});

describe('ResetPasswordPage', () => {
  const fill = async (password: string, confirm: string) => {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Nouveau mot de passe'), password);
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), confirm);
    await user.click(screen.getByRole('button', { name: 'Réinitialiser' }));
  };

  it('envoie le jeton du lien et le nouveau mot de passe, puis propose la connexion', async () => {
    let received: unknown;
    server.use(
      http.post('/api/auth/password/reset', async ({ request }) => {
        received = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<ResetPasswordPage />, '/reset-password?token=abc');

    const chosen = 'brand-new-pw';
    await fill(chosen, chosen);

    expect(await screen.findByRole('link', { name: 'Aller à la connexion' })).toBeInTheDocument();
    expect(received).toEqual({ token: 'abc', password: chosen });
  });

  it.each([
    ['trop court', 'short', 'short', '8 caractères au minimum.'],
    ['différent', 'brand-new-pw', 'other-password', 'Les mots de passe ne correspondent pas.'],
  ])('refuse un mot de passe %s sans rien envoyer', async (_label, password, confirm, message) => {
    let sent = false;
    server.use(
      http.post('/api/auth/password/reset', () => {
        sent = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<ResetPasswordPage />, '/reset-password?token=abc');

    await fill(password, confirm);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(sent).toBe(false);
  });

  it('propose une nouvelle demande quand le lien est expiré ou absent', async () => {
    server.use(
      http.post('/api/auth/password/reset', () =>
        HttpResponse.json({ error: 'reset_token_invalid' }, { status: 400 }),
      ),
    );
    const { unmount } = renderWithProviders(<ResetPasswordPage />, '/reset-password?token=old');
    await fill('brand-new-pw', 'brand-new-pw');
    expect(await screen.findByRole('link', { name: 'Refaire une demande' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    unmount();

    renderWithProviders(<ResetPasswordPage />, '/reset-password');
    expect(screen.getByText('Ce lien est invalide ou a expiré.')).toBeInTheDocument();
  });
});

describe('SetupPage', () => {
  it('affiche le refus d’un jeton erroné', async () => {
    server.use(
      http.post('/api/auth/setup', () =>
        HttpResponse.json({ error: 'setup_token_invalid' }, { status: 403 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SetupPage />);

    await user.type(screen.getByLabelText("Jeton d'installation"), 'faux');
    await user.type(screen.getByLabelText("Nom d'utilisateur"), 'jerem');
    await user.type(screen.getByLabelText('Mot de passe'), 'long-enough');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'long-enough');
    await user.click(screen.getByRole('button', { name: 'Créer le compte' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Jeton d'installation incorrect.");
  });
});
