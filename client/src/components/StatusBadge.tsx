import type { CopyStatus } from '@shelfctrl/types';
import { useTranslation } from 'react-i18next';

const STATUS_STYLES: Record<CopyStatus, string> = {
  owned: 'bg-success-surface text-success',
  loaned: 'bg-warning-surface text-warning',
  listed: 'bg-info-surface text-info',
  sold: 'bg-surface-strong text-content-secondary',
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
