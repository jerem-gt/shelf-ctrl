export interface Subfield {
  code: string;
  value: string;
}

/** Zones d'une notice UNIMARC : une étiquette peut se répéter, d'où un tableau de zones. */
export type UnimarcFields = Map<string, Subfield[][]>;

const SUBFIELD = /<mxc:subfield code="(\w)">([^<]*)<\/mxc:subfield>/g;

function decodeXml(value: string): string {
  return value
    .replaceAll(/&#x([0-9a-f]+);/gi, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replaceAll(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function parseRecord(record: string): UnimarcFields {
  const fields: UnimarcFields = new Map();
  for (const chunk of record.split('<mxc:datafield ').slice(1)) {
    const tag = /^tag="(\d{3})"/.exec(chunk)?.[1];
    if (!tag) {
      continue;
    }
    const subfields = [...chunk.matchAll(SUBFIELD)]
      .map((match) => ({ code: match[1], value: decodeXml(match[2]).trim() }))
      .filter((subfield) => subfield.value !== '');
    fields.set(tag, [...(fields.get(tag) ?? []), subfields]);
  }
  return fields;
}

/**
 * Lit les notices d'une réponse SRU au format `unimarcxchange` (catalogue de la BnF).
 * Un découpage simple suffit : la structure est fixe, et on évite une dépendance XML.
 */
export function parseUnimarcRecords(xml: string): UnimarcFields[] {
  return xml
    .split(/<mxc:record(?=[\s>])/)
    .slice(1)
    .map((chunk) => parseRecord(chunk.split('</mxc:record>')[0]));
}

/** Première notice de la réponse, ou `null` si elle n'en contient aucune. */
export function parseUnimarc(xml: string): UnimarcFields | null {
  return parseUnimarcRecords(xml)[0] ?? null;
}

export function subfield(field: Subfield[] | undefined, code: string): string | undefined {
  return field?.find((candidate) => candidate.code === code)?.value;
}
