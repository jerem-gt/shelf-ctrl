import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import i18n from '@/i18n';

import { LanguageSwitcher } from './LanguageSwitcher';

describe('LanguageSwitcher', () => {
  it('affiche les deux langues, la langue courante enfoncée', () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole('button', { name: 'Français' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it("passe l'interface en anglais et mémorise le choix", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole('button', { name: 'English' }));

    await waitFor(() => expect(i18n.language).toBe('en'));
    expect(localStorage.getItem('i18nextLng')).toBe('en');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('revient au français', async () => {
    const user = userEvent.setup();
    await i18n.changeLanguage('en');
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole('button', { name: 'Français' }));

    await waitFor(() => expect(i18n.language).toBe('fr'));
    expect(localStorage.getItem('i18nextLng')).toBe('fr');
  });
});
