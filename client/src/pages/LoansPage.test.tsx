import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { OPEN_LOAN_ALIEN, OPEN_LOAN_TINTIN } from '@/tests/fixtures';
import { apiError } from '@/tests/msw/apiError';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { LoansPage } from './LoansPage';

/** Date AAAA-MM-JJ d'il y a `days` jours, dans le fuseau local comme `localToday`. */
function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const stubOpenLoans = (loans: object[]) =>
  server.use(http.get('/api/loans', () => HttpResponse.json(loans)));

describe('LoansPage', () => {
  it('liste les prêts en cours avec l’emprunteur, la date et la durée', async () => {
    stubOpenLoans([
      { ...OPEN_LOAN_ALIEN, loanedAt: isoDaysAgo(3) },
      { ...OPEN_LOAN_TINTIN, loanedAt: isoDaysAgo(1) },
    ]);
    renderWithProviders(<LoansPage />);

    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    const links = await screen.findAllByRole('link');

    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Alien', '/copies/2'],
      ['Tintin au Tibet', '/copies/1'],
    ]);
    expect(screen.getByText('Tintin · Tome 20')).toBeInTheDocument();
    expect(screen.getByText(/Alice · depuis le/)).toHaveTextContent('(3 jours)');
    expect(screen.getByText(/Bob · depuis le/)).toHaveTextContent('(1 jour)');
  });

  it('affiche un message quand rien n’est prêté', async () => {
    renderWithProviders(<LoansPage />);

    expect(await screen.findByText('Aucun prêt en cours.')).toBeInTheDocument();
  });

  it('affiche l’erreur de chargement', async () => {
    server.use(http.get('/api/loans', () => apiError('common.internal', 500)));
    renderWithProviders(<LoansPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Une erreur est survenue.');
  });

  it('enregistre le retour et recharge la liste', async () => {
    let open = [{ ...OPEN_LOAN_ALIEN, loanedAt: isoDaysAgo(2) }];
    let returned = '';
    server.use(
      http.get('/api/loans', () => HttpResponse.json(open)),
      http.post('/api/loans/:id/return', ({ params }) => {
        returned = String(params.id);
        open = [];
        return HttpResponse.json({ ...OPEN_LOAN_ALIEN, returnedAt: isoDaysAgo(0) });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<LoansPage />);

    await user.click(await screen.findByRole('button', { name: 'Rendu' }));

    expect(await screen.findByText('Aucun prêt en cours.')).toBeInTheDocument();
    await vi.waitFor(() => expect(returned).toBe('1'));
  });

  it('affiche l’erreur quand le retour échoue et garde le prêt affiché', async () => {
    stubOpenLoans([{ ...OPEN_LOAN_ALIEN, loanedAt: isoDaysAgo(2) }]);
    server.use(http.post('/api/loans/:id/return', () => apiError('loan.already_returned', 409)));
    const user = userEvent.setup();
    renderWithProviders(<LoansPage />);

    await user.click(await screen.findByRole('button', { name: 'Rendu' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ce prêt est déjà rendu.');
    expect(screen.getByText('Alien')).toBeInTheDocument();
  });
});
