import { describe, expect, it } from 'vitest';

import enCommon from './en/common.json';
import enErrors from './en/errors.json';
import frCommon from './fr/common.json';
import frErrors from './fr/errors.json';

type Tree = { [key: string]: string | Tree };

/** Chaque clé feuille, avec les variables `{{…}}` de son texte. */
function leaves(tree: Tree, prefix = ''): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const [key, value] of Object.entries(tree)) {
    const path = `${prefix}${key}`;
    if (typeof value === 'string') {
      const variables = [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]);
      result.set(
        path,
        variables.toSorted((a, b) => a.localeCompare(b)),
      );
    } else {
      for (const [child, variables] of leaves(value, `${path}.`)) {
        result.set(child, variables);
      }
    }
  }
  return result;
}

describe.each([
  ['common', frCommon, enCommon],
  ['errors', frErrors, enErrors],
])('traduction anglaise de %s', (_namespace, fr, en) => {
  it('a exactement les clés du français, avec les mêmes variables', () => {
    expect(Object.fromEntries(leaves(en))).toEqual(Object.fromEntries(leaves(fr)));
  });
});
