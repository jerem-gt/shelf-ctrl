import { Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useGiveBack, useOpenLoans } from '@/hooks/useLoans';
import { daysBetween, formatIsoDate, localToday } from '@/lib/format';

export function LoansPage() {
  const { t } = useTranslation();
  const { data: loans, error, isPending } = useOpenLoans();
  const giveBack = useGiveBack();

  let content;
  if (error) {
    content = (
      <p role="alert" className="text-red-700">
        {error.message}
      </p>
    );
  } else if (isPending) {
    content = <p className="text-slate-500">{t('collection.loading')}</p>;
  } else if (loans.length === 0) {
    content = <p className="text-slate-500">{t('loansPage.empty')}</p>;
  } else {
    const today = localToday();
    content = (
      <ul className="flex flex-col gap-3">
        {loans.map((loan) => (
          <li
            key={loan.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="min-w-0">
              <Link to={`/copies/${loan.copyId}`} className="block truncate font-semibold">
                {loan.work.title}
              </Link>
              {loan.work.series && (
                <p className="truncate text-sm text-slate-600">
                  {loan.work.series}
                  {loan.work.volumeNumber !== null &&
                    ` · ${t('collection.volume', { number: loan.work.volumeNumber })}`}
                </p>
              )}
              <p className="text-sm text-slate-600">
                {loan.borrowerName} · {t('loansPage.since', { date: formatIsoDate(loan.loanedAt) })}{' '}
                ({t('loansPage.days', { count: daysBetween(loan.loanedAt, today) })})
              </p>
            </div>
            <button
              type="button"
              disabled={giveBack.isPending}
              onClick={() => giveBack.mutate(loan.id)}
              className="flex shrink-0 items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-60"
            >
              <Undo2 aria-hidden className="size-4" />
              {t('loansPage.giveBack')}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{t('loansPage.title')}</h2>
      {giveBack.error && (
        <p role="alert" className="text-sm text-red-700">
          {giveBack.error.message}
        </p>
      )}
      {content}
    </section>
  );
}
