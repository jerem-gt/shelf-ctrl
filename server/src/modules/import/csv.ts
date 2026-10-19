const DELIMITERS = [';', ',', '\t'] as const;
const BOM = '﻿';

/** UTF-8 d'abord ; à défaut (export Excel Windows), Windows-1252. */
export function decodeCsv(buffer: Buffer): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder('windows-1252').decode(buffer);
  }
  return text.startsWith(BOM) ? text.slice(1) : text;
}

/** Le séparateur le plus fréquent de la première ligne, guillemets exclus (`;` en cas d'égalité). */
export function detectDelimiter(text: string): string {
  const counts = new Map<string, number>(DELIMITERS.map((delimiter) => [delimiter, 0]));
  let quoted = false;
  for (const char of text) {
    if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && (char === '\n' || char === '\r')) {
      break;
    } else if (!quoted && counts.has(char)) {
      counts.set(char, (counts.get(char) ?? 0) + 1);
    }
  }
  return DELIMITERS.reduce((best, delimiter) =>
    (counts.get(delimiter) ?? 0) > (counts.get(best) ?? 0) ? delimiter : best,
  );
}

/**
 * Lit un CSV (RFC 4180) : champs entre guillemets, guillemets doublés, retours à la ligne dans un
 * champ. Les lignes entièrement vides sont ignorées.
 */
export function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (row.some((value) => value.trim() !== '')) {
      rows.push(row);
    }
    row = [];
  };

  /** Lit un caractère ; renvoie le nombre de caractères suivants à sauter. */
  const read = (char: string, next: string | undefined): number => {
    if (quoted) {
      if (char !== '"') {
        cell += char;
      } else if (next === '"') {
        cell += '"';
        return 1;
      } else {
        quoted = false;
      }
      return 0;
    }
    if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === delimiter) {
      endCell();
    } else if (char === '\n' || char === '\r') {
      endRow();
      return char === '\r' && next === '\n' ? 1 : 0;
    } else {
      cell += char;
    }
    return 0;
  };

  for (let index = 0; index < text.length; index++) {
    index += read(text[index], text[index + 1]);
  }
  if (cell !== '' || row.length > 0) {
    endRow();
  }
  return rows;
}

/** Valeur d'une cellule protégée pour un export : guillemets si elle contient un séparateur. */
export function toCsvCell(value: string, delimiter = ';'): string {
  return /["\n\r]/.test(value) || value.includes(delimiter)
    ? `"${value.replaceAll('"', '""')}"`
    : value;
}
