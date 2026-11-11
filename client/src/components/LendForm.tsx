import { type SyntheticEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useBorrowers, useLendCopy } from '@/hooks/useLoans';
import { localToday } from '@/lib/format';

const FIELD_CLASS =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-line-strong focus:outline-none';

interface LendFormProps {
  copyId: number;
  onDone: () => void;
}

export function LendForm({ copyId, onDone }: Readonly<LendFormProps>) {
  const { t } = useTranslation();
  const listId = useId();
  const lend = useLendCopy(copyId);
  const { data: borrowers } = useBorrowers();
  const [name, setName] = useState('');
  const [date, setDate] = useState(localToday);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    lend.mutate({ borrowerName: name.trim(), loanedAt: date }, { onSuccess: onDone });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-content-secondary">
        {t('loan.borrower')}
        <input
          required
          maxLength={100}
          list={listId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={FIELD_CLASS}
        />
        <datalist id={listId}>
          {borrowers?.map((borrower) => (
            <option key={borrower.id} value={borrower.name} />
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-content-secondary">
        {t('loan.date')}
        <input
          required
          type="date"
          max={localToday()}
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className={FIELD_CLASS}
        />
      </label>

      {lend.error && (
        <p role="alert" className="text-sm text-danger">
          {lend.error.message}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={lend.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-60"
        >
          {lend.isPending ? t('loan.lending') : t('loan.lendSubmit')}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-line px-4 py-2 text-sm"
        >
          {t('loan.cancel')}
        </button>
      </div>
    </form>
  );
}
