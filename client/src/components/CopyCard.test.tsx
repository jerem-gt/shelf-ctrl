import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { COPY_ALIEN, COPY_TINTIN } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { CopyCard } from './CopyCard';

describe('CopyCard', () => {
  it('affiche le titre, la série et le tome, le statut, le format, l’état et l’emplacement', () => {
    renderWithProviders(<CopyCard copy={COPY_TINTIN} />);

    expect(screen.getByRole('heading', { name: 'Tintin au Tibet' })).toBeInTheDocument();
    expect(screen.getByText('Tintin · Tome 20')).toBeInTheDocument();
    expect(screen.getByText('En rayon')).toBeInTheDocument();
    expect(screen.getByText('Livre / BD')).toBeInTheDocument();
    expect(screen.getByText('Très bon état')).toBeInTheDocument();
    expect(screen.getByText('Salon')).toBeInTheDocument();
  });

  it('masque la série et l’emplacement quand ils sont absents', () => {
    renderWithProviders(<CopyCard copy={COPY_ALIEN} />);

    expect(screen.getByRole('heading', { name: 'Alien' })).toBeInTheDocument();
    expect(screen.getByText('Prêté')).toBeInTheDocument();
    expect(screen.getByText('Blu-ray')).toBeInTheDocument();
    expect(screen.queryByText(/Tome/)).not.toBeInTheDocument();
  });

  it('n’affiche pas le tome quand la série n’en a pas', () => {
    renderWithProviders(
      <CopyCard copy={{ ...COPY_TINTIN, work: { ...COPY_TINTIN.work, volumeNumber: null } }} />,
    );
    expect(screen.getByText('Tintin')).toBeInTheDocument();
  });

  it('renvoie vers la fiche de l’exemplaire', () => {
    renderWithProviders(<CopyCard copy={COPY_TINTIN} />);

    expect(screen.getByRole('link', { name: 'Tintin au Tibet' })).toHaveAttribute(
      'href',
      '/copies/1',
    );
  });
});

describe('CopyCard — pochette', () => {
  it('affiche la miniature de la pochette quand l’édition en a une', () => {
    const copy = {
      ...COPY_TINTIN,
      edition: { ...COPY_TINTIN.edition, coverPath: '1-aaaaaaaaaa.webp' },
    };
    const { container } = renderWithProviders(<CopyCard copy={copy} />);

    expect(container.querySelector('img')).toHaveAttribute('src', '/covers/1-aaaaaaaaaa.webp');
  });

  it('se contente d’une icône sans pochette', () => {
    const { container } = renderWithProviders(<CopyCard copy={COPY_TINTIN} />);

    expect(container.querySelector('img')).toBeNull();
  });
});
