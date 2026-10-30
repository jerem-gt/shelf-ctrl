import { describe, expect, it } from 'vitest';

import { buildError, renderMessage } from './errorCodes.js';

describe('renderMessage', () => {
  it('renvoie le message tel quel sans paramètres', () => {
    expect(renderMessage('copy.not_found')).toBe('Exemplaire introuvable');
  });

  it('interpole les paramètres et laisse en place ceux qui manquent', () => {
    expect(renderMessage('import.too_many_rows', { max: 1000 })).toBe(
      'Le fichier dépasse 1000 lignes',
    );
    expect(renderMessage('import.too_many_rows', {})).toBe('Le fichier dépasse {{max}} lignes');
  });
});

describe('buildError', () => {
  it("n'ajoute params que s'il y en a", () => {
    expect(buildError('loan.already_loaned')).toEqual({
      code: 'loan.already_loaned',
      message: 'Cet exemplaire est déjà prêté',
    });
    expect(buildError('import.too_many_rows', { max: 5 })).toEqual({
      code: 'import.too_many_rows',
      message: 'Le fichier dépasse 5 lignes',
      params: { max: 5 },
    });
  });
});
