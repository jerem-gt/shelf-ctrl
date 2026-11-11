import type { MediaKind } from '@shelfctrl/types';
import { BookOpen, Clapperboard, Gamepad2, type LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';

const ICONS: Record<MediaKind, ComponentType<LucideProps>> = {
  book: BookOpen,
  movie: Clapperboard,
  game: Gamepad2,
};

/** Icône d'un type de média (livre, film / série / anime, jeu vidéo), décorative. */
export function KindIcon({ kind, className }: Readonly<{ kind: MediaKind; className: string }>) {
  const Icon = ICONS[kind];
  return <Icon aria-hidden className={className} />;
}
