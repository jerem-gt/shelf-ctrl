export interface LastUsedParts {
  kind: 'today' | 'yesterday' | 'date';
  time: string;
  date: string;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Décompose un horodatage en « aujourd'hui / hier / date » et heure locale, au format français. */
export function lastUsedParts(timestamp: number, now: Date = new Date()): LastUsedParts {
  const d = new Date(timestamp);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  let kind: LastUsedParts['kind'] = 'date';
  if (sameDay(d, now)) {
    kind = 'today';
  } else if (sameDay(d, yesterday)) {
    kind = 'yesterday';
  }
  return {
    kind,
    time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    date: d.toLocaleDateString('fr-FR'),
  };
}
