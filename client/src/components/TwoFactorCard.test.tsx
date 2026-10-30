import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { DEVICE_CURRENT, DEVICE_OTHER, SESSION_ADMIN, TOTP_SETUP } from '@/tests/fixtures';
import { apiError } from '@/tests/msw/apiError';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { TwoFactorCard } from './TwoFactorCard';

const withTotp = () =>
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json({ ...SESSION_ADMIN, totpEnabled: true })),
  );

const withDevices = () => {
  let items = [DEVICE_CURRENT, DEVICE_OTHER];
  const deleted: string[] = [];
  server.use(
    http.get('/api/auth/devices', () => HttpResponse.json({ items })),
    http.delete('/api/auth/devices/:id', ({ params }) => {
      deleted.push(String(params.id));
      items = items.filter((device) => device.id !== Number(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete('/api/auth/devices', () => {
      deleted.push('all');
      items = [];
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return deleted;
};

describe('TwoFactorCard', () => {
  it('active la 2FA : QR code, clé, puis le premier code seul', async () => {
    let received: unknown;
    server.use(
      http.post('/api/auth/2fa/enable', async ({ request }) => {
        received = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<TwoFactorCard />);

    expect(await screen.findByText('Désactivée')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Activer la 2FA' }));

    expect(await screen.findByTitle('QR code de la double authentification')).toBeInTheDocument();
    expect(screen.getByText(TOTP_SETUP.secret)).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Confirmer et activer' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Code à 6 chiffres'), '654321');
    await user.click(confirm);

    expect(await screen.findByText('Double authentification activée.')).toBeInTheDocument();
    expect(received).toEqual({ code: '654321' });
    expect(screen.getByText('Activée')).toBeInTheDocument();
    expect(screen.getByText('Aucun appareil mémorisé.')).toBeInTheDocument();
  });

  it('affiche un code refusé à l’activation et permet d’annuler', async () => {
    server.use(http.post('/api/auth/2fa/enable', () => apiError('auth.totp_invalid', 401)));
    const user = userEvent.setup();
    renderWithProviders(<TwoFactorCard />);

    await user.click(await screen.findByRole('button', { name: 'Activer la 2FA' }));
    await user.type(await screen.findByLabelText('Code à 6 chiffres'), '000000');
    await user.click(screen.getByRole('button', { name: 'Confirmer et activer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Code invalide ou déjà utilisé');

    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('button', { name: 'Activer la 2FA' })).toBeInTheDocument();
  });

  it('affiche l’échec de la préparation', async () => {
    server.use(http.post('/api/auth/2fa/setup', () => apiError('auth.totp_already_enabled', 409)));
    const user = userEvent.setup();
    renderWithProviders(<TwoFactorCard />);

    await user.click(await screen.findByRole('button', { name: 'Activer la 2FA' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La double authentification est déjà activée.',
    );
  });

  it('désactive la 2FA avec le mot de passe actuel', async () => {
    withTotp();
    let received: unknown;
    server.use(
      http.post('/api/auth/2fa/disable', async ({ request }) => {
        received = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<TwoFactorCard />);

    await user.click(await screen.findByRole('button', { name: 'Désactiver la 2FA' }));
    await user.type(screen.getByLabelText('Mot de passe actuel'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Désactiver la 2FA' }));

    expect(await screen.findByText('Double authentification désactivée.')).toBeInTheDocument();
    expect(received).toEqual({ password: 'secret' });
    expect(screen.getByText('Désactivée')).toBeInTheDocument();
  });

  it('garde la 2FA si le mot de passe est refusé, et permet d’annuler', async () => {
    withTotp();
    server.use(
      http.post('/api/auth/2fa/disable', () => apiError('auth.current_password_incorrect', 401)),
    );
    const user = userEvent.setup();
    renderWithProviders(<TwoFactorCard />);

    await user.click(await screen.findByRole('button', { name: 'Désactiver la 2FA' }));
    await user.type(screen.getByLabelText('Mot de passe actuel'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Désactiver la 2FA' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Mot de passe actuel incorrect.');

    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByText('Activée')).toBeInTheDocument();
  });

  it('liste les appareils mémorisés, celui-ci repéré', async () => {
    withTotp();
    withDevices();
    renderWithProviders(<TwoFactorCard />);

    const list = await screen.findByRole('list', { name: 'Appareils mémorisés' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Firefox · Linux')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Cet appareil')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Dernière utilisation : le 12/10/2026 à 18:40')).toBeVisible();
    expect(within(rows[1]).getByText('Appareil inconnu')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('Cet appareil')).not.toBeInTheDocument();
  });

  it('dit aujourd’hui ou hier pour une utilisation récente', async () => {
    withTotp();
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 8, 5);
    server.use(
      http.get('/api/auth/devices', () =>
        HttpResponse.json({
          items: [
            { ...DEVICE_CURRENT, lastUsedAt: now.getTime() },
            { ...DEVICE_OTHER, lastUsedAt: yesterday.getTime() },
          ],
        }),
      ),
    );
    renderWithProviders(<TwoFactorCard />);

    expect(await screen.findByText(/Dernière utilisation : aujourd'hui à/)).toBeInTheDocument();
    expect(screen.getByText('Dernière utilisation : hier à 08:05')).toBeInTheDocument();
  });

  it('oublie un appareil', async () => {
    withTotp();
    const deleted = withDevices();
    const user = userEvent.setup();
    renderWithProviders(<TwoFactorCard />);

    await user.click(await screen.findByRole('button', { name: 'Oublier Appareil inconnu' }));

    await vi.waitFor(() => expect(deleted).toEqual(['2']));
    await vi.waitFor(() => expect(screen.queryByText('Appareil inconnu')).not.toBeInTheDocument());
  });

  it('oublie tous les appareils après confirmation', async () => {
    withTotp();
    const deleted = withDevices();
    const user = userEvent.setup();
    renderWithProviders(<TwoFactorCard />);

    await user.click(await screen.findByRole('button', { name: 'Oublier tous les appareils' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Oublier tous les appareils' });
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(deleted).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Oublier tous les appareils' }));
    await user.click(screen.getByRole('button', { name: 'Tout oublier' }));

    expect(await screen.findByText('Aucun appareil mémorisé.')).toBeInTheDocument();
    expect(deleted).toEqual(['all']);
  });
});
