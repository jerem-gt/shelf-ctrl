import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { SESSION_ADMIN } from '@/tests/fixtures';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { ProfileCard } from './ProfileCard';

describe('ProfileCard', () => {
  it('n’envoie que les champs modifiés, avec le mot de passe actuel', async () => {
    let received: unknown;
    server.use(
      http.patch('/api/auth/profile', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ ...SESSION_ADMIN, username: 'jerem' });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProfileCard />);

    const username = await screen.findByLabelText("Nom d'utilisateur");
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    // Sans modification, seul le formulaire de changement de mot de passe le demande.
    expect(screen.getAllByLabelText('Mot de passe actuel')).toHaveLength(1);
    await user.clear(username);
    await user.type(username, 'jerem');
    await user.type(screen.getAllByLabelText('Mot de passe actuel')[0], 'secret');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Profil enregistré.')).toBeInTheDocument();
    expect(received).toEqual({ currentPassword: 'secret', username: 'jerem' });
    expect(screen.getByLabelText("Nom d'utilisateur")).toHaveValue('jerem');
  });

  it('efface l’e-mail quand le champ est vidé', async () => {
    let received: unknown;
    server.use(
      http.patch('/api/auth/profile', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ ...SESSION_ADMIN, email: null });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProfileCard />);

    await user.clear(await screen.findByLabelText('Adresse e-mail (facultative)'));
    await user.type(screen.getAllByLabelText('Mot de passe actuel')[0], 'secret');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await screen.findByText('Profil enregistré.');
    expect(received).toEqual({ currentPassword: 'secret', email: null });
  });

  it('affiche le refus du mot de passe actuel', async () => {
    server.use(
      http.patch('/api/auth/profile', () =>
        HttpResponse.json({ error: 'current_password_incorrect' }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProfileCard />);

    await user.type(await screen.findByLabelText("Nom d'utilisateur"), '2');
    await user.type(screen.getAllByLabelText('Mot de passe actuel')[0], 'wrong');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Mot de passe actuel incorrect.');
  });

  it('change le mot de passe après vérification de la confirmation', async () => {
    let received: unknown;
    server.use(
      http.post('/api/auth/change-password', async ({ request }) => {
        received = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProfileCard />);

    await user.type(
      (await screen.findAllByLabelText('Mot de passe actuel')).at(-1) as HTMLElement,
      'secret',
    );
    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'new-password');
    await user.type(screen.getByLabelText('Confirmer le nouveau mot de passe'), 'other-password');
    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Les mots de passe ne correspondent pas.',
    );
    expect(received).toBeUndefined();

    await user.clear(screen.getByLabelText('Confirmer le nouveau mot de passe'));
    await user.type(screen.getByLabelText('Confirmer le nouveau mot de passe'), 'new-password');
    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Mot de passe changé.');
    expect(received).toEqual({ current: 'secret', next: 'new-password' });
    expect(screen.getByLabelText('Nouveau mot de passe')).toHaveValue('');
  });
});
