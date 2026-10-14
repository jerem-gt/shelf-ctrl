import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { initPromise } from './i18n';

// Après un déploiement PWA, d'anciens chunks peuvent avoir disparu : on recharge pour récupérer
// le nouvel index.html.
globalThis.addEventListener('vite:preloadError', () => {
  globalThis.location.reload();
});

await initPromise;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
