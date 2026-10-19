import type { CopyItem } from '@shelfctrl/types';
import type { TFunction } from 'i18next';

import { titleLimit } from './platforms';

export interface ListingDraft {
  title: string;
  description: string;
}

const TITLE_SEPARATOR = ' - ';
const ELLIPSIS = '…';

/** Coupe au dernier mot entier qui tient dans `max` caractères, ellipse comprise. */
function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const room = text.slice(0, max - ELLIPSIS.length);
  const lastSpace = room.lastIndexOf(' ');
  const cut = lastSpace > max / 2 ? room.slice(0, lastSpace) : room;
  return `${cut.trimEnd()}${ELLIPSIS}`;
}

/**
 * Titre : le plus utile d'abord (série, tome, titre, support), puis l'état et les auteurs tant
 * que la limite de la plateforme le permet. Les derniers éléments sautent en premier.
 */
function buildTitle(copy: CopyItem, platform: string | null, t: TFunction): string {
  const { work, edition } = copy;
  const lead: string[] = [];
  // Inutile de répéter la série quand le titre la contient déjà (« Tintin au Tibet »).
  if (work.series && !work.title.toLowerCase().includes(work.series.toLowerCase())) {
    lead.push(work.series);
  }
  if (work.volumeNumber !== null) {
    lead.push(t('collection.volume', { number: work.volumeNumber }));
  }
  lead.push(work.title);
  if (edition.format !== 'book') {
    lead.push(t(`formats.${edition.format}`));
  }

  const optional = [t(`conditions.${copy.condition}`), work.creators].filter(
    (part): part is string => Boolean(part),
  );
  const max = titleLimit(platform);
  const parts = [lead.join(TITLE_SEPARATOR), ...optional];
  while (parts.length > 1 && parts.join(TITLE_SEPARATOR).length > max) {
    parts.pop();
  }
  return truncate(parts.join(TITLE_SEPARATOR), max);
}

function describeSeries(copy: CopyItem, t: TFunction): string | null {
  const { series, volumeNumber } = copy.work;
  if (series && volumeNumber !== null) {
    return t('listing.seriesWithVolume', { series, number: volumeNumber });
  }
  if (series) {
    return t('listing.series', { series });
  }
  if (volumeNumber !== null) {
    return t('listing.volume', { number: volumeNumber });
  }
  return null;
}

function describePublisher(copy: CopyItem, t: TFunction): string | null {
  const { publisher, releaseYear } = copy.edition;
  if (publisher && releaseYear) {
    return t('listing.publisherWithYear', { publisher, year: releaseYear });
  }
  if (publisher) {
    return t('listing.publisher', { publisher });
  }
  return releaseYear ? t('listing.year', { year: releaseYear }) : null;
}

/** Les lignes renseignées, séparées par des retours à la ligne ; les champs vides sont omis. */
function buildDescription(copy: CopyItem, t: TFunction): string {
  const { work, edition } = copy;
  const language = edition.language
    ? t(`listing.languages.${edition.language}`, { defaultValue: edition.language.toUpperCase() })
    : null;

  const details = [
    describeSeries(copy, t),
    work.creators ? t('listing.creators', { creators: work.creators }) : null,
    describePublisher(copy, t),
    t('listing.format', { format: t(`formats.${edition.format}`) }),
    language ? t('listing.language', { language }) : null,
    edition.barcode ? t('listing.barcode', { barcode: edition.barcode }) : null,
  ].filter((line): line is string => line !== null);

  const condition = [
    t('listing.condition', { condition: t(`conditions.${copy.condition}`) }),
    copy.conditionNote ? t('listing.conditionNote', { note: copy.conditionNote }) : null,
  ].filter((line): line is string => line !== null);

  return [work.title, details.join('\n'), condition.join('\n')].join('\n\n');
}

/** Brouillon d'annonce à coller sur la plateforme : un gabarit, sans réseau ni IA. */
export function buildListingDraft(
  copy: CopyItem,
  platform: string | null,
  t: TFunction,
): ListingDraft {
  return { title: buildTitle(copy, platform, t), description: buildDescription(copy, t) };
}
