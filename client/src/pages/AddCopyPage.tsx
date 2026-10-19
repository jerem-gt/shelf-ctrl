import {
  type BarcodeSuggestion,
  COPY_CONDITIONS,
  type CopyCondition,
  MEDIA_FORMATS,
  type MediaFormat,
  type TitleSearchResult,
} from '@shelfctrl/types';
import { Camera, Search } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { ApiError, type CreateCopyPayload } from '@/api/client';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { useBarcodeLookup } from '@/hooks/useBarcodeLookup';
import { useCreateCopy } from '@/hooks/useCopies';
import { useTitleSearch } from '@/hooks/useTitleSearch';
import { isScanSupported } from '@/lib/scanner';

const FIELD_CLASS =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none';

interface FormState {
  title: string;
  series: string;
  volumeNumber: string;
  creators: string;
  format: MediaFormat;
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
    publisher: edition.publisher ?? form.publisher,
  };
}

/** « Tintin, tome 20 », « Hergé · Casterman 2006 » : de quoi distinguer deux résultats voisins. */
function describeResult(result: TitleSearchResult, volumeLabel: (number: number) => string) {
  const { work, edition } = result.suggestion;
  const heading = [work.series, work.volumeNumber === null ? null : volumeLabel(work.volumeNumber)]
    .filter(Boolean)
    .join(', ');
  const publisher = [edition.publisher, edition.releaseYear ?? work.year].filter(Boolean).join(' ');
  const details = [work.creators, publisher].filter(Boolean).join(' · ');
  return { title: work.title, heading, details };
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
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
  const scanSupported = isScanSupported();

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

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
    titleSearch.mutate(query, {
      onSuccess: (response) => {
        if (response.results.length === 0) {
          setSearchMessage(t('add.titleSearch.none'));
        }
      },
      onError: (error) => setSearchMessage(error.message),
    });
  };

  const chooseResult = (result: TitleSearchResult) => {
    setForm((current) => applySuggestion(current, result.barcode, result.suggestion));
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
              className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-60"
            >
              <Search aria-hidden className="size-4" />
              {titleSearch.isPending ? t('add.titleSearch.searching') : t('add.titleSearch.button')}
            </button>
          </div>
          {searchMessage && <output className="text-sm text-slate-600">{searchMessage}</output>}
          {titleSearch.data && titleSearch.data.results.length > 0 && (
            <ul
              aria-label={t('add.titleSearch.results')}
              className="flex flex-col divide-y divide-slate-200 rounded-md border border-slate-200"
            >
              {titleSearch.data.results.map((result) => {
                const { title, heading, details } = describeResult(result, (number) =>
                  t('add.titleSearch.volume', { number }),
                );
                return (
                  <li
                    key={`${result.source}|${result.barcode}|${title}|${details}`}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{title}</p>
                      {heading && <p className="text-slate-600">{heading}</p>}
                      {details && <p className="truncate text-xs text-slate-500">{details}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => chooseResult(result)}
                      aria-label={`${t('add.titleSearch.choose')} : ${title}`}
                      className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium"
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
              className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-60"
            >
              <Search aria-hidden className="size-4" />
              {lookup.isPending ? t('add.lookup.searching') : t('add.lookup.button')}
            </button>
            {scanSupported && (
              <button
                type="button"
                onClick={() => setScanning(true)}
                className="flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              >
                <Camera aria-hidden className="size-4" />
                {t('scan.button')}
              </button>
            )}
          </div>
          {!scanSupported && <p className="text-xs text-slate-500">{t('scan.unsupported')}</p>}
          {lookupMessage && <output className="text-sm text-slate-600">{lookupMessage}</output>}
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
          <Field label={t('add.creators')}>
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
          <Field label={t('add.format')}>
            <select
              value={form.format}
              onChange={(event) => update('format', event.target.value as MediaFormat)}
              className={FIELD_CLASS}
            >
              {MEDIA_FORMATS.map((value) => (
                <option key={value} value={value}>
                  {t(`formats.${value}`)}
                </option>
              ))}
            </select>
          </Field>
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
          <p role="alert" className="text-sm text-red-700">
            {createCopy.error.message}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={createCopy.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {createCopy.isPending ? t('add.submitting') : t('add.submit')}
          </button>
          <Link to="/" className="rounded-md border border-slate-300 px-4 py-2 text-sm">
            {t('add.cancel')}
          </Link>
        </div>
      </form>
    </section>
  );
}
