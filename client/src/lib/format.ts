/** Date SQLite (`datetime('now')`, UTC, sans fuseau) affichée au format français local. */
export function formatDate(sqliteUtc: string): string {
  return new Date(`${sqliteUtc.replace(' ', 'T')}Z`).toLocaleDateString('fr-FR');
}
