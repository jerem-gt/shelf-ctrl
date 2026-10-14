import type { SessionData } from 'express-session';
import { describe, expect, it } from 'vitest';

import { createDb, initDatabase } from './db/init.js';
import { SQLiteSessionStore } from './session-store.js';

function setup() {
  const db = createDb(':memory:');
  initDatabase(db);
  return { db, store: new SQLiteSessionStore(db) };
}

type Store = ReturnType<typeof setup>['store'];

const sessionWith = (cookie: Partial<SessionData['cookie']>, userId = 1): SessionData => ({
  cookie: { originalMaxAge: null, ...cookie },
  userId,
});

const get = (store: Store, sid: string) =>
  new Promise<{ err: unknown; session?: SessionData | null }>((resolve) => {
    store.get(sid, (err, session) => resolve({ err, session }));
  });

const call = (run: (done: (err?: unknown) => void) => void) =>
  new Promise<unknown>((resolve) => run((err) => resolve(err)));

describe('SQLiteSessionStore', () => {
  it('enregistre et relit une session', async () => {
    const { store } = setup();
    const session = sessionWith({ maxAge: 60_000 });

    expect(await call((done) => store.set('abc', session, done))).toBeUndefined();

    const { session: loaded } = await get(store, 'abc');
    expect(loaded?.userId).toBe(1);
  });

  it('ne renvoie rien pour une session inconnue', async () => {
    const { store } = setup();
    expect((await get(store, 'absente')).session).toBeNull();
  });

  it('ne renvoie plus une session expirée', async () => {
    const { store } = setup();
    await call((done) =>
      store.set('old', sessionWith({ expires: new Date(Date.now() - 1000) }), done),
    );

    expect((await get(store, 'old')).session).toBeNull();
  });

  it('applique une durée par défaut quand le cookie n’en précise pas', async () => {
    const { store } = setup();
    await call((done) => store.set('default', sessionWith({}), done));

    expect((await get(store, 'default')).session?.userId).toBe(1);
  });

  it('supprime une session', async () => {
    const { store } = setup();
    await call((done) => store.set('abc', sessionWith({ maxAge: 60_000 }), done));

    await call((done) => store.destroy('abc', done));

    expect((await get(store, 'abc')).session).toBeNull();
  });

  it('prolonge une session avec touch', async () => {
    const { store, db } = setup();
    await call((done) => store.set('abc', sessionWith({ maxAge: 1000 }), done));
    const before = db.prepare('SELECT expires_at FROM sessions').get() as { expires_at: number };

    await call((done) => store.touch('abc', sessionWith({ maxAge: 10 * 60_000 }), done));

    const after = db.prepare('SELECT expires_at FROM sessions').get() as { expires_at: number };
    expect(after.expires_at).toBeGreaterThan(before.expires_at + 60_000);
  });

  it('accepte les appels sans rappel', () => {
    const { store } = setup();
    expect(() => {
      store.set('abc', sessionWith({ maxAge: 1000 }));
      store.touch('abc', sessionWith({ maxAge: 1000 }));
      store.destroy('abc');
    }).not.toThrow();
  });

  it('remonte les erreurs de la base au lieu de les lever', async () => {
    const { store, db } = setup();
    db.close();

    expect((await get(store, 'abc')).err).toBeInstanceOf(Error);
    expect(await call((done) => store.set('abc', sessionWith({}), done))).toBeInstanceOf(Error);
    expect(await call((done) => store.destroy('abc', done))).toBeInstanceOf(Error);
    expect(await call((done) => store.touch('abc', sessionWith({}), done))).toBeInstanceOf(Error);
  });

  it('remonte une erreur quand le contenu stocké est corrompu', async () => {
    const { store, db } = setup();
    db.prepare("INSERT INTO sessions (sid, data, expires_at) VALUES ('bad', 'pas du json', ?)").run(
      Date.now() + 60_000,
    );

    expect((await get(store, 'bad')).err).toBeInstanceOf(Error);
  });
});
