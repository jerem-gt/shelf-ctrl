import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { USER_ADMIN, USER_BOB } from '@/tests/fixtures';
import { apiError } from '@/tests/msw/apiError';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { UsersPage } from './UsersPage';

const rowOf = async (name: string) =>
  (await screen.findByText(name, { selector: 'span' })).closest('li') as HTMLElement;

describe('UsersPage', () => {
  it('liste les comptes, le sien repéré et sans bouton de suppression', async () => {
    renderWithProviders(<UsersPage />);

    const admin = await rowOf('admin');
    expect(within(admin).getByText('(toi)')).toBeInTheDocument();
    expect(within(admin).getByText('Admin')).toBeInTheDocument();
    expect(
      within(admin).getByText(/2 exemplaires · dernier ajout le 14\/10\/2026/),
    ).toBeInTheDocument();
    expect(
      within(admin).queryByRole('button', { name: 'Supprimer admin' }),
    ).not.toBeInTheDocument();

    const bob = await rowOf('bob');
    expect(within(bob).getByText(/pas d'e-mail · 0 exemplaire · créé le/)).toBeInTheDocument();
    expect(within(bob).getByRole('button', { name: 'Supprimer bob' })).toBeInTheDocument();
  });

  it('crée un compte', async () => {
    let received: unknown;
    server.use(
      http.post('/api/users', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);
    const form = (await screen.findByRole('heading', { name: 'Ajouter un compte' }))
      .parentElement as HTMLElement;

    await user.type(within(form).getByLabelText("Nom d'utilisateur"), ' carol ');
    await user.type(within(form).getByLabelText('Mot de passe'), 'long-enough');
    await user.click(within(form).getByLabelText('Administrateur'));
    await user.click(within(form).getByRole('button', { name: 'Créer le compte' }));

    await vi.waitFor(() =>
      expect(received).toEqual({
        username: 'carol',
        password: 'long-enough',
        email: null,
        isAdmin: true,
      }),
    );
    expect(within(form).getByLabelText("Nom d'utilisateur")).toHaveValue('');
  });

  it('affiche un nom déjà pris', async () => {
    server.use(http.post('/api/users', () => apiError('user.username_taken', 409)));
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);
    const form = (await screen.findByRole('heading', { name: 'Ajouter un compte' }))
      .parentElement as HTMLElement;

    await user.type(within(form).getByLabelText("Nom d'utilisateur"), 'bob');
    await user.type(within(form).getByLabelText('Mot de passe'), 'long-enough');
    await user.click(within(form).getByRole('button', { name: 'Créer le compte' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent('déjà pris');
  });

  it('modifie un compte en n’envoyant que ce qui change', async () => {
    let received: unknown;
    server.use(
      http.patch('/api/users/2', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);
    const bob = await rowOf('bob');

    await user.click(within(bob).getByRole('button', { name: 'Modifier bob' }));
    await user.type(within(bob).getByLabelText('Adresse e-mail (facultative)'), 'bob@example.com');
    await user.click(within(bob).getByLabelText('Administrateur'));
    await user.click(within(bob).getByRole('button', { name: 'Enregistrer' }));

    await vi.waitFor(() => expect(received).toEqual({ email: 'bob@example.com', isAdmin: true }));
  });

  it('affiche le refus de rétrograder le dernier admin', async () => {
    server.use(http.patch('/api/users/1', () => apiError('user.last_admin', 409)));
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);
    const admin = await rowOf('admin');

    await user.click(within(admin).getByRole('button', { name: 'Modifier admin' }));
    await user.click(within(admin).getByLabelText('Administrateur'));
    await user.click(within(admin).getByRole('button', { name: 'Enregistrer' }));

    expect(await within(admin).findByRole('alert')).toHaveTextContent(
      'Il faut garder au moins un administrateur.',
    );
  });

  it('supprime un compte après confirmation', async () => {
    let deleted = false;
    server.use(
      http.delete('/api/users/2', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);
    const bob = await rowOf('bob');

    await user.click(within(bob).getByRole('button', { name: 'Supprimer bob' }));
    const dialog = within(bob).getByRole('alertdialog');
    expect(dialog).toHaveTextContent('toute sa collection');
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer le compte' }));

    await vi.waitFor(() => expect(deleted).toBe(true));
  });

  it('envoie un e-mail de test et affiche une configuration SMTP absente', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);

    await user.click(await screen.findByRole('button', { name: 'Envoyer un e-mail de test' }));
    expect(await screen.findByRole('status')).toHaveTextContent('E-mail de test envoyé');

    server.use(http.post('/api/auth/test-email', () => apiError('auth.smtp_not_configured', 503)));
    await user.click(screen.getByRole('button', { name: 'Envoyer un e-mail de test' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('SMTP_');
  });

  describe('double authentification', () => {
    const withBobTotp = () => {
      let bob = { ...USER_BOB, totpEnabled: true };
      const disabled: string[] = [];
      server.use(
        http.get('/api/users', () => HttpResponse.json({ items: [USER_ADMIN, bob] })),
        http.delete('/api/users/:id/2fa', ({ params }) => {
          disabled.push(String(params.id));
          bob = { ...bob, totpEnabled: false };
          return new HttpResponse(null, { status: 204 });
        }),
      );
      return disabled;
    };

    it('signale les comptes à la 2FA active, seuls à proposer sa désactivation', async () => {
      withBobTotp();
      renderWithProviders(<UsersPage />);

      const bob = await rowOf('bob');
      expect(within(bob).getByText('2FA')).toBeInTheDocument();
      expect(
        within(bob).getByRole('button', { name: 'Désactiver la 2FA de bob' }),
      ).toBeInTheDocument();
      const admin = await rowOf('admin');
      expect(within(admin).queryByText('2FA')).not.toBeInTheDocument();
      expect(
        within(admin).queryByRole('button', { name: 'Désactiver la 2FA de admin' }),
      ).not.toBeInTheDocument();
    });

    it('désactive la 2FA d’un compte après confirmation', async () => {
      const disabled = withBobTotp();
      const user = userEvent.setup();
      renderWithProviders(<UsersPage />);

      const bob = await rowOf('bob');
      await user.click(within(bob).getByRole('button', { name: 'Désactiver la 2FA de bob' }));
      const dialog = within(bob).getByRole('alertdialog', { name: 'Désactiver la 2FA de bob' });
      expect(dialog).toHaveTextContent('téléphone perdu');
      await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
      expect(disabled).toEqual([]);

      await user.click(within(bob).getByRole('button', { name: 'Désactiver la 2FA de bob' }));
      await user.click(within(bob).getByRole('button', { name: 'Désactiver la 2FA' }));

      await vi.waitFor(() => expect(within(bob).queryByText('2FA')).not.toBeInTheDocument());
      expect(disabled).toEqual(['2']);
    });

    it('affiche le refus du serveur', async () => {
      withBobTotp();
      server.use(http.delete('/api/users/:id/2fa', () => apiError('auth.totp_not_enabled', 409)));
      const user = userEvent.setup();
      renderWithProviders(<UsersPage />);

      const bob = await rowOf('bob');
      await user.click(within(bob).getByRole('button', { name: 'Désactiver la 2FA de bob' }));
      await user.click(within(bob).getByRole('button', { name: 'Désactiver la 2FA' }));

      expect(await within(bob).findByRole('alert')).toHaveTextContent(
        "La double authentification n'est pas activée.",
      );
    });
  });
});
