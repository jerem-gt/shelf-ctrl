/** Date SQLite (`datetime('now')`, UTC, sans fuseau) affichée au format français local. */
export function formatDate(sqliteUtc: string): string {
  return new Date(`${sqliteUtc.replace(' ', 'T')}Z`).toLocaleDateString('fr-FR');
}

/** Date du jour dans le fuseau de l'utilisateur, au format AAAA-MM-JJ. */
export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Date AAAA-MM-JJ (sans heure) affichée au format français, sans décalage de fuseau. */
export function formatIsoDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}

/** Nombre de jours entre deux dates AAAA-MM-JJ. */
export function daysBetween(fromIso: string, toIso: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / msPerDay,
  );
}
