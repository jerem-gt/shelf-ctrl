import { useTranslation } from 'react-i18next';

import { useDeleteCopy } from '@/hooks/useCopies';

interface DeleteCopyConfirmationProps {
  copyId: number;
  onCancel: () => void;
  onDeleted: () => void;
}

export function DeleteCopyConfirmation({
  copyId,
  onCancel,
  onDeleted,
}: Readonly<DeleteCopyConfirmationProps>) {
  const { t } = useTranslation();
  const remove = useDeleteCopy(copyId);

  return (
    <div
      role="alertdialog"
      aria-label={t('detail.deleteTitle')}
      className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
    >
      <p className="font-semibold text-red-900">{t('detail.deleteTitle')}</p>
      <p className="text-sm text-red-800">{t('detail.deleteWarning')}</p>

      {remove.error && (
        <p role="alert" className="text-sm text-red-700">
          {remove.error.message}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() => remove.mutate(undefined, { onSuccess: onDeleted })}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {remove.isPending ? t('detail.deleting') : t('detail.deleteConfirm')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm"
        >
          {t('detail.cancel')}
        </button>
      </div>
    </div>
  );
}
