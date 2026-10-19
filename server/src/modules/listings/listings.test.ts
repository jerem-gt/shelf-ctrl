import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.js';
import { createDb, initDatabase } from '../../db/init.js';
import { createLlmProvider } from './llm/index.js';
import type { LlmProvider } from './llm/types.js';

function setup(llmProvider: LlmProvider | null) {
  const db = createDb(':memory:');
  initDatabase(db);
  return createApp(db, { barcodeProviders: [], llmProvider });
}

type TestApp = ReturnType<typeof setup>;

const fakeLlm = (reply: string) => {
  const completeJson = vi.fn().mockResolvedValue(reply);
  return { provider: { name: 'fake', completeJson } satisfies LlmProvider, completeJson };
};

async function createCopy(app: TestApp) {
  const res = await request(app)
    .post('/api/copies')
    .send({
      work: { title: 'Tintin au Tibet', series: 'Tintin', volumeNumber: 20 },
      edition: { format: 'book', publisher: 'Casterman' },
      condition: 'good',
      conditionNote: 'coins un peu écornés',
    });
  return res.body.id as number;
}

const draft = (app: TestApp, copyId: number, body: object = {}) =>
  request(app).post(`/api/copies/${copyId}/listing-draft`).send(body);

describe('POST /api/copies/:id/listing-draft', () => {
  it('génère un brouillon à partir de la fiche de l’exemplaire', async () => {
    const { provider, completeJson } = fakeLlm(
      JSON.stringify({ title: 'Tintin au Tibet', description: 'Bon état.', priceEuros: 8.5 }),
    );
    const app = setup(provider);
    const copyId = await createCopy(app);

    const res = await draft(app, copyId, { platform: 'Vinted' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      title: 'Tintin au Tibet',
      description: 'Bon état.',
      suggestedPriceCents: 850,
    });
    const userPrompt = completeJson.mock.calls[0][1] as string;
    expect(userPrompt).toContain('Titre : Tintin au Tibet');
    expect(userPrompt).toContain('Tome : 20');
    expect(userPrompt).toContain('Éditeur : Casterman');
    expect(userPrompt).toContain('État : bon état');
    expect(userPrompt).toContain('Précision sur l’état : coins un peu écornés');
    expect(userPrompt).toContain('Plateforme visée : Vinted');
    expect(userPrompt).not.toContain('Langue');
  });

  it('accepte une estimation de prix absente', async () => {
    const { provider } = fakeLlm(
      JSON.stringify({ title: 'T', description: 'D', priceEuros: null }),
    );
    const app = setup(provider);

    const res = await draft(app, await createCopy(app));

    expect(res.body.suggestedPriceCents).toBeNull();
  });

  it.each([0, -3])('traite une estimation de %s € comme absente', async (priceEuros) => {
    const { provider } = fakeLlm(JSON.stringify({ title: 'T', description: 'D', priceEuros }));
    const app = setup(provider);

    const res = await draft(app, await createCopy(app));

    expect(res.status).toBe(200);
    expect(res.body.suggestedPriceCents).toBeNull();
  });

  it('répond 503 quand aucun fournisseur LLM n’est configuré', async () => {
    const app = setup(null);

    const res = await draft(app, await createCopy(app));

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'llm_not_configured' });
  });

  it('répond 404 pour un exemplaire inconnu', async () => {
    const app = setup(fakeLlm('{}').provider);

    expect((await draft(app, 999)).status).toBe(404);
  });

  it('répond 502 quand le modèle renvoie un contenu inexploitable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = setup(fakeLlm('pas du JSON').provider);

    const res = await draft(app, await createCopy(app));

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'llm_failed' });
  });

  it('répond 502 quand le fournisseur échoue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const completeJson = vi.fn().mockRejectedValue(new Error('HTTP 429'));
    const app = setup({ name: 'fake', completeJson });

    expect((await draft(app, await createCopy(app))).status).toBe(502);
  });

  it('rejette une plateforme vide', async () => {
    const app = setup(fakeLlm('{}').provider);

    expect((await draft(app, await createCopy(app), { platform: '  ' })).status).toBe(400);
  });
});

describe('createLlmProvider', () => {
  it('reste désactivé sans fournisseur ou sans clé', () => {
    expect(createLlmProvider({})).toBeNull();
    expect(createLlmProvider({ LLM_PROVIDER: 'groq' })).toBeNull();
    expect(createLlmProvider({ LLM_API_KEY: 'k' })).toBeNull();
  });

  it('refuse un fournisseur inconnu', () => {
    expect(() => createLlmProvider({ LLM_PROVIDER: 'foo', LLM_API_KEY: 'k' })).toThrow(/foo/);
  });

  it('appelle l’API chat completions du fournisseur avec la clé et le modèle', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"a":1}' } }] })),
      );
    const provider = createLlmProvider(
      { LLM_PROVIDER: 'Mistral', LLM_API_KEY: 'secret', LLM_MODEL: 'mon-modele' },
      fetchFn,
    );

    expect(await provider?.completeJson('sys', 'user')).toBe('{"a":1}');

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.mistral.ai/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret');
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'mon-modele',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'user' },
      ],
    });
  });

  it('lève une erreur sur une réponse HTTP en échec', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }));
    const provider = createLlmProvider({ LLM_PROVIDER: 'groq', LLM_API_KEY: 'k' }, fetchFn);

    await expect(provider?.completeJson('s', 'u')).rejects.toThrow('HTTP 429');
  });
});
