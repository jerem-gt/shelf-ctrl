import { describe, expect, it } from 'vitest';

import { MAIL_TEXTS } from './mailTexts.js';

describe('MAIL_TEXTS', () => {
  it('écrit le lien de réinitialisation dans la langue demandée', () => {
    const fr = MAIL_TEXTS.reset('fr', 'https://shelf/reset?t=1', 30);
    const en = MAIL_TEXTS.reset('en', 'https://shelf/reset?t=1', 30);

    expect(fr.subject).toContain('réinitialisation');
    expect(fr.text).toContain('valable 30 minutes');
    expect(en.subject).toBe('ShelfCtrl: password reset');
    expect(en.text).toContain('valid for 30 minutes');
    expect(en.text).toContain('https://shelf/reset?t=1');
  });

  it('envoie un e-mail de test bilingue', () => {
    const { text } = MAIL_TEXTS.test();

    expect(text).toContain("l'envoi depuis ShelfCtrl fonctionne");
    expect(text).toContain('sending from ShelfCtrl works');
  });
});
