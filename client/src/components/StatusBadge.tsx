import type { CopyStatus } from '@shelfctrl/types';
import { useTranslation } from 'react-i18next';

const STATUS_STYLES: Record<CopyStatus, string> = {
  owned: 'bg-emerald-100 text-emerald-800',
  loaned: 'bg-amber-100 text-amber-800',
  listed: 'bg-sky-100 text-sky-800',
  sold: 'bg-slate-200 text-slate-700',
};

export function StatusBadge({ status }: Readonly<{ status: CopyStatus }>) {
  const { t } = useTranslation();

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {t(`statuses.${status}`)}
    </span>
  );
}
