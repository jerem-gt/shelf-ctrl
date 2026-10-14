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

/**
 * Lit la première notice d'une réponse SRU au format `unimarcxchange` (catalogue de la BnF).
 * Un découpage simple suffit : la structure est fixe, et on évite une dépendance XML.
 */
export function parseUnimarc(xml: string): UnimarcFields | null {
  const start = xml.indexOf('<mxc:record');
  if (start === -1) {
    return null;
  }
  const end = xml.indexOf('</mxc:record>', start);
  const record = end === -1 ? xml.slice(start) : xml.slice(start, end);

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

export function subfield(field: Subfield[] | undefined, code: string): string | undefined {
  return field?.find((candidate) => candidate.code === code)?.value;
}
