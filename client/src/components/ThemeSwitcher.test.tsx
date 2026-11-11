import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { setTheme } from '@/hooks/useTheme';

import { ThemeSwitcher } from './ThemeSwitcher';

function resetTheme() {
  setTheme('system');
  document.documentElement.classList.remove('dark');
}

describe('ThemeSwitcher', () => {
  beforeEach(resetTheme);
  afterAll(resetTheme);

  it('propose clair, sombre et système, ce dernier actif par défaut', () => {
    render(<ThemeSwitcher />);
    expect(screen.getByRole('button', { name: 'Clair' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Sombre' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Système' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('passe en sombre au clic et le mémorise', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    await user.click(screen.getByRole('button', { name: 'Sombre' }));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('shelfctrl.theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Sombre' })).toHaveAttribute('aria-pressed', 'true');
  });
});
