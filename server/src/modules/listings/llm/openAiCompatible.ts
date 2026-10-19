import { z } from 'zod';

import type { FetchFn, LlmProvider } from './types.js';

// Gemini répond en quelques secondes ou reste suspendu : mieux vaut couper vite et réessayer.
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
/** Surcharge ou limite de débit passagère : une nouvelle tentative a de bonnes chances d'aboutir. */
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

const responseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().min(1) }) })).min(1),
});

interface OpenAiCompatibleConfig {
  name: string;
  url: string;
  apiKey: string;
  model: string;
  /** Pause avant chaque nouvelle tentative (0 dans les tests). */
  retryDelayMs?: number;
}

class TransientError extends Error {}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}

/** Groq, Mistral et Gemini exposent tous l'API « chat completions » d'OpenAI. */
export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleConfig,
  fetchFn: FetchFn = fetch,
): LlmProvider {
  const attempt = async (system: string, user: string): Promise<string> => {
    let res: Response;
    try {
      res = await fetchFn(config.url, {
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
    } catch (error) {
      if (isTimeout(error)) {
        throw new TransientError('Délai dépassé');
      }
      throw error;
    }
    if (!res.ok) {
      const message = `HTTP ${res.status}`;
      throw TRANSIENT_STATUSES.has(res.status) ? new TransientError(message) : new Error(message);
    }
    const parsed = responseSchema.safeParse(await res.json());
    if (!parsed.success) {
      throw new Error('Réponse inattendue');
    }
    return parsed.data.choices[0].message.content;
  };

  return {
    name: config.name,
    async completeJson(system, user) {
      for (let tries = 1; ; tries++) {
        try {
          return await attempt(system, user);
        } catch (error) {
          if (!(error instanceof TransientError) || tries >= MAX_ATTEMPTS) {
            throw error;
          }
          const delay = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    },
  };
}
