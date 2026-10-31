import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next';

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
