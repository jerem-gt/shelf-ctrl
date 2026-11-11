/**
 * Clés d'identité d'une édition, pour repérer les doublons (aperçu de l'import, résultats de la
 * recherche par titre). Deux éditions de même clé sont tenues pour la même.
 */

/** Une édition à code-barres se reconnaît à lui seul. */
export function barcodeIdentity(barcode: string): string {
  return `code:${barcode}`;
}

/**
 * Sans code-barres, aux champs qui la décrivent (titre, année…), casse ignorée ; `null` vaut une
 * valeur vide. Les champs sont encodés en JSON : un séparateur pourrait figurer dans l'un d'eux
 * (« Xbox Series X|S ») et confondre deux éditions. Le repli de casse se fait en JavaScript, car
 * `lower()` de SQLite ne replie que l'ASCII.
 */
export function titleIdentity(fields: readonly (string | number | null)[]): string {
  return `titre:${JSON.stringify(fields.map((field) => String(field ?? '').toLowerCase()))}`;
}
