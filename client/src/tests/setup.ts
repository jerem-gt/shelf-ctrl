import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import i18n, { initPromise } from '../i18n';
import { server } from './msw/server';

beforeAll(async () => {
  await initPromise;
  await i18n.changeLanguage('fr');
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(async () => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  if (i18n.language !== 'fr') await i18n.changeLanguage('fr');
});

afterAll(() => {
  server.close();
});
