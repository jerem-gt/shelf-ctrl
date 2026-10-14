import { COPY_CONDITIONS, type CopyCondition, type CopyItem } from '@shelfctrl/types';
import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUpdateCopy } from '@/hooks/useCopies';

const FIELD_CLASS =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none';

interface EditCopyFormProps {
  copy: CopyItem;
  onDone: () => void;
}

/** Modifie les champs propres à l'exemplaire (l'œuvre et l'édition sont partagées). */
export function EditCopyForm({ copy, onDone }: Readonly<EditCopyFormProps>) {
  const { t } = useTranslation();
  const update = useUpdateCopy(copy.id);
  const [condition, setCondition] = useState<CopyCondition>(copy.condition);
  const [note, setNote] = useState(copy.conditionNote ?? '');
  const [location, setLocation] = useState(copy.location ?? '');

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    update.mutate(
      {
        condition,
        conditionNote: note.trim() || null,
        location: location.trim() || null,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        {t('detail.condition')}
        <select
          value={condition}
          onChange={(event) => setCondition(event.target.value as CopyCondition)}
          className={FIELD_CLASS}
        >
          {COPY_CONDITIONS.map((value) => (
            <option key={value} value={value}>
              {t(`conditions.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        {t('detail.conditionNote')}
        <input
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={FIELD_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        {t('detail.location')}
        <input
          maxLength={100}
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className={FIELD_CLASS}
        />
      </label>

      {update.error && (
        <p role="alert" className="text-sm text-red-700">
          {update.error.message}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={update.isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {update.isPending ? t('detail.saving') : t('detail.save')}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm"
        >
          {t('detail.cancel')}
        </button>
      </div>
    </form>
  );
}
