import type { CopyItem } from '@shelfctrl/types';
import { describe, expect, it } from 'vitest';

import i18n from '@/i18n';
import { COPY_ALIEN, COPY_TINTIN } from '@/tests/fixtures';

import { buildListingDraft } from './listing';
import { titleLimit } from './platforms';

const build = (copy: CopyItem, platform: string | null = 'Vinted') =>
  buildListingDraft(copy, platform, i18n.t);

function withWork(work: Partial<CopyItem['work']>, copy: CopyItem = COPY_TINTIN): CopyItem {
  return { ...copy, work: { ...copy.work, ...work } };
}

describe('buildListingDraft — titre', () => {
  it('assemble tome, titre, état et auteur quand ça tient', () => {
    expect(build(COPY_TINTIN).title).toBe('Tome 20 - Tintin au Tibet - Très bon état - Hergé');
  });

  it('place la série en tête quand le titre ne la contient pas', () => {
    const copy = withWork({ title: 'Le Tour de Gaule', series: 'Astérix', volumeNumber: 5 });

    expect(build(copy).title).toBe('Astérix - Tome 5 - Le Tour de Gaule - Très bon état - Hergé');
  });

  it('indique le support pour un film, sans tome ni série', () => {
    expect(build(COPY_ALIEN).title).toBe('Alien - Blu-ray - Bon état');
  });

  it('abandonne d’abord les auteurs, puis l’état, selon la limite de la plateforme', () => {
    const copy = withWork({ title: 'Les Aventures extraordinaires de Tintin au Tibet' });
    const lead = 'Tome 20 - Les Aventures extraordinaires de Tintin au Tibet';

    expect(build(copy, 'Vinted').title).toBe(lead);
    expect(build(copy, 'eBay').title).toBe(`${lead} - Très bon état`);
  });

  it('coupe un titre trop long à un mot entier, avec une ellipse', () => {
    const copy = withWork({
      title: 'Une très longue histoire de pirates, de trésors enfouis et de grands voyages',
      series: null,
      volumeNumber: null,
    });

    const { title } = build(copy, 'Vinted');

    expect(title).toBe('Une très longue histoire de pirates, de trésors enfouis et…');
    expect(title.length).toBeLessThanOrEqual(titleLimit('Vinted'));
  });

  it('applique la limite par défaut à une plateforme inconnue ou absente', () => {
    expect(titleLimit('Vinted')).toBe(60);
    expect(titleLimit(' LEBONCOIN ')).toBe(70);
    expect(titleLimit('Momox')).toBe(80);
    expect(titleLimit(null)).toBe(80);
  });
});

describe('buildListingDraft — description', () => {
  it('liste les champs renseignés puis l’état', () => {
    expect(build(COPY_TINTIN).description).toBe(
      [
        'Tintin au Tibet',
        '',
        'Série : Tintin, tome 20',
        'Auteurs / réalisateurs : Hergé',
        'Éditeur : Casterman',
        'Support : Livre / BD',
        'Code-barres : 9782203001190',
        '',
        'État : Très bon état',
      ].join('\n'),
    );
  });

  it('omet les champs vides', () => {
    expect(build(COPY_ALIEN).description).toBe(
      ['Alien', '', 'Support : Blu-ray', '', 'État : Bon état'].join('\n'),
    );
  });

  it('reprend la note d’état, et l’éditeur avec son année', () => {
    const copy: CopyItem = {
      ...COPY_TINTIN,
      conditionNote: 'coins un peu écornés',
      edition: { ...COPY_TINTIN.edition, releaseYear: 2006 },
    };

    const { description } = build(copy);

    expect(description).toContain('Éditeur : Casterman (2006)');
    expect(description).toContain('État : Très bon état\nPrécisions : coins un peu écornés');
  });

  it('traduit la langue connue et affiche le code des autres', () => {
    const language = (code: string): CopyItem => ({
      ...COPY_TINTIN,
      edition: { ...COPY_TINTIN.edition, language: code },
    });

    expect(build(language('fr')).description).toContain('Langue : français');
    expect(build(language('pt')).description).toContain('Langue : PT');
  });

  it('ne dépend pas de la plateforme', () => {
    expect(build(COPY_TINTIN, 'Vinted').description).toBe(build(COPY_TINTIN, 'eBay').description);
  });
});
