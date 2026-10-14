import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import common from './locales/fr/common.json';

// Français uniquement pour l'instant. Pour ajouter l'anglais : créer locales/en/*.json
// (miroir exact des clés fr/) et les déclarer ici ou passer en chargement dynamique.
export const initPromise = i18n.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'fr',
  defaultNS: 'common',
  ns: ['common'],
  resources: { fr: { common } },
  interpolation: { escapeValue: false },
});

export { default } from 'i18next';
