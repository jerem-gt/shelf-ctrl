import { z } from 'zod';

import type { FetchFn, LlmProvider } from './types.js';

const REQUEST_TIMEOUT_MS = 30_000;

const responseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().min(1) }) })).min(1),
});

interface OpenAiCompatibleConfig {
  name: string;
  url: string;
  apiKey: string;
  model: string;
}

/** Groq et Mistral exposent tous deux l'API « chat completions » d'OpenAI. */
export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleConfig,
  fetchFn: FetchFn = fetch,
): LlmProvider {
  return {
    name: config.name,
    async completeJson(system, user) {
      const res = await fetchFn(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.4,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const parsed = responseSchema.safeParse(await res.json());
      if (!parsed.success) {
        throw new Error('Réponse inattendue');
      }
      return parsed.data.choices[0].message.content;
    },
  };
}
