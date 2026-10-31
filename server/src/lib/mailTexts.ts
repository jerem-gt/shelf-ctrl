import type { MailTexts } from '@jerem-gt/ctrl-shared/server/auth';
import type { ShelfLang } from '@shelfctrl/types';

const TEXTS: Record<
  ShelfLang,
  { subject: string; reset: (link: string, minutes: number) => string; test: string }
> = {
  fr: {
    subject: 'ShelfCtrl : réinitialisation du mot de passe',
    reset: (link, minutes) =>
      `Bonjour,

Pour choisir un nouveau mot de passe ShelfCtrl, ouvrez ce lien (valable ${minutes} minutes) :
${link}

Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    test: "Ceci est un e-mail de test : l'envoi depuis ShelfCtrl fonctionne.",
  },
  en: {
    subject: 'ShelfCtrl: password reset',
    reset: (link, minutes) =>
      `Hello,

To choose a new ShelfCtrl password, open this link (valid for ${minutes} minutes):
${link}

If you did not request this, you can ignore this message.`,
    test: 'This is a test email: sending from ShelfCtrl works.',
  },
};

/** Textes des e-mails dans la langue demandée ; l'e-mail de test, sans langue connue, est bilingue. */
export const MAIL_TEXTS: MailTexts<ShelfLang> = {
  reset: (lang, link, minutes) => ({
    subject: TEXTS[lang].subject,
    text: TEXTS[lang].reset(link, minutes),
  }),
  test: () => ({
    subject: 'ShelfCtrl',
    text: `${TEXTS.fr.test}

${TEXTS.en.test}`,
  }),
};
