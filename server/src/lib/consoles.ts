import { CONSOLE_MAX_LENGTH, GAME_CONSOLES, type GameConsole } from '@shelfctrl/types';

/** Minuscules, sans accents, tout ce qui n'est pas alphanumérique réduit à une espace. */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface ConsoleAliases {
  /** Reconnus aussi au milieu d'un intitulé (« Super Mario Odyssey - Nintendo Switch »). */
  inText: readonly string[];
  /** Reconnus seulement comme valeur entière (cellule d'import, plateforme IGDB) : trop ambigus dans un titre. */
  exact?: readonly string[];
}

/**
 * Formes repliées (cf. `fold`) de chaque console : libellés courants, abréviations et noms des
 * plateformes IGDB (« PC (Microsoft Windows) », « Sega Mega Drive/Genesis »…).
 */
const ALIASES: Record<GameConsole, ConsoleAliases> = {
  'PlayStation 5': { inText: ['playstation 5', 'ps5'] },
  'PlayStation 4': { inText: ['playstation 4', 'ps4'] },
  'PlayStation 3': { inText: ['playstation 3', 'ps3'] },
  'PlayStation 2': { inText: ['playstation 2', 'ps2'] },
  'PS Vita': { inText: ['ps vita', 'playstation vita', 'psvita'] },
  PSP: { inText: ['psp', 'playstation portable'] },
  PlayStation: { inText: ['playstation', 'ps1', 'psone', 'ps one'] },
  'Nintendo Switch 2': { inText: ['nintendo switch 2'], exact: ['switch 2'] },
  'Nintendo Switch': { inText: ['nintendo switch'], exact: ['switch'] },
  'Wii U': { inText: ['wii u', 'nintendo wii u'] },
  Wii: { inText: ['wii', 'nintendo wii'] },
  GameCube: { inText: ['gamecube', 'nintendo gamecube', 'game cube'], exact: ['ngc'] },
  'Nintendo 64': { inText: ['nintendo 64', 'n64'] },
  'Super Nintendo': {
    inText: ['super nintendo', 'snes', 'super nintendo entertainment system', 'super famicom'],
  },
  NES: { inText: ['nintendo entertainment system'], exact: ['nes', 'famicom'] },
  'Nintendo 3DS': { inText: ['nintendo 3ds', '3ds', 'new nintendo 3ds', 'nintendo 2ds'] },
  'Nintendo DS': { inText: ['nintendo ds', 'nintendo dsi'], exact: ['ds', 'dsi'] },
  'Game Boy Advance': { inText: ['game boy advance', 'gameboy advance', 'gba'] },
  'Game Boy Color': { inText: ['game boy color', 'gameboy color', 'gbc'] },
  'Game Boy': { inText: ['game boy', 'gameboy'], exact: ['gb'] },
  'Xbox Series X|S': {
    inText: ['xbox series x s', 'xbox series x', 'xbox series s', 'xbox series'],
  },
  'Xbox One': { inText: ['xbox one'] },
  'Xbox 360': { inText: ['xbox 360'] },
  Xbox: { inText: ['xbox'] },
  PC: { inText: ['pc dvd rom', 'pc cd rom', 'pc microsoft windows'], exact: ['pc', 'windows'] },
  Dreamcast: { inText: ['dreamcast', 'sega dreamcast'] },
  Saturn: { inText: ['sega saturn'], exact: ['saturn'] },
  'Mega Drive': { inText: ['mega drive', 'megadrive', 'sega genesis', 'sega mega drive genesis'] },
  'Master System': {
    inText: ['master system', 'sega master system', 'sega master system mark iii'],
  },
};

/**
 * Consoles dans l'ordre de `GAME_CONSOLES` : les plus précises d'abord (« PlayStation 4 » avant
 * « PlayStation », « Game Boy Advance » avant « Game Boy »), la première trouvée l'emporte.
 */
const ENTRIES = GAME_CONSOLES.map((name) => ({ name, ...ALIASES[name] }));

/** Formes reconnues au milieu d'un intitulé, toutes consoles confondues (nettoyage des titres). */
export const CONSOLE_TEXT_ALIASES: readonly string[] = ENTRIES.flatMap(({ inText }) => inText);

/** Console connue dont une forme vaut exactement `value`, sinon `null`. */
export function findConsole(value: string): GameConsole | null {
  const folded = fold(value);
  const entry = ENTRIES.find(
    ({ name, inText, exact = [] }) =>
      fold(name) === folded || inText.includes(folded) || exact.includes(folded),
  );
  return entry?.name ?? null;
}

/**
 * Console saisie (import, source en ligne) : le nom connu quand on la reconnaît, sinon le texte
 * tel quel, borné ; `null` pour une valeur vide.
 */
export function normalizeConsole(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  return findConsole(trimmed) ?? trimmed.slice(0, CONSOLE_MAX_LENGTH);
}

/** Console citée dans un intitulé de produit, sans les formes ambiguës (« switch », « pc »). */
export function detectConsole(text: string): GameConsole | null {
  const padded = ` ${fold(text)} `;
  const entry = ENTRIES.find(({ inText }) => inText.some((alias) => padded.includes(` ${alias} `)));
  return entry?.name ?? null;
}
