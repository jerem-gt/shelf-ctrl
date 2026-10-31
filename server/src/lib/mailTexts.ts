import type { MailTexts } from '@jerem-gt/ctrl-shared/server/auth';
import type { ShelfLang } from '@shelfctrl/types';

/** Textes des e-mails (français uniquement, comme l'interface). */
export const MAIL_TEXTS: MailTexts<ShelfLang> = {
  reset: (_lang, link, minutes) => ({
    subject: 'ShelfCtrl : réinitialisation du mot de passe',
    text: `Bonjour,

Pour choisir un nouveau mot de passe ShelfCtrl, ouvrez ce lien (valable ${minutes} minutes) :
${link}

Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
  }),
  test: () => ({
    subject: 'ShelfCtrl',
    text: "Ceci est un e-mail de test : l'envoi depuis ShelfCtrl fonctionne.",
  }),
};
