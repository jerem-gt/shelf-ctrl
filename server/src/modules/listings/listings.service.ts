import type { CopyItem, ListingDraft } from '@shelfctrl/types';
import { z } from 'zod';

import type { LlmProvider } from './llm/types.js';

const SYSTEM_PROMPT = `Tu rédiges des annonces de revente d'occasion en français (Vinted, Leboncoin, eBay…) pour des BD, DVD et Blu-ray.
Règles : reste factuel, n'invente aucun détail absent des informations fournies (édition, année, contenu, défauts), décris honnêtement l'état, ton simple et chaleureux, sans émojis ni majuscules abusives.
Réponds uniquement par un objet JSON : {"title": string (80 caractères maximum), "description": string, "priceEuros": number | null}.
"priceEuros" est une estimation prudente du prix d'occasion en euros, ou null si tu ne peux pas l'estimer.`;

const CONDITION_LABELS: Record<CopyItem['condition'], string> = {
  new: 'neuf',
  very_good: 'très bon état',
  good: 'bon état',
  acceptable: 'état correct',
  poor: 'mauvais état',
};

const FORMAT_LABELS: Record<CopyItem['edition']['format'], string> = {
  book: 'livre / BD',
  dvd: 'DVD',
  bluray: 'Blu-ray',
  uhd4k: '4K UHD',
};

const draftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  priceEuros: z.number().min(0).max(100_000).nullish(),
});

export class ListingGenerationError extends Error {}

/** Informations connues de l'exemplaire, une par ligne, sans les champs vides. */
export function describeCopy(copy: CopyItem, platform?: string): string {
  const { work, edition } = copy;
  const lines: [string, string | number | null][] = [
    ['Titre', work.title],
    ['Série', work.series],
    ['Tome', work.volumeNumber],
    ['Auteurs / réalisateurs', work.creators],
    ['Année de l’œuvre', work.year],
    ['Support', FORMAT_LABELS[edition.format]],
    ['Éditeur', edition.publisher],
    ['Année de l’édition', edition.releaseYear],
    ['Langue', edition.language],
    ['État', CONDITION_LABELS[copy.condition]],
    ['Précision sur l’état', copy.conditionNote],
    ['Plateforme visée', platform ?? null],
  ];
  return lines
    .filter(([, value]) => value !== null && value !== '')
    .map(([label, value]) => `${label} : ${value}`)
    .join('\n');
}

function parseDraft(raw: string): ListingDraft {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ListingGenerationError('Réponse du modèle illisible');
  }
  const parsed = draftSchema.safeParse(json);
  if (!parsed.success) {
    throw new ListingGenerationError('Réponse du modèle invalide');
  }
  const { title, description, priceEuros } = parsed.data;
  return {
    title,
    description,
    suggestedPriceCents: priceEuros == null ? null : Math.round(priceEuros * 100),
  };
}

export function createListingsService(llm: LlmProvider) {
  return {
    async generate(copy: CopyItem, platform?: string): Promise<ListingDraft> {
      let raw: string;
      try {
        raw = await llm.completeJson(SYSTEM_PROMPT, describeCopy(copy, platform));
      } catch (error) {
        throw new ListingGenerationError(
          error instanceof Error ? error.message : 'Échec du modèle',
        );
      }
      return parseDraft(raw);
    },
  };
}
