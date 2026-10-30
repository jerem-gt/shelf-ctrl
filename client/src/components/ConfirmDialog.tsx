import type { ReactNode } from 'react';

import { DANGER_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@/lib/formClasses';

import { ErrorText } from './ErrorText';

interface ConfirmDialogProps {
  /** Nom accessible de la fenêtre. */
  label: string;
  /** Titre affiché en gras au-dessus du message (absent : le message seul). */
  title?: string;
  message: ReactNode;
  error?: Error | null;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  /** Libellé du bouton pendant l'action (par défaut celui de confirmation). */
  pendingLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation d'une action destructive, sur place (sans fenêtre modale). */
export function ConfirmDialog({
  label,
  title,
  message,
  error,
  confirmLabel,
  cancelLabel,
  pending = false,
  pendingLabel = confirmLabel,
  onConfirm,
  onCancel,
}: Readonly<ConfirmDialogProps>) {
  return (
    <div
      role="alertdialog"
      aria-label={label}
      className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
    >
      {title && <p className="font-semibold text-red-900">{title}</p>}
      <p className="text-sm text-red-800">{message}</p>
      <ErrorText error={error} />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className={DANGER_BUTTON_CLASS}
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
        <button type="button" onClick={onCancel} className={SECONDARY_BUTTON_CLASS}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
