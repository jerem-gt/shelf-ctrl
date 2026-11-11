import { COPY_CONDITIONS, type CopyCondition, type CopyItem, isGameFormat } from '@shelfctrl/types';
import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConsoleField } from '@/components/ConsoleField';
import { useUpdateCopy } from '@/hooks/useCopies';

const FIELD_CLASS =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-line-strong focus:outline-none';

interface EditCopyFormProps {
  copy: CopyItem;
  onDone: () => void;
}

/**
 * Modifie les champs propres à l'exemplaire (l'œuvre et l'édition sont partagées), et la console
 * d'un jeu vidéo, qui vaut pour tous les exemplaires de son édition.
 */
export function EditCopyForm({ copy, onDone }: Readonly<EditCopyFormProps>) {
  const { t } = useTranslation();
  const update = useUpdateCopy(copy.id);
  const [condition, setCondition] = useState<CopyCondition>(copy.condition);
  const [note, setNote] = useState(copy.conditionNote ?? '');
  const [location, setLocation] = useState(copy.location ?? '');
  const isGame = isGameFormat(copy.edition.format);
  const [gameConsole, setGameConsole] = useState(copy.edition.console ?? '');

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    update.mutate(
      {
        condition,
        conditionNote: note.trim() || null,
        location: location.trim() || null,
        ...(isGame && { console: gameConsole.trim() || null }),
      },
      { onSuccess: onDone },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-content-secondary">
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
      <label className="flex flex-col gap-1 text-sm font-medium text-content-secondary">
        {t('detail.conditionNote')}
        <input
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={FIELD_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-content-secondary">
        {t('detail.location')}
        <input
          maxLength={100}
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className={FIELD_CLASS}
        />
      </label>

      {isGame && (
        <ConsoleField
          label={t('detail.console')}
          hint={t('detail.consoleHint')}
          value={gameConsole}
          onChange={setGameConsole}
          inputClassName={FIELD_CLASS}
        />
      )}

      {update.error && (
        <p role="alert" className="text-sm text-danger">
          {update.error.message}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={update.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-60"
        >
          {update.isPending ? t('detail.saving') : t('detail.save')}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-line px-4 py-2 text-sm"
        >
          {t('detail.cancel')}
        </button>
      </div>
    </form>
  );
}
