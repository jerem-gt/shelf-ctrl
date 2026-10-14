import {
  type BarcodeLookupResponse,
  COPY_CONDITIONS,
  type CopyCondition,
  MEDIA_FORMATS,
  type MediaFormat,
} from '@shelfctrl/types';
import { Search } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { ApiError, type CreateCopyPayload } from '@/api/client';
import { useBarcodeLookup } from '@/hooks/useBarcodeLookup';
import { useCreateCopy } from '@/hooks/useCopies';

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
function applySuggestion(form: FormState, result: BarcodeLookupResponse): FormState {
  const { work, edition } = result.suggestion;
  return {
    ...form,
    barcode: result.barcode,
    title: work.title,
    series: work.series ?? form.series,
    volumeNumber: work.volumeNumber?.toString() ?? form.volumeNumber,
    creators: work.creators ?? form.creators,
    format: edition.format ?? form.format,
    publisher: edition.publisher ?? form.publisher,
  };
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

  const handleLookup = () => {
    setLookupMessage(null);
    lookup.mutate(form.barcode, {
      onSuccess: (result) => {
        setForm((current) => applySuggestion(current, result));
        setLookupMessage(
          result.known
            ? t('add.lookup.known')
            : t('add.lookup.found', { source: t(`sources.${result.source}`) }),
        );
      },
      onError: (error) => setLookupMessage(lookupErrorMessage(error)),
    });
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
              onClick={handleLookup}
              disabled={lookup.isPending || form.barcode.trim() === ''}
              className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-60"
            >
              <Search aria-hidden className="size-4" />
              {lookup.isPending ? t('add.lookup.searching') : t('add.lookup.button')}
            </button>
          </div>
          {lookupMessage && (
            <p role="status" className="text-sm text-slate-600">
              {lookupMessage}
            </p>
          )}
        </fieldset>

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
