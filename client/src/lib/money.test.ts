import { describe, expect, it } from 'vitest';

import i18n from '@/i18n';

import { formatPrice, parsePrice, priceToInput } from './money';

describe('parsePrice', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['12.50', 1250],
    ['0,99', 99],
    ['  7 ', 700],
    ['0', 0],
    ['19,99', 1999],
  ])('lit « %s » comme %i centimes', (input, cents) => {
    expect(parsePrice(input)).toBe(cents);
  });

  it.each([[''], ['   '], ['abc'], ['12,345'], ['-5'], ['1 2'], ['12,'], [',5']])(
    'renvoie null pour « %s » (pas de prix)',
    (input) => {
      expect(parsePrice(input)).toBeNull();
    },
  );
});

describe('priceToInput', () => {
  it('préremplit un champ en euros avec la virgule, ou le laisse vide', () => {
    expect(priceToInput(1250)).toBe('12,50');
    expect(priceToInput(5)).toBe('0,05');
    expect(priceToInput(1200)).toBe('12,00');
    expect(priceToInput(null)).toBe('');
  });
});

describe('formatPrice', () => {
  it('affiche un montant en euros au format français', () => {
    expect(formatPrice(1250)).toMatch(/^12,50\s€$/);
    expect(formatPrice(0)).toMatch(/^0,00\s€$/);
    expect(formatPrice(123456)).toMatch(/^1\s234,56\s€$/);
  });

  it('suit la langue de l’interface en anglais (prix et champ au point décimal)', async () => {
    await i18n.changeLanguage('en');
    expect(formatPrice(123456)).toBe('€1,234.56');
    expect(priceToInput(1250)).toBe('12.50');
  });
});
