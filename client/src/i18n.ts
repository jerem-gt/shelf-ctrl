import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import common from './locales/fr/common.json';
import errors from './locales/fr/errors.json';

// Français uniquement pour l'instant. Pour ajouter l'anglais : créer locales/en/*.json
// (miroir exact des clés fr/) et les déclarer ici ou passer en chargement dynamique.
// `errors` : traduction des codes d'erreur de l'API (cf. server/src/lib/errorCodes.ts).
export const initPromise = i18n.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'fr',
  defaultNS: 'common',
  ns: ['common', 'errors'],
  resources: { fr: { common, errors } },
  interpolation: { escapeValue: false },
});

export { default } from 'i18next';
