import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { describe, expect, it } from 'vitest';

import { localToday } from '@/lib/format';
import { COPY_TINTIN, SALE_LISTED, SALE_SOLD } from '@/tests/fixtures';
import { apiError } from '@/tests/msw/apiError';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { SaleSection } from './SaleSection';

const stubSale = (sale: JsonBodyType) =>
  server.use(http.get('/api/copies/:id/sale', () => HttpResponse.json(sale)));

/** Capture le corps JSON reçu par une route d'écriture. */
function captureBody(method: 'post' | 'patch', path: string, response: JsonBodyType) {
  const captured: { body?: unknown; called: number } = { called: 0 };
  server.use(
    http[method](path, async ({ request }) => {
      captured.called += 1;
      captured.body = await request.json();
      return HttpResponse.json(response, { status: method === 'post' ? 201 : 200 });
    }),
  );
  return captured;
}

const stubPlatforms = (items: object[]) =>
  server.use(http.get('/api/platforms', () => HttpResponse.json({ items })));

/** Libellés du menu « Plateforme », dans l'ordre. */
const platformOptions = () =>
  [...screen.getByLabelText('Plateforme').querySelectorAll('option')].map(
    (option) => option.textContent,
  );

describe('SaleSection — sans vente', () => {
  it('propose de mettre en vente ou de vendre directement', async () => {
    renderWithProviders(<SaleSection copy={COPY_TINTIN} />);

    expect(await screen.findByRole('button', { name: 'Mettre en vente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marquer comme vendu' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Retirer de la vente' })).not.toBeInTheDocument();
  });

  it('met en vente avec plateforme, prix en euros et date du jour', async () => {
    const captured = captureBody('post', '/api/copies/:id/sale', SALE_LISTED);
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={COPY_TINTIN} />);

    await user.click(await screen.findByRole('button', { name: 'Mettre en vente' }));
    expect(screen.getByLabelText('Date de mise en vente')).toHaveValue(localToday());
    await user.selectOptions(screen.getByLabelText('Plateforme'), 'Vinted');
    await user.type(screen.getByLabelText('Prix (€)'), '12,5');
    await user.click(screen.getByRole('button', { name: 'Mettre en vente' }));

    await waitFor(() => expect(captured.called).toBe(1));
    expect(captured.body).toEqual({
      platform: 'Vinted',
      priceCents: 1250,
      listedAt: localToday(),
    });
    expect(await screen.findByRole('button', { name: 'Mettre en vente' })).toBeInTheDocument();
  });

  it('exige une plateforme pour mettre en vente', async () => {
    const captured = captureBody('post', '/api/copies/:id/sale', SALE_LISTED);
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={COPY_TINTIN} />);

    await user.click(await screen.findByRole('button', { name: 'Mettre en vente' }));
    expect(screen.getByLabelText('Plateforme')).toBeRequired();
    await user.click(screen.getByRole('button', { name: 'Mettre en vente' }));

    expect(captured.called).toBe(0);
  });

  it('n’envoie pas de prix quand il est laissé vide', async () => {
    const captured = captureBody('post', '/api/copies/:id/sale', SALE_LISTED);
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={COPY_TINTIN} />);

    await user.click(await screen.findByRole('button', { name: 'Mettre en vente' }));
    await user.selectOptions(screen.getByLabelText('Plateforme'), 'Vinted');
    await user.click(screen.getByRole('button', { name: 'Mettre en vente' }));

    await waitFor(() => expect(captured.called).toBe(1));
    expect(captured.body).toEqual({ platform: 'Vinted', listedAt: localToday() });
  });

  it('affiche l’annonce de la plateforme saisie, avec un lien pour la publier', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={COPY_TINTIN} />);

    await user.click(await screen.findByRole('button', { name: 'Mettre en vente' }));
    expect(screen.queryByRole('link', { name: /Ouvrir/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Titre')).toHaveValue(
      'Tome 20 - Tintin au Tibet - Très bon état - Hergé',
    );

    await user.selectOptions(screen.getByLabelText('Plateforme'), 'Leboncoin');

    expect(
      screen.getByRole('link', { name: "Ouvrir Leboncoin pour publier l'annonce" }),
    ).toHaveAttribute('href', 'https://www.leboncoin.fr/deposer-une-annonce');
  });

  it('adapte le titre de l’annonce à la plateforme pendant la saisie', async () => {
    const copy = {
      ...COPY_TINTIN,
      work: { ...COPY_TINTIN.work, title: 'Les Aventures extraordinaires de Tintin au Tibet' },
    };
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={copy} />);

    await user.click(await screen.findByRole('button', { name: 'Mettre en vente' }));
    await user.selectOptions(screen.getByLabelText('Plateforme'), 'Vinted');
    const onVinted = screen.getByLabelText<HTMLInputElement>('Titre').value;
    await user.selectOptions(screen.getByLabelText('Plateforme'), 'eBay');

    expect(onVinted).not.toContain('Très bon état');
    expect(screen.getByLabelText<HTMLInputElement>('Titre').value).toContain('Très bon état');
  });

  it('ne laisse pas « Copié » quand le titre change avec la plateforme', async () => {
    const copy = {
      ...COPY_TINTIN,
      work: { ...COPY_TINTIN.work, title: 'Les Aventures extraordinaires de Tintin au Tibet' },
    };
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={copy} />);

    await user.click(await screen.findByRole('button', { name: 'Mettre en vente' }));
    await user.selectOptions(screen.getByLabelText('Plateforme'), 'Vinted');
    await user.click(screen.getAllByRole('button', { name: 'Copier' })[0]);
    expect(screen.getByRole('button', { name: 'Copié' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Plateforme'), 'eBay');

    expect(screen.queryByRole('button', { name: 'Copié' })).not.toBeInTheDocument();
  });

  it('propose les plateformes connues tant qu’aucune n’est réglée, avec un lien vers les réglages', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={COPY_TINTIN} />);

    await user.click(await screen.findByRole('button', { name: 'Mettre en vente' }));

    expect(platformOptions()).toEqual([
      'Choisir une plateforme',
      'Vinted',
      'Leboncoin',
      'eBay',
      'Momox',
      'Rakuten',
      'Amazon',
    ]);
    expect(screen.getByText(/Aucune plateforme réglée/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Régler mes plateformes' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('ne propose que les plateformes du compte, la plateforme par défaut présélectionnée', async () => {
    stubPlatforms([
      // Dans l'ordre où le serveur les renvoie : par nom.
      { id: 2, name: 'BDfugue', publishUrl: 'https://www.bdfugue.com/vendre', isDefault: true },
      { id: 1, name: 'Vinted', publishUrl: null, isDefault: false },
    ]);
    const captured = captureBody('post', '/api/copies/:id/sale', SALE_LISTED);
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={COPY_TINTIN} />);

    await user.click(await screen.findByRole('button', { name: 'Mettre en vente' }));

    await waitFor(() => expect(screen.getByLabelText('Plateforme')).toHaveValue('BDfugue'));
    expect(platformOptions()).toEqual(['Choisir une plateforme', 'BDfugue', 'Vinted']);
    expect(screen.queryByText(/Aucune plateforme réglée/)).not.toBeInTheDocument();
    // L'adresse de dépôt d'une plateforme personnalisée vient des réglages.
    expect(
      screen.getByRole('link', { name: "Ouvrir BDfugue pour publier l'annonce" }),
    ).toHaveAttribute('href', 'https://www.bdfugue.com/vendre');

    await user.click(screen.getByRole('button', { name: 'Mettre en vente' }));
    await waitFor(() => expect(captured.called).toBe(1));
    expect(captured.body).toMatchObject({ platform: 'BDfugue' });
  });

  it('exige de choisir quand aucune plateforme par défaut n’est réglée', async () => {
    stubPlatforms([{ id: 1, name: 'Vinted', publishUrl: null, isDefault: false }]);
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={COPY_TINTIN} />);

    await user.click(await screen.findByRole('button', { name: 'Mettre en vente' }));

    await waitFor(() => expect(platformOptions()).toEqual(['Choisir une plateforme', 'Vinted']));
    expect(screen.getByLabelText('Plateforme')).toHaveValue('');
    expect(screen.getByLabelText('Plateforme')).toBeRequired();
  });

  it('vend directement sans annonce', async () => {
    const captured = captureBody('post', '/api/copies/:id/sale/sold', SALE_SOLD);
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={COPY_TINTIN} />);

    await user.click(await screen.findByRole('button', { name: 'Marquer comme vendu' }));
    expect(screen.getByLabelText('Plateforme')).not.toBeRequired();
    expect(screen.queryByLabelText('Titre')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Prix (€)'), '4');
    await user.click(screen.getByRole('button', { name: 'Enregistrer la vente' }));

    await waitFor(() => expect(captured.called).toBe(1));
    expect(captured.body).toEqual({ priceCents: 400, soldAt: localToday() });
  });

  it('ne laisse pas saisir un prix invalide', async () => {
    const captured = captureBody('post', '/api/copies/:id/sale', SALE_LISTED);
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={COPY_TINTIN} />);

    await user.click(await screen.findByRole('button', { name: 'Mettre en vente' }));
    await user.selectOptions(screen.getByLabelText('Plateforme'), 'Vinted');
    await user.type(screen.getByLabelText('Prix (€)'), 'douze');
    await user.click(screen.getByRole('button', { name: 'Mettre en vente' }));

    expect(captured.called).toBe(0);
  });

  it('referme le formulaire sans rien envoyer', async () => {
    const captured = captureBody('post', '/api/copies/:id/sale', SALE_LISTED);
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={COPY_TINTIN} />);

    await user.click(await screen.findByRole('button', { name: 'Mettre en vente' }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.getByRole('button', { name: 'Mettre en vente' })).toBeInTheDocument();
    expect(captured.called).toBe(0);
  });

  it('affiche l’erreur du serveur et garde le formulaire', async () => {
    server.use(http.post('/api/copies/:id/sale', () => apiError('sale.already_listed', 409)));
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={COPY_TINTIN} />);

    await user.click(await screen.findByRole('button', { name: 'Mettre en vente' }));
    await user.selectOptions(screen.getByLabelText('Plateforme'), 'Vinted');
    await user.click(screen.getByRole('button', { name: 'Mettre en vente' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Cet exemplaire est déjà en vente.');
    expect(screen.getByLabelText('Plateforme')).toBeInTheDocument();
  });

  it('empêche de vendre un exemplaire prêté', async () => {
    renderWithProviders(<SaleSection copy={{ ...COPY_TINTIN, status: 'loaned' }} />);

    expect(await screen.findByRole('button', { name: 'Marquer comme vendu' })).toBeDisabled();
    expect(
      screen.getByText("Rends d'abord l'exemplaire prêté pour le vendre."),
    ).toBeInTheDocument();
  });
});

describe('SaleSection — en vente', () => {
  const listedCopy = { ...COPY_TINTIN, status: 'listed' as const };

  it('résume l’annonce et propose de la vendre, la modifier ou la retirer', async () => {
    stubSale(SALE_LISTED);
    renderWithProviders(<SaleSection copy={listedCopy} />);

    expect(
      await screen.findByText(/^En vente sur Vinted à 12,50\s€ depuis le 01\/10\/2026$/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mettre en vente' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marquer comme vendu' })).toBeEnabled();
    expect(screen.getByRole('button', { name: "Modifier l'annonce" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retirer de la vente' })).toBeInTheDocument();
  });

  it('rouvre l’annonce de la plateforme où l’exemplaire est en vente, avec son lien', async () => {
    stubSale(SALE_LISTED);
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={listedCopy} />);

    await user.click(await screen.findByRole('button', { name: "Voir l'annonce à publier" }));

    expect(
      screen.getByRole('link', { name: "Ouvrir Vinted pour publier l'annonce" }),
    ).toHaveAttribute('href', 'https://www.vinted.fr/items/new');
    expect(screen.getByLabelText('Titre')).toHaveValue(
      'Tome 20 - Tintin au Tibet - Très bon état - Hergé',
    );
  });

  it('vend en gardant plateforme et prix de l’annonce, préremplis dans le formulaire', async () => {
    stubSale(SALE_LISTED);
    const captured = captureBody('post', '/api/copies/:id/sale/sold', SALE_SOLD);
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={listedCopy} />);

    await user.click(await screen.findByRole('button', { name: 'Marquer comme vendu' }));
    expect(screen.getByLabelText('Plateforme')).toHaveValue('Vinted');
    expect(screen.getByLabelText('Prix (€)')).toHaveValue('12,50');
    await user.clear(screen.getByLabelText('Prix (€)'));
    await user.type(screen.getByLabelText('Prix (€)'), '10');
    await user.click(screen.getByRole('button', { name: 'Enregistrer la vente' }));

    await waitFor(() => expect(captured.called).toBe(1));
    expect(captured.body).toEqual({ platform: 'Vinted', priceCents: 1000, soldAt: localToday() });
  });

  it('modifie l’annonce et efface un champ vidé', async () => {
    stubSale(SALE_LISTED);
    const captured = captureBody('patch', '/api/copies/:id/sale', SALE_LISTED);
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={listedCopy} />);

    await user.click(await screen.findByRole('button', { name: "Modifier l'annonce" }));
    expect(screen.queryByLabelText('Date de vente')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Plateforme'), '');
    await user.clear(screen.getByLabelText('Prix (€)'));
    await user.type(screen.getByLabelText('Prix (€)'), '9,9');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(captured.called).toBe(1));
    expect(captured.body).toEqual({ platform: null, priceCents: 990 });
  });

  it('garde dans le menu la plateforme d’une annonce retirée des réglages', async () => {
    stubPlatforms([{ id: 1, name: 'Vinted', publishUrl: null, isDefault: true }]);
    stubSale({ ...SALE_LISTED, platform: 'Ancien site' });
    const captured = captureBody('patch', '/api/copies/:id/sale', SALE_LISTED);
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={listedCopy} />);

    await user.click(await screen.findByRole('button', { name: "Modifier l'annonce" }));

    await waitFor(() => expect(platformOptions()).toContain('Ancien site'));
    expect(screen.getByLabelText('Plateforme')).toHaveValue('Ancien site');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(captured.called).toBe(1));
    expect(captured.body).toMatchObject({ platform: 'Ancien site' });
  });

  it('retire l’annonce directement', async () => {
    stubSale(SALE_LISTED);
    let removed = false;
    server.use(
      http.delete('/api/copies/:id/sale', () => {
        removed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={listedCopy} />);

    await user.click(await screen.findByRole('button', { name: 'Retirer de la vente' }));

    await waitFor(() => expect(removed).toBe(true));
  });

  it('affiche l’erreur quand le retrait échoue', async () => {
    stubSale(SALE_LISTED);
    server.use(http.delete('/api/copies/:id/sale', () => apiError('common.internal', 500)));
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={listedCopy} />);

    await user.click(await screen.findByRole('button', { name: 'Retirer de la vente' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Une erreur est survenue.');
  });

  it('résume une annonce sans plateforme ni prix', async () => {
    stubSale({ ...SALE_LISTED, platform: null, priceCents: null });
    renderWithProviders(<SaleSection copy={listedCopy} />);

    expect(await screen.findByText('En vente depuis le 01/10/2026')).toBeInTheDocument();
  });
});

describe('SaleSection — vendu', () => {
  const soldCopy = { ...COPY_TINTIN, status: 'sold' as const };

  it('résume la vente et ne propose que de l’annuler', async () => {
    stubSale(SALE_SOLD);
    renderWithProviders(<SaleSection copy={soldCopy} />);

    expect(
      await screen.findByText(/^Vendu sur Leboncoin pour 10,00\s€ le 10\/09\/2026$/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marquer comme vendu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mettre en vente' })).not.toBeInTheDocument();
  });

  it('annule la vente après confirmation', async () => {
    stubSale(SALE_SOLD);
    let removed = false;
    server.use(
      http.delete('/api/copies/:id/sale', () => {
        removed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={soldCopy} />);

    await user.click(await screen.findByRole('button', { name: 'Annuler la vente' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Annuler cette vente ?' });
    expect(dialog).toHaveTextContent("L'exemplaire redeviendra « en rayon ».");
    expect(removed).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Annuler la vente' }));

    await waitFor(() => expect(removed).toBe(true));
  });

  it('garde la vente quand on renonce à l’annuler', async () => {
    stubSale(SALE_SOLD);
    let removed = false;
    server.use(
      http.delete('/api/copies/:id/sale', () => {
        removed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<SaleSection copy={soldCopy} />);

    await user.click(await screen.findByRole('button', { name: 'Annuler la vente' }));
    await user.click(screen.getByRole('button', { name: 'Garder la vente' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(removed).toBe(false);
  });
});
