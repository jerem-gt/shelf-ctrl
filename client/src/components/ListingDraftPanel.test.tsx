import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { COPY_TINTIN, SALE_LISTED } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { ListingDraftPanel } from './ListingDraftPanel';

describe('ListingDraftPanel', () => {
  it('reste replié tant qu’on ne demande rien', () => {
    renderWithProviders(<ListingDraftPanel copy={COPY_TINTIN} sale={null} />);

    expect(screen.getByRole('button', { name: 'Préparer une annonce' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Titre')).not.toBeInTheDocument();
  });

  it('affiche titre et description issus de la fiche de l’exemplaire', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ListingDraftPanel copy={COPY_TINTIN} sale={null} />);

    await user.click(screen.getByRole('button', { name: 'Préparer une annonce' }));

    expect(screen.getByLabelText('Titre')).toHaveValue(
      'Tome 20 - Tintin au Tibet - Très bon état - Hergé',
    );
    expect(screen.getByLabelText<HTMLTextAreaElement>('Description').value).toContain(
      'Éditeur : Casterman',
    );
  });

  it('adapte le titre à la plateforme choisie', async () => {
    const copy = {
      ...COPY_TINTIN,
      work: { ...COPY_TINTIN.work, title: 'Les Aventures extraordinaires de Tintin au Tibet' },
    };
    const user = userEvent.setup();
    renderWithProviders(<ListingDraftPanel copy={copy} sale={null} />);

    await user.click(screen.getByRole('button', { name: 'Préparer une annonce' }));
    expect(screen.getByLabelText('Titre')).toHaveValue(
      'Tome 20 - Les Aventures extraordinaires de Tintin au Tibet',
    );

    await user.selectOptions(screen.getByLabelText('Plateforme visée'), 'eBay');

    expect(screen.getByLabelText('Titre')).toHaveValue(
      'Tome 20 - Les Aventures extraordinaires de Tintin au Tibet - Très bon état',
    );
  });

  it('ne laisse pas « Copié » quand le texte affiché change', async () => {
    const copy = {
      ...COPY_TINTIN,
      work: { ...COPY_TINTIN.work, title: 'Les Aventures extraordinaires de Tintin au Tibet' },
    };
    const user = userEvent.setup();
    renderWithProviders(<ListingDraftPanel copy={copy} sale={null} />);
    await user.click(screen.getByRole('button', { name: 'Préparer une annonce' }));

    const [copyTitle] = screen.getAllByRole('button', { name: 'Copier' });
    await user.click(copyTitle);
    expect(screen.getByRole('button', { name: 'Copié' })).toBeInTheDocument();

    // Autre plateforme : le titre n'est plus le même, il n'est donc plus dans le presse-papiers.
    await user.selectOptions(screen.getByLabelText('Plateforme visée'), 'eBay');

    expect(screen.queryByRole('button', { name: 'Copié' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Copier' })).toHaveLength(2);
  });

  it('nomme chaque champ par son seul libellé, bouton Copier à part', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ListingDraftPanel copy={COPY_TINTIN} sale={null} />);

    await user.click(screen.getByRole('button', { name: 'Préparer une annonce' }));

    expect(screen.getByRole('textbox', { name: 'Titre' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Description' })).toBeInTheDocument();
  });

  it('propose d’abord la plateforme de l’annonce en cours', async () => {
    const sale = { ...SALE_LISTED, platform: 'Autre site' };
    const user = userEvent.setup();
    renderWithProviders(<ListingDraftPanel copy={COPY_TINTIN} sale={sale} />);

    await user.click(screen.getByRole('button', { name: 'Préparer une annonce' }));

    expect(screen.getByLabelText('Plateforme visée')).toHaveValue('Autre site');
  });

  it('se replie', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ListingDraftPanel copy={COPY_TINTIN} sale={null} />);

    await user.click(screen.getByRole('button', { name: 'Préparer une annonce' }));
    await user.click(screen.getByRole('button', { name: "Masquer l'annonce" }));

    expect(screen.queryByLabelText('Titre')).not.toBeInTheDocument();
  });
});
