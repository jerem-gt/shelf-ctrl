import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from './App';

describe('App', () => {
  it("affiche le nom de l'application et la collection", async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'ShelfCtrl' })).toBeInTheDocument();
    expect(await screen.findByText('Tintin au Tibet')).toBeInTheDocument();
  });

  it('propose la navigation entre la collection et les prêts', () => {
    render(<App />);

    const nav = screen.getByRole('navigation', { name: 'Navigation' });
    expect(within(nav).getByRole('link', { name: 'Collection' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: 'Prêts' })).toHaveAttribute('href', '/loans');
  });
});
