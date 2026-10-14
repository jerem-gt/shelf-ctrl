import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';

import express from 'express';

import { createApp } from './app.js';
import { createDb, initDatabase } from './db/init.js';
import { syncAdminUser } from './modules/auth/auth.repo.js';
import { loadAuthConfig } from './modules/auth/config.js';

const PORT = Number.parseInt(process.env.PORT ?? '3001');
const IS_PROD = process.env.NODE_ENV === 'production';
const CLIENT_DIST = path.join(import.meta.dirname, '../../client/dist');

const auth = loadAuthConfig(process.env);

const db = createDb();
initDatabase(db);
console.log(
  `[auth] compte « ${auth.adminUser} » : ${syncAdminUser(db, auth.adminUser, auth.adminPassword)}`,
);

const app = createApp(db, {
  auth: { sessionSecret: auth.sessionSecret, secureCookies: auth.secureCookies },
  healthExtraCheck: IS_PROD
    ? () => (fs.existsSync(path.join(CLIENT_DIST, 'index.html')) ? null : 'frontend')
    : undefined,
});

app.set('trust proxy', 1);

if (IS_PROD) {
  // Assets Vite à noms hashés → cache immuable 1 an ; index.html ne doit jamais être caché
  app.use(
    express.static(CLIENT_DIST, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
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
