import { consoleOf, isGameFormat } from '@shelfctrl/types';
import { describe, expect, it } from 'vitest';

import { creatorsLabelKey } from './formats';

describe('formats', () => {
  it('ne reconnaît comme jeu vidéo que le format game', () => {
    expect(isGameFormat('game')).toBe(true);
    expect(isGameFormat('bluray')).toBe(false);
    expect(isGameFormat('')).toBe(false);
    expect(isGameFormat(null)).toBe(false);
  });

  it('ne garde une console que pour un jeu vidéo', () => {
    expect(consoleOf('game', 'Nintendo Switch')).toBe('Nintendo Switch');
    expect(consoleOf('game', '')).toBeNull();
    expect(consoleOf('book', 'PS5')).toBeNull();
    expect(consoleOf(null, 'PS5')).toBeNull();
  });

  it('nomme « studio » les auteurs d’un jeu, dans chaque section', () => {
    expect(creatorsLabelKey('add', 'game')).toBe('add.developers');
    expect(creatorsLabelKey('detail', 'dvd')).toBe('detail.creators');
    expect(creatorsLabelKey('listing', 'book')).toBe('listing.creators');
  });
});
