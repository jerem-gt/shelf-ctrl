export const MIN_PASSWORD_LENGTH = 8;

/** Clé i18n du problème d'un nouveau mot de passe saisi deux fois, `null` s'il convient. */
export function newPasswordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return 'passwordRules.tooShort';
  }
  if (password !== confirm) {
    return 'passwordRules.mismatch';
  }
  return null;
}
