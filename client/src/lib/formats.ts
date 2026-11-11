import { isGameFormat, type MediaFormat } from '@shelfctrl/types';

/**
 * Clé du libellé des auteurs dans une section des traductions : un jeu vidéo a un studio
 * (`<section>.developers`), les autres formats des auteurs ou réalisateurs (`<section>.creators`).
 */
export function creatorsLabelKey<S extends 'add' | 'detail' | 'listing'>(
  section: S,
  format: MediaFormat,
): `${S}.developers` | `${S}.creators` {
  return isGameFormat(format) ? `${section}.developers` : `${section}.creators`;
}
