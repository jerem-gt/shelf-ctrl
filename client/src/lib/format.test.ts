import { afterEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';

import { currentLang, daysBetween, formatDate, formatIsoDate, localToday } from './format';

describe('formatDate', () => {
  it('lit une date SQLite en UTC et l’affiche au format français', () => {
    expect(formatDate('2026-10-14 10:00:00')).toBe('14/10/2026');
  });
});

describe('dates de prêt', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('donne la date du jour dans le fuseau local, tard le soir comme tôt le matin', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 5, 23, 59));
    expect(localToday()).toBe('2026-10-05');
    vi.setSystemTime(new Date(2026, 0, 3, 0, 1));
    expect(localToday()).toBe('2026-01-03');
  });

  it('affiche une date AAAA-MM-JJ au format français, sans décalage de fuseau', () => {
    expect(formatIsoDate('2026-10-14')).toBe('14/10/2026');
    expect(formatIsoDate('2026-01-01')).toBe('01/01/2026');
  });

  it('suit la langue de l’interface (anglais britannique : jour/mois/année)', async () => {
    await i18n.changeLanguage('en');
    expect(currentLang()).toBe('en');
    expect(formatIsoDate('2026-10-14')).toBe('14/10/2026');
    expect(formatDate('2026-01-05 10:00:00')).toBe('05/01/2026');
  });

  it('compte les jours entre deux dates, y compris au changement d’heure', () => {
    expect(daysBetween('2026-10-01', '2026-10-01')).toBe(0);
    expect(daysBetween('2026-10-01', '2026-10-14')).toBe(13);
    expect(daysBetween('2026-03-20', '2026-04-05')).toBe(16);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
  });
});
