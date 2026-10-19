import { createOpenAiCompatibleProvider } from './openAiCompatible.js';
import type { FetchFn, LlmProvider } from './types.js';

export interface LlmEnv {
  /** `gemini`, `groq` ou `mistral` ; sans fournisseur ou sans clé, la génération d'annonces est désactivée. */
  LLM_PROVIDER?: string;
  LLM_API_KEY?: string;
  /** Remplace le modèle par défaut du fournisseur. */
  LLM_MODEL?: string;
}

const PROVIDERS = {
  gemini: {
    // Point d'entrée compatible OpenAI de l'API Gemini ; `-latest` suit la version Flash en cours.
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-flash-latest',
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-small-latest',
  },
} as const;

function isKnownProvider(name: string): name is keyof typeof PROVIDERS {
  return name in PROVIDERS;
}

/** `null` : non configuré. Un fournisseur inconnu est une erreur de configuration. */
export function createLlmProvider(
  env: LlmEnv = process.env,
  fetchFn: FetchFn = fetch,
): LlmProvider | null {
  const name = env.LLM_PROVIDER?.trim().toLowerCase();
  const apiKey = env.LLM_API_KEY?.trim();
  if (!name || !apiKey) {
    return null;
  }
  if (!isKnownProvider(name)) {
    throw new Error(
      `LLM_PROVIDER inconnu : « ${name} » (attendu : ${Object.keys(PROVIDERS).join(', ')}).`,
    );
  }
  const { url, model } = PROVIDERS[name];
  return createOpenAiCompatibleProvider(
    { name, url, apiKey, model: env.LLM_MODEL?.trim() || model },
    fetchFn,
  );
}
