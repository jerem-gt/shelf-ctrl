import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

import { initPromise } from '../i18n';

beforeAll(async () => {
  await initPromise;
});

afterEach(() => {
  cleanup();
});
