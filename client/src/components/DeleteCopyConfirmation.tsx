import { useTranslation } from 'react-i18next';

import { useDeleteCopy } from '@/hooks/useCopies';

import { ConfirmDialog } from './ConfirmDialog';

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
    <ConfirmDialog
      label={t('detail.deleteTitle')}
      title={t('detail.deleteTitle')}
      message={t('detail.deleteWarning')}
      error={remove.error}
      confirmLabel={t('detail.deleteConfirm')}
      cancelLabel={t('detail.cancel')}
      pending={remove.isPending}
      pendingLabel={t('detail.deleting')}
      onConfirm={() => remove.mutate(undefined, { onSuccess: onDeleted })}
      onCancel={onCancel}
    />
  );
}
