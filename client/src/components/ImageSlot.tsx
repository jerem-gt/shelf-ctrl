import { type ChangeEvent, type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';

const BUTTON_CLASS =
  'cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium focus-within:ring-2 focus-within:ring-slate-400 has-[:disabled]:opacity-60';

interface ImageSlotProps {
  title: string;
  hint: string;
  /** `null` : pas d'image. */
  url: string | null;
  /** Texte alternatif de l'image affichée. */
  alt: string;
  uploading: boolean;
  removing: boolean;
  /** Message d'erreur à afficher sous l'image. */
  error: string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  /** Actions supplémentaires (ex. recherche en ligne). */
  children?: ReactNode;
}

/** Une image avec ses actions : envoi (fichier ou appareil photo), remplacement, retrait. */
export function ImageSlot({
  title,
  hint,
  url,
  alt,
  uploading,
  removing,
  error,
  onUpload,
  onRemove,
  children,
}: Readonly<ImageSlotProps>) {
  const { t } = useTranslation();
  const inputId = useId();
  const busy = uploading || removing;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Réinitialise le champ pour pouvoir renvoyer le même fichier après une erreur.
    event.target.value = '';
    if (file) {
      onUpload(file);
    }
  };

  let uploadLabel = 'images.add';
  if (uploading) {
    uploadLabel = 'images.uploading';
  } else if (url) {
    uploadLabel = 'images.replace';
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h4 className="text-sm font-medium text-slate-900">{title}</h4>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      {url ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          className="max-h-64 w-fit max-w-full rounded-md border border-slate-200 object-contain"
        />
      ) : (
        <p className="text-sm text-slate-500">{t('images.none')}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className={BUTTON_CLASS}>
          {t(uploadLabel)}
          <input
            id={inputId}
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={handleChange}
            className="sr-only"
          />
        </label>
        {children}
        {url && (
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className={`${BUTTON_CLASS} text-red-700 disabled:opacity-60`}
          >
            {t('images.remove')}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
