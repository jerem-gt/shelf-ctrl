import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { SESSION_ADMIN } from '@/tests/fixtures';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { AccountMenu } from './AccountMenu';

function renderMenu(route = '/') {
  return renderWithProviders(
    <>
      <AccountMenu />
      <p>Ailleurs</p>
      <button type="button">Après</button>
      <Routes>
        <Route path="/" element={<p>Collection</p>} />
        <Route path="/settings" element={<p>Page réglages</p>} />
      </Routes>
    </>,
    route,
  );
}

const menuButton = () => screen.findByRole('button', { name: /Menu du compte/ });
const queryMenu = () => screen.queryByRole('navigation', { name: 'Compte' });

describe('AccountMenu', () => {
  it('ouvre les réglages, l’administration et la déconnexion', async () => {
    const user = userEvent.setup();
    renderMenu();

    const button = await menuButton();
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('navigation', { name: 'Compte' });
    expect(within(menu).getByRole('link', { name: 'Réglages' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(within(menu).getByRole('link', { name: 'Utilisateurs' })).toHaveAttribute(
      'href',
      '/admin',
    );
    expect(within(menu).getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument();
  });

  it('affiche le nom du compte, repris dans le nom accessible du bouton', async () => {
    renderMenu();

    expect(await screen.findByRole('button', { name: 'admin Menu du compte' })).toHaveTextContent(
      'admin',
    );
  });

  it('cache l’administration à un compte non admin', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ ...SESSION_ADMIN, isAdmin: false })),
    );
    const user = userEvent.setup();
    renderMenu();
    await screen.findByText('admin');

    await user.click(await menuButton());

    const menu = screen.getByRole('navigation', { name: 'Compte' });
    expect(within(menu).getByRole('link', { name: 'Réglages' })).toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: 'Utilisateurs' })).not.toBeInTheDocument();
  });

  it('porte le focus sur la première entrée à l’ouverture', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(await menuButton());

    expect(screen.getByRole('link', { name: 'Réglages' })).toHaveFocus();
  });

  it('se ferme en changeant de page', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(await menuButton());
    await user.click(screen.getByRole('link', { name: 'Réglages' }));

    expect(await screen.findByText('Page réglages')).toBeInTheDocument();
    expect(queryMenu()).not.toBeInTheDocument();
  });

  it('se ferme au choix de la page déjà affichée', async () => {
    const user = userEvent.setup();
    renderMenu('/settings');

    await user.click(await menuButton());
    await user.click(screen.getByRole('link', { name: 'Réglages' }));

    expect(queryMenu()).not.toBeInTheDocument();
  });

  it('se ferme à Échap en rendant le focus au bouton, et au clic extérieur', async () => {
    const user = userEvent.setup();
    renderMenu();
    const button = await menuButton();

    await user.click(button);
    await user.keyboard('{Escape}');
    expect(queryMenu()).not.toBeInTheDocument();
    expect(button).toHaveFocus();

    await user.click(button);
    await user.click(screen.getByText('Ailleurs'));
    expect(queryMenu()).not.toBeInTheDocument();
  });

  it('se ferme quand le focus quitte le menu au clavier', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(await menuButton());
    await user.tab(); // Utilisateurs
    await user.tab(); // Se déconnecter
    expect(queryMenu()).toBeInTheDocument();
    await user.tab();

    expect(screen.getByRole('button', { name: 'Après' })).toHaveFocus();
    expect(queryMenu()).not.toBeInTheDocument();
  });

  it('referme au second clic sur le bouton', async () => {
    const user = userEvent.setup();
    renderMenu();
    const button = await menuButton();

    await user.click(button);
    await user.click(button);

    expect(queryMenu()).not.toBeInTheDocument();
  });
});
