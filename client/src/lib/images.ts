/** URL d'une pochette stockée par le serveur ; `null` quand l'édition n'en a pas. */
export function coverUrl(coverPath: string | null): string | null {
  return coverPath === null ? null : `/covers/${coverPath}`;
}

/** URL de la photo d'un exemplaire ; `null` quand il n'en a pas. */
export function photoUrl(photoPath: string | null): string | null {
  return photoPath === null ? null : `/photos/${photoPath}`;
}
