import { afterEach, describe, expect, it } from 'vitest';

import i18n from './i18n';

describe('langue du document', () => {
  afterEach(() => {
    document.head.querySelector('link[rel="manifest"]')?.remove();
  });

  it('suit la langue de l’interface : <html lang> et manifeste PWA', async () => {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.webmanifest';
    document.head.append(link);

    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    expect(link.getAttribute('href')).toBe('/manifest.en.webmanifest');

    await i18n.changeLanguage('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(link.getAttribute('href')).toBe('/manifest.webmanifest');
  });

  it('ramène une variante régionale à sa langue, sans manifeste lié (dev)', async () => {
    await i18n.changeLanguage('en-US');
    expect(document.documentElement.lang).toBe('en');
  });
});
