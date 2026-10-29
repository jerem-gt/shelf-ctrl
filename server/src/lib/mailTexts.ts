/** Textes des e-mails (français uniquement, comme l'interface). */
export const MAIL_TEXTS = {
  subject: 'ShelfCtrl : réinitialisation du mot de passe',
  reset: (link: string, minutes: number) =>
    `Bonjour,\n\nPour choisir un nouveau mot de passe ShelfCtrl, ouvrez ce lien (valable ${minutes} minutes) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
  testSubject: 'ShelfCtrl',
  test: "Ceci est un e-mail de test : l'envoi depuis ShelfCtrl fonctionne.",
};
