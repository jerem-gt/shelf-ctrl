import type { CopyItem } from '@shelfctrl/types';
import { HandCoins, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCopyLoans, useGiveBack } from '@/hooks/useLoans';
import { formatIsoDate } from '@/lib/format';

import { LendForm } from './LendForm';

/** Prêt en cours, formulaire de prêt et historique d'un exemplaire. */
export function LoanSection({ copy }: Readonly<{ copy: CopyItem }>) {
  const { t } = useTranslation();
  const { data: loans } = useCopyLoans(copy.id);
  const giveBack = useGiveBack();
  const [lending, setLending] = useState(false);

  const current = loans?.find((loan) => loan.returnedAt === null);

  let action;
  if (current) {
    action = (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-content">
          {t('loan.current', {
            name: current.borrowerName,
            date: formatIsoDate(current.loanedAt),
          })}
        </p>
        <div>
          <button
            type="button"
            disabled={giveBack.isPending}
            onClick={() => giveBack.mutate(current.id)}
            className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-60"
          >
            <Undo2 aria-hidden className="size-4" />
            {giveBack.isPending ? t('loan.givingBack') : t('loan.giveBack')}
          </button>
        </div>
        {giveBack.error && (
          <p role="alert" className="text-sm text-danger">
            {giveBack.error.message}
          </p>
        )}
      </div>
    );
  } else if (copy.status === 'sold') {
    action = <p className="text-sm text-content-subtle">{t('loan.soldNote')}</p>;
  } else if (lending) {
    action = <LendForm copyId={copy.id} onDone={() => setLending(false)} />;
  } else {
    action = (
      <div>
        <button
          type="button"
          onClick={() => setLending(true)}
          className="flex items-center gap-1 rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium"
        >
          <HandCoins aria-hidden className="size-4" />
          {t('loan.lendButton')}
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label={t('loan.section')}
      className="flex flex-col gap-3 border-t border-line-subtle pt-4"
    >
      <h3 className="font-semibold">{t('loan.section')}</h3>
      {action}

      <div>
        <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-content-subtle">
          {t('loan.history')}
        </h4>
        {loans?.length === 0 && <p className="text-sm text-content-subtle">{t('loan.never')}</p>}
        <ul className="flex flex-col gap-1 text-sm text-content-secondary">
          {loans?.map((loan) => (
            <li key={loan.id}>
              <span className="font-medium">{loan.borrowerName}</span>
              {' · '}
              {t('loan.period', {
                from: formatIsoDate(loan.loanedAt),
                to: loan.returnedAt ? formatIsoDate(loan.returnedAt) : t('loan.ongoing'),
              })}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
