import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from './App';

describe('App', () => {
  it("affiche le nom de l'application et la collection", async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'ShelfCtrl' })).toBeInTheDocument();
    expect(await screen.findByText('Tintin au Tibet')).toBeInTheDocument();
  });
});
