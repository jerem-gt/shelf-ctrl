import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

/** `covers` : pochette d'une édition ; `photos` : photo d'un exemplaire. */
export type ImageKind = 'covers' | 'photos';

/** Boîte dans laquelle l'image est réduite (sans agrandissement), proportions conservées. */
const MAX_SIZE: Record<ImageKind, number> = { covers: 900, photos: 1600 };
const MAX_PIXELS = 50_000_000;
const WEBP_QUALITY = 80;
const FILE_NAME = /^\d+-[0-9a-f]{10}\.webp$/;

export class InvalidImageError extends Error {}

/**
 * Images stockées dans `DATA_DIR/images/{covers,photos}`, jamais liées à distance. Tout est
 * converti en WebP (EXIF retiré, rotation appliquée) ; le nom contient l'empreinte du contenu,
 * ce qui permet un cache navigateur immuable et change l'URL à chaque remplacement.
 */
export function createImageStore(dataDir: string) {
  const root = path.join(dataDir, 'images');
  const dirOf = (kind: ImageKind) => path.join(root, kind);
  fs.mkdirSync(dirOf('covers'), { recursive: true });
  fs.mkdirSync(dirOf('photos'), { recursive: true });

  return {
    dirOf,

    /** Convertit et enregistre l'image ; renvoie le nom du fichier. */
    async save(kind: ImageKind, ownerId: number, input: Buffer): Promise<string> {
      let output: Buffer;
      try {
        output = await sharp(input, { limitInputPixels: MAX_PIXELS })
          .rotate()
          .resize({
            width: MAX_SIZE[kind],
            height: MAX_SIZE[kind],
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();
      } catch {
        throw new InvalidImageError('Image illisible');
      }
      const hash = crypto.createHash('sha1').update(output).digest('hex').slice(0, 10);
      const name = `${ownerId}-${hash}.webp`;
      const target = path.join(dirOf(kind), name);
      // Écriture dans un fichier temporaire puis renommage : jamais d'image tronquée servie.
      const temp = `${target}.${crypto.randomUUID()}.tmp`;
      await fs.promises.writeFile(temp, output);
      await fs.promises.rename(temp, target);
      return name;
    },

    /** Supprime le fichier s'il existe ; un nom inattendu est ignoré (garde-fou contre `..`). */
    async remove(kind: ImageKind, name: string | null): Promise<void> {
      if (name === null || !FILE_NAME.test(name)) {
        return;
      }
      await fs.promises.rm(path.join(dirOf(kind), name), { force: true });
    },
  };
}

export type ImageStore = ReturnType<typeof createImageStore>;
