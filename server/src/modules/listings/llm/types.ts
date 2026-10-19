export type FetchFn = typeof fetch;

/** Fournisseur de complétion de texte (API distante uniquement : le NAS ne fait pas tourner de modèle). */
export interface LlmProvider {
  name: string;
  /** Renvoie la réponse du modèle, attendue en JSON. Une erreur (réseau, quota…) est levée. */
  completeJson(system: string, user: string): Promise<string>;
}
