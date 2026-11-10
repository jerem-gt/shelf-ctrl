import { CONSOLE_TEXT_ALIASES } from '../../../lib/consoles.js';
import { trimSeparators } from './video.js';

/** « playstation 4 » → `playstation[\s\-/|]*4` : espaces, tirets ou barres entre les mots. */
const aliasPattern = (alias: string) => alias.split(' ').join(String.raw`[\s\-/|]*`);

// Les plus longues d'abord : « PlayStation 4 » doit partir en entier, pas « PlayStation » seul.
const CONSOLE_WORDS = [...CONSOLE_TEXT_ALIASES]
  .sort((a, b) => b.length - a.length)
  .map(aliasPattern)
  .join('|');
const GAME_WORDS = String.raw`${CONSOLE_WORDS}|video\s*game|jeux?\s*vid[eé]o`;
const BRACKETED_CONSOLE = new RegExp(
  String.raw`\s*[\[(][^\])]*\b(?:${GAME_WORDS})\b[^\])]*[\])]`,
  'gi',
);
const BARE_CONSOLE = new RegExp(String.raw`\s*[-–:,/+]?\s*\b(?:${GAME_WORDS})\b`, 'gi');

/** Retire console et mention « jeu vidéo » du titre d'un produit pour ne garder que le jeu. */
export function cleanGameTitle(title: string): string {
  const cleaned = title
    .replaceAll(BRACKETED_CONSOLE, '')
    .replaceAll(BARE_CONSOLE, '')
    .replaceAll(/\s{2,}/g, ' ');
  return trimSeparators(cleaned) || title.trim();
}
