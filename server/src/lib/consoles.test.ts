import { describe, expect, it } from 'vitest';

import { detectConsole, findConsole, normalizeConsole } from './consoles.js';

describe('findConsole', () => {
  it.each([
    ['PS5', 'PlayStation 5'],
    ['playstation 4', 'PlayStation 4'],
    ['Switch', 'Nintendo Switch'],
    ['Nintendo Switch 2', 'Nintendo Switch 2'],
    ['Xbox Series X|S', 'Xbox Series X|S'],
    ['PC (Microsoft Windows)', 'PC'],
    ['Sega Mega Drive/Genesis', 'Mega Drive'],
    ['Super Nintendo Entertainment System', 'Super Nintendo'],
    ['Nintendo Entertainment System', 'NES'],
    ['GBA', 'Game Boy Advance'],
    ['3DS', 'Nintendo 3DS'],
  ])('reconnaît « %s »', (value, expected) => {
    expect(findConsole(value)).toBe(expected);
  });

  it('renvoie null pour une console inconnue', () => {
    expect(findConsole('Atari Jaguar')).toBeNull();
  });
});

describe('normalizeConsole', () => {
  it('garde une console inconnue telle quelle, bornée', () => {
    expect(normalizeConsole('  ps4 ')).toBe('PlayStation 4');
    expect(normalizeConsole('Atari Jaguar')).toBe('Atari Jaguar');
    expect(normalizeConsole('x'.repeat(80))).toHaveLength(50);
    expect(normalizeConsole('   ')).toBeNull();
  });
});

describe('detectConsole', () => {
  it.each([
    ['Super Mario Odyssey - Nintendo Switch', 'Nintendo Switch'],
    ['Mario Kart World (Nintendo Switch 2)', 'Nintendo Switch 2'],
    ['FIFA 23 PS4', 'PlayStation 4'],
    ['Gran Turismo 7 [PlayStation 5]', 'PlayStation 5'],
    ['Halo 3 Xbox 360', 'Xbox 360'],
    ['Pokemon Rouge Game Boy', 'Game Boy'],
    ['Zelda Wii U', 'Wii U'],
  ])('lit la console dans « %s »', (title, expected) => {
    expect(detectConsole(title)).toBe(expected);
  });

  it('ignore les formes ambiguës au milieu d’un titre', () => {
    expect(detectConsole('The Switch')).toBeNull();
    expect(detectConsole('Le PC de papa')).toBeNull();
    expect(detectConsole('Alien [Blu-ray]')).toBeNull();
  });
});
