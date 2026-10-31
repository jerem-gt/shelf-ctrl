import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';

import { announceSetupToken, SetupToken } from '@jerem-gt/ctrl-shared/server/setup';
import express from 'express';

import { createApp } from './app.js';
import { createDb, DATA_DIR, initDatabase } from './db/init.js';
import { loadAuthConfig } from './modules/auth/config.js';
import { createDefaultCoverProviders } from './modules/images/covers/covers.service.js';

const PORT = Number.parseInt(process.env.PORT ?? '3001');
const IS_PROD = process.env.NODE_ENV === 'production';
const CLIENT_DIST = path.join(import.meta.dirname, '../../client/dist');

const auth = loadAuthConfig(process.env);

const db = createDb();
initDatabase(db);
if (auth.obsoleteAdminVariables) {
  console.warn(
    '[auth] ADMIN_USER / ADMIN_PASSWORD sont obsolètes et ignorées : les comptes se gèrent dans l’application.',
  );
}

const setupToken = new SetupToken();
announceSetupToken(db, setupToken, (message) => console.log(`[auth] ${message}`));

const app = createApp(db, {
  auth: {
    sessionSecret: auth.sessionSecret,
    secureCookies: auth.secureCookies,
    appUrl: auth.appUrl,
    setupToken,
  },
  images: { dataDir: DATA_DIR, coverProviders: createDefaultCoverProviders() },
  healthExtraCheck: IS_PROD
    ? () => (fs.existsSync(path.join(CLIENT_DIST, 'index.html')) ? null : 'frontend')
    : undefined,
});

app.set('trust proxy', 1);

if (IS_PROD) {
  // Seuls les fichiers de assets/ ont une empreinte dans leur nom : cache immuable 1 an. Les autres
  // (index.html, sw.js, manifestes…) gardent leur nom d'un déploiement à l'autre : revalidés à
  // chaque requête (ETag, 304 s'ils n'ont pas changé).
  app.use(
    express.static(CLIENT_DIST, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (path.relative(CLIENT_DIST, filePath).split(path.sep)[0] !== 'assets') {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );
  app.get('*splat', (_req, res) =>
    res.sendFile(path.join(CLIENT_DIST, 'index.html'), {
      headers: { 'Cache-Control': 'no-cache' },
    }),
  );
}

app.listen(PORT, () => {
  console.log(`shelf-ctrl server listening on :${PORT}`);
});
