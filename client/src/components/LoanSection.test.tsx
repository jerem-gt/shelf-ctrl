import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { localToday } from '@/lib/format';
import { COPY_TINTIN, LOAN_DONE, LOAN_OPEN } from '@/tests/fixtures';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { LoanSection } from './LoanSection';

const loaned = { ...COPY_TINTIN, status: 'loaned' as const };
const sold = { ...COPY_TINTIN, status: 'sold' as const };

const stubLoans = (loans: object[]) =>
  server.use(http.get('/api/copies/:id/loans', () => HttpResponse.json(loans)));

describe('LoanSection — prêt', () => {
  it('propose de prêter un exemplaire jamais prêté', async () => {
    renderWithProviders(<LoanSection copy={COPY_TINTIN} />);

    expect(await screen.findByText('Jamais prêté.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prêter' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marquer comme rendu' })).not.toBeInTheDocument();
  });

  it('enregistre un prêt avec la date du jour par défaut et suggère les emprunteurs connus', async () => {
    let received: unknown;
    server.use(
      http.post('/api/copies/:id/loans', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(LOAN_OPEN, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<LoanSection copy={COPY_TINTIN} />);

    await user.click(await screen.findByRole('button', { name: 'Prêter' }));
    expect(screen.getByLabelText('Date du prêt')).toHaveValue(localToday());
    await waitFor(() => expect(document.querySelectorAll('datalist option')).toHaveLength(2));
    const suggestions = document.querySelectorAll('datalist option');
    expect([...suggestions].map((option) => option.getAttribute('value'))).toEqual([
      'Alice',
      'Bob',
    ]);

    await user.type(screen.getByLabelText('Prêté à'), '  Chloé ');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le prêt' }));

    expect(await screen.findByRole('button', { name: 'Prêter' })).toBeInTheDocument();
    expect(received).toEqual({ borrowerName: 'Chloé', loanedAt: localToday() });
  });

  it('envoie la date choisie', async () => {
    let received: unknown;
    server.use(
      http.post('/api/copies/:id/loans', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(LOAN_OPEN, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<LoanSection copy={COPY_TINTIN} />);

    await user.click(await screen.findByRole('button', { name: 'Prêter' }));
    await user.type(screen.getByLabelText('Prêté à'), 'Alice');
    await user.clear(screen.getByLabelText('Date du prêt'));
    await user.type(screen.getByLabelText('Date du prêt'), '2026-09-01');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le prêt' }));

    await screen.findByRole('button', { name: 'Prêter' });
    expect(received).toEqual({ borrowerName: 'Alice', loanedAt: '2026-09-01' });
  });

  it('referme le formulaire sans rien envoyer', async () => {
    let called = false;
    server.use(
      http.post('/api/copies/:id/loans', () => {
        called = true;
        return HttpResponse.json(LOAN_OPEN, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<LoanSection copy={COPY_TINTIN} />);

    await user.click(await screen.findByRole('button', { name: 'Prêter' }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.getByRole('button', { name: 'Prêter' })).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('affiche l’erreur quand le prêt est refusé', async () => {
    server.use(
      http.post('/api/copies/:id/loans', () =>
        HttpResponse.json({ error: 'already_loaned' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<LoanSection copy={COPY_TINTIN} />);

    await user.click(await screen.findByRole('button', { name: 'Prêter' }));
    await user.type(screen.getByLabelText('Prêté à'), 'Alice');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le prêt' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Cette action n'est plus possible : l'état de l'exemplaire a changé.",
    );
    expect(screen.getByLabelText('Prêté à')).toHaveValue('Alice');
  });

  it('ne propose pas de prêter un exemplaire vendu', async () => {
    renderWithProviders(<LoanSection copy={sold} />);

    expect(
      await screen.findByText('Un exemplaire vendu ne peut plus être prêté.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prêter' })).not.toBeInTheDocument();
  });
});

describe('LoanSection — retour et historique', () => {
  it('affiche le prêt en cours et enregistre le retour à la date du jour', async () => {
    stubLoans([LOAN_OPEN]);
    let returned: unknown;
    server.use(
      http.post('/api/loans/:id/return', async ({ request, params }) => {
        returned = { id: params.id, body: await request.json() };
        return HttpResponse.json({ ...LOAN_OPEN, returnedAt: localToday() });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<LoanSection copy={loaned} />);

    expect(await screen.findByText('Prêté à Alice depuis le 01/10/2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prêter' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Marquer comme rendu' }));

    await vi.waitFor(() =>
      expect(returned).toEqual({ id: '1', body: { returnedAt: localToday() } }),
    );
  });

  it('affiche l’erreur quand le retour échoue', async () => {
    stubLoans([LOAN_OPEN]);
    server.use(
      http.post('/api/loans/:id/return', () =>
        HttpResponse.json({ error: 'already_returned' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<LoanSection copy={loaned} />);

    await user.click(await screen.findByRole('button', { name: 'Marquer comme rendu' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Cette action n'est plus possible");
  });

  it('liste l’historique, du plus récent au plus ancien, avec le prêt en cours', async () => {
    stubLoans([LOAN_OPEN, LOAN_DONE]);
    renderWithProviders(<LoanSection copy={loaned} />);

    const items = await screen.findAllByRole('listitem');

    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Alice · 01/10/2026 → en cours');
    expect(items[1]).toHaveTextContent('Bob · 05/01/2026 → 20/01/2026');
    expect(screen.queryByText('Jamais prêté.')).not.toBeInTheDocument();
  });

  it('propose de prêter de nouveau un exemplaire déjà rendu', async () => {
    stubLoans([LOAN_DONE]);
    renderWithProviders(<LoanSection copy={COPY_TINTIN} />);

    expect(await screen.findByRole('listitem')).toHaveTextContent('Bob · 05/01/2026 → 20/01/2026');
    expect(screen.getByRole('button', { name: 'Prêter' })).toBeInTheDocument();
  });
});
