import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { COPY_TINTIN } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { ListingDraftPanel } from './ListingDraftPanel';

const LONG_TITLE = 'Les Aventures extraordinaires de Tintin au Tibet';
const COPY_LONG_TITLE = { ...COPY_TINTIN, work: { ...COPY_TINTIN.work, title: LONG_TITLE } };
const SHOW = "Voir l'annonce à publier";

describe('ListingDraftPanel', () => {
  it('reste replié tant qu’on ne demande rien', () => {
    renderWithProviders(<ListingDraftPanel copy={COPY_TINTIN} platform="Vinted" />);

    expect(screen.getByRole('button', { name: SHOW })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Titre')).not.toBeInTheDocument();
  });

  it('affiche titre et description issus de la fiche de l’exemplaire', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ListingDraftPanel copy={COPY_TINTIN} platform="Vinted" />);

    await user.click(screen.getByRole('button', { name: SHOW }));

    expect(screen.getByLabelText('Titre')).toHaveValue(
      'Tome 20 - Tintin au Tibet - Très bon état - Hergé',
    );
    expect(screen.getByLabelText<HTMLTextAreaElement>('Description').value).toContain(
      'Éditeur : Casterman',
    );
  });

  it('adapte le titre à la limite de la plateforme', async () => {
    const user = userEvent.setup();
    const vinted = renderWithProviders(
      <ListingDraftPanel copy={COPY_LONG_TITLE} platform="Vinted" />,
    );
    await user.click(screen.getByRole('button', { name: SHOW }));
    const onVinted = screen.getByLabelText<HTMLInputElement>('Titre').value;
    vinted.unmount();

    renderWithProviders(<ListingDraftPanel copy={COPY_LONG_TITLE} platform="eBay" />);
    await user.click(screen.getByRole('button', { name: SHOW }));
    const onEbay = screen.getByLabelText<HTMLInputElement>('Titre').value;

    expect(onVinted).toBe(`Tome 20 - ${LONG_TITLE}`);
    expect(onEbay).toBe(`Tome 20 - ${LONG_TITLE} - Très bon état`);
  });

  it('propose d’ouvrir la plateforme connue', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ListingDraftPanel copy={COPY_TINTIN} platform="Vinted" />);

    await user.click(screen.getByRole('button', { name: SHOW }));

    const link = screen.getByRole('link', { name: "Ouvrir Vinted pour publier l'annonce" });
    expect(link).toHaveAttribute('href', 'https://www.vinted.fr/items/new');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it.each([['Autre site'], [null]])('n’affiche pas de lien pour %j', async (platform) => {
    const user = userEvent.setup();
    renderWithProviders(<ListingDraftPanel copy={COPY_TINTIN} platform={platform} />);

    await user.click(screen.getByRole('button', { name: SHOW }));

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Titre')).toBeInTheDocument();
  });

  it('nomme chaque champ par son seul libellé, bouton Copier à part', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ListingDraftPanel copy={COPY_TINTIN} platform="Vinted" />);

    await user.click(screen.getByRole('button', { name: SHOW }));

    expect(screen.getByRole('textbox', { name: 'Titre' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Description' })).toBeInTheDocument();
  });

  it('se replie', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ListingDraftPanel copy={COPY_TINTIN} platform="Vinted" />);

    await user.click(screen.getByRole('button', { name: SHOW }));
    await user.click(screen.getByRole('button', { name: "Masquer l'annonce" }));

    expect(screen.queryByLabelText('Titre')).not.toBeInTheDocument();
  });
});
