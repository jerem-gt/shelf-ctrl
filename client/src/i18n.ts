import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next';

/**
 * La page suit la langue de l'interface : `<html lang>` (lecteurs d'écran, césure) et manifeste
 * PWA (`manifest.en.webmanifest`, généré au build, cf. vite.config.ts), lu à l'installation.
 */
function syncDocumentLanguage(language: string): void {
  // Hors navigateur (tests en environnement Node) : pas de document.
  if (typeof document === 'undefined') return;
  const lang = language.startsWith('en') ? 'en' : 'fr';
  document.documentElement.lang = lang;
  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  manifest?.setAttribute(
    'href',
    lang === 'en' ? '/manifest.en.webmanifest' : '/manifest.webmanifest',
  );
}

// Posé avant l'init, qui choisit la langue (absent en dev : vite-plugin-pwa n'y lie pas de manifeste).
i18n.on('languageChanged', syncDocumentLanguage);

// Langues : fr et en (`locales/<langue>/`, mêmes clés), détectées comme dans cash-ctrl :
// choix mémorisé (localStorage), sinon langue du navigateur, sinon français.
// `errors` : traduction des codes d'erreur de l'API (cf. server/src/lib/errorCodes.ts).
export const initPromise = i18n
  .use(
    resourcesToBackend(
      (language: string, namespace: string) => import(`./locales/${language}/${namespace}.json`),
    ),
  )
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'fr',
    defaultNS: 'common',
    ns: ['common', 'errors'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export { default } from 'i18next';
