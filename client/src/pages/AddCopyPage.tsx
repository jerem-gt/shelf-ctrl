import {
  type BarcodeSuggestion,
  consoleOf,
  COPY_CONDITIONS,
  type CopyCondition,
  FORMATS_BY_KIND,
  isGameFormat,
  kindOfFormat,
  type MediaFormat,
  type MediaKind,
  type TitleSearchResult,
} from '@shelfctrl/types';
import { Camera, Search } from 'lucide-react';
import { type SyntheticEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { ApiError, type CreateCopyPayload } from '@/api/client';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { ConsoleField } from '@/components/ConsoleField';
import { KindPicker } from '@/components/KindPicker';
import { useBarcodeLookup } from '@/hooks/useBarcodeLookup';
import { useCreateCopy } from '@/hooks/useCopies';
import { useTitleSearch } from '@/hooks/useTitleSearch';
import { creatorsLabelKey } from '@/lib/formats';
import { isScanSupported } from '@/lib/scanner';

const FIELD_CLASS =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-line-strong focus:outline-none';

interface FormState {
  title: string;
  series: string;
  volumeNumber: string;
  creators: string;
  format: MediaFormat;
  console: string;
  barcode: string;
  publisher: string;
  condition: CopyCondition;
  conditionNote: string;
  location: string;
}

const INITIAL_STATE: FormState = {
  title: '',
  series: '',
  volumeNumber: '',
  creators: '',
  format: 'book',
  console: '',
  barcode: '',
  publisher: '',
  condition: 'good',
  conditionNote: '',
  location: '',
};

/** Champ texte vide → `undefined`, pour que l'API ne reçoive que des valeurs renseignées. */
function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function toPayload(form: FormState): CreateCopyPayload {
  const volume = Number.parseInt(form.volumeNumber, 10);
  return {
    work: {
      title: form.title.trim(),
      series: optional(form.series),
      volumeNumber: Number.isNaN(volume) ? undefined : volume,
      creators: optional(form.creators),
    },
    edition: {
      format: form.format,
      // La console ne vaut que pour un jeu vidéo : saisie puis format changé, elle est oubliée.
      console: consoleOf(form.format, optional(form.console)) ?? undefined,
      barcode: optional(form.barcode),
      publisher: optional(form.publisher),
    },
    condition: form.condition,
    conditionNote: optional(form.conditionNote),
    location: optional(form.location),
  };
}

/** Reporte la fiche trouvée dans le formulaire ; une valeur absente laisse la saisie en place. */
function applySuggestion(
  form: FormState,
  barcode: string | null,
  suggestion: BarcodeSuggestion,
): FormState {
  const { work, edition } = suggestion;
  return {
    ...form,
    barcode: barcode ?? form.barcode,
    title: work.title,
    series: work.series ?? form.series,
    volumeNumber: work.volumeNumber?.toString() ?? form.volumeNumber,
    creators: work.creators ?? form.creators,
    format: edition.format ?? form.format,
    console: edition.console ?? form.console,
    publisher: edition.publisher ?? form.publisher,
  };
}

/**
 * « Tintin, tome 20 », « Hergé · Casterman 2006 » : de quoi distinguer deux résultats voisins.
 * Les consoles d'un jeu (« PlayStation 5 / PC ») ont leur propre ligne, jamais tronquée : toutes
 * sont citées, même quand aucune n'est préremplie faute d'être unique.
 */
function describeResult(result: TitleSearchResult, volumeLabel: (number: number) => string) {
  const { work, edition } = result.suggestion;
  const heading = [work.series, work.volumeNumber === null ? null : volumeLabel(work.volumeNumber)]
    .filter(Boolean)
    .join(', ');
  const publisher = [edition.publisher, edition.releaseYear ?? work.year].filter(Boolean).join(' ');
  const details = [work.creators, publisher].filter(Boolean).join(' · ');
  return { title: work.title, heading, details, consoles: result.consoles.join(' / ') };
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-content-secondary">
      {label}
      {children}
    </label>
  );
}

export function AddCopyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createCopy = useCreateCopy();
  const lookup = useBarcodeLookup();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const titleSearch = useTitleSearch();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  // Dernier code-barres venu d'une source (recherche de fiche ou résultat) : il décrit le produit
  // trouvé, contrairement à un code saisi ou scanné que personne ne connaît encore.
  const sourcedBarcodeRef = useRef<string | null>(null);
  const scanSupported = isScanSupported();

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Le type découle du format : une fiche trouvée par code-barres (un jeu, un film…) le change aussi.
  const kind = kindOfFormat(form.format);

  /** Change de type : format par défaut du type, et les résultats d'un autre type disparaissent. */
  const chooseKind = (next: MediaKind) => {
    if (next === kind) {
      return;
    }
    update('format', FORMATS_BY_KIND[next][0]);
    titleSearch.reset();
    setSearchMessage(null);
  };

  const lookupErrorMessage = (error: Error): string => {
    if (error instanceof ApiError && error.status === 404) {
      return t('add.lookup.notFound');
    }
    if (error instanceof ApiError && error.status === 400) {
      return t('add.lookup.invalid');
    }
    return error.message;
  };

  const runLookup = (code: string) => {
    setLookupMessage(null);
    lookup.mutate(code, {
      onSuccess: (result) => {
        sourcedBarcodeRef.current = result.barcode;
        setForm((current) => applySuggestion(current, result.barcode, result.suggestion));
        setLookupMessage(
          result.known
            ? t('add.lookup.known')
            : t('add.lookup.found', { source: t(`sources.${result.source}`) }),
        );
      },
      onError: (error) => setLookupMessage(lookupErrorMessage(error)),
    });
  };

  const runTitleSearch = () => {
    const query = searchQuery.trim();
    setSearchMessage(null);
    if (query.length < 2) {
      setSearchMessage(t('add.titleSearch.tooShort'));
      return;
    }
    titleSearch.mutate(
      { query, kind },
      {
        onSuccess: (response) => {
          if (!response.configured) {
            setSearchMessage(t(`add.titleSearch.unconfigured.${kind}`));
          } else if (response.results.length === 0) {
            setSearchMessage(t('add.titleSearch.none'));
          }
        },
        onError: (error) => setSearchMessage(error.message),
      },
    );
  };

  const chooseResult = (result: TitleSearchResult) => {
    const replaced = sourcedBarcodeRef.current;
    sourcedBarcodeRef.current = result.barcode;
    setForm((current) => {
      // Sans code-barres, un code issu d'une autre fiche ne doit pas rester sur ce produit.
      const barcode = result.barcode ?? (current.barcode === replaced ? '' : null);
      return applySuggestion(current, barcode, result.suggestion);
    });
    setSearchMessage(t('add.titleSearch.applied', { source: t(`sources.${result.source}`) }));
    titleSearch.reset();
  };

  const handleScan = (code: string) => {
    setScanning(false);
    update('barcode', code);
    runLookup(code);
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    createCopy.mutate(toPayload(form), { onSuccess: () => void navigate('/') });
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{t('add.title')}</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <KindPicker value={kind} onChange={chooseKind} />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">{t('add.titleSearch.section')}</legend>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label={t('add.titleSearch.label')}>
                <input
                  value={searchQuery}
                  maxLength={100}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    // Entrée lance la recherche au lieu d'envoyer tout le formulaire.
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      runTitleSearch();
                    }
                  }}
                  className={FIELD_CLASS}
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={runTitleSearch}
              disabled={titleSearch.isPending}
              className="flex items-center gap-1 rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium disabled:opacity-60"
            >
              <Search aria-hidden className="size-4" />
              {titleSearch.isPending ? t('add.titleSearch.searching') : t('add.titleSearch.button')}
            </button>
          </div>
          {searchMessage && <output className="text-sm text-content-muted">{searchMessage}</output>}
          {titleSearch.data && titleSearch.data.results.length > 0 && (
            <ul
              aria-label={t('add.titleSearch.results')}
              className="flex flex-col divide-y divide-line-subtle rounded-md border border-line-subtle"
            >
              {titleSearch.data.results.map((result) => {
                const { title, heading, details, consoles } = describeResult(result, (number) =>
                  t('add.titleSearch.volume', { number }),
                );
                return (
                  <li
                    key={`${result.source}|${result.barcode}|${title}|${details}`}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{title}</p>
                      {heading && <p className="text-content-muted">{heading}</p>}
                      {details && <p className="truncate text-xs text-content-subtle">{details}</p>}
                      {consoles && <p className="text-xs text-content-muted">{consoles}</p>}
                      <p className="text-xs text-content-faint">
                        {t('add.titleSearch.via', { source: t(`sources.${result.source}`) })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => chooseResult(result)}
                      aria-label={`${t('add.titleSearch.choose')} : ${title}`}
                      className="shrink-0 rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium"
                    >
                      {t('add.titleSearch.choose')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">{t('add.barcodeSection')}</legend>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label={t('add.barcode')}>
                <input
                  inputMode="numeric"
                  value={form.barcode}
                  onChange={(event) => update('barcode', event.target.value)}
                  className={FIELD_CLASS}
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={() => runLookup(form.barcode)}
              disabled={lookup.isPending || form.barcode.trim() === ''}
              className="flex items-center gap-1 rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium disabled:opacity-60"
            >
              <Search aria-hidden className="size-4" />
              {lookup.isPending ? t('add.lookup.searching') : t('add.lookup.button')}
            </button>
            {scanSupported && (
              <button
                type="button"
                onClick={() => setScanning(true)}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-fg"
              >
                <Camera aria-hidden className="size-4" />
                {t('scan.button')}
              </button>
            )}
          </div>
          {!scanSupported && <p className="text-xs text-content-subtle">{t('scan.unsupported')}</p>}
          {lookupMessage && <output className="text-sm text-content-muted">{lookupMessage}</output>}
        </fieldset>

        {scanning && <BarcodeScanner onDetect={handleScan} onClose={() => setScanning(false)} />}

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-semibold">{t('add.work')}</legend>
          <Field label={t('add.titleLabel')}>
            <input
              required
              maxLength={200}
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              className={FIELD_CLASS}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <Field label={t('add.series')}>
              <input
                maxLength={200}
                value={form.series}
                onChange={(event) => update('series', event.target.value)}
                className={FIELD_CLASS}
              />
            </Field>
            <Field label={t('add.volumeNumber')}>
              <input
                type="number"
                min={1}
                value={form.volumeNumber}
                onChange={(event) => update('volumeNumber', event.target.value)}
                className={FIELD_CLASS}
              />
            </Field>
          </div>
          <Field label={t(creatorsLabelKey('add', form.format))}>
            <input
              maxLength={300}
              value={form.creators}
              onChange={(event) => update('creators', event.target.value)}
              className={FIELD_CLASS}
            />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-semibold">{t('add.edition')}</legend>
          {kind === 'movie' && (
            <Field label={t('add.format')}>
              <select
                value={form.format}
                onChange={(event) => update('format', event.target.value as MediaFormat)}
                className={FIELD_CLASS}
              >
                {FORMATS_BY_KIND.movie.map((value) => (
                  <option key={value} value={value}>
                    {t(`formats.${value}`)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {isGameFormat(form.format) && (
            <ConsoleField
              label={t('add.console')}
              hint={t('add.consoleHint')}
              value={form.console}
              onChange={(value) => update('console', value)}
              inputClassName={FIELD_CLASS}
            />
          )}
          <Field label={t('add.publisher')}>
            <input
              maxLength={200}
              value={form.publisher}
              onChange={(event) => update('publisher', event.target.value)}
              className={FIELD_CLASS}
            />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-semibold">{t('add.copy')}</legend>
          <Field label={t('add.condition')}>
            <select
              value={form.condition}
              onChange={(event) => update('condition', event.target.value as CopyCondition)}
              className={FIELD_CLASS}
            >
              {COPY_CONDITIONS.map((value) => (
                <option key={value} value={value}>
                  {t(`conditions.${value}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('add.conditionNote')}>
            <input
              maxLength={500}
              value={form.conditionNote}
              onChange={(event) => update('conditionNote', event.target.value)}
              className={FIELD_CLASS}
            />
          </Field>
          <Field label={t('add.location')}>
            <input
              maxLength={100}
              value={form.location}
              onChange={(event) => update('location', event.target.value)}
              className={FIELD_CLASS}
            />
          </Field>
        </fieldset>

        {createCopy.error && (
          <p role="alert" className="text-sm text-danger">
            {createCopy.error.message}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={createCopy.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-60"
          >
            {createCopy.isPending ? t('add.submitting') : t('add.submit')}
          </button>
          <Link to="/" className="rounded-md border border-line px-4 py-2 text-sm">
            {t('add.cancel')}
          </Link>
        </div>
      </form>
    </section>
  );
}
