import { FIELD_CLASS, LABEL_CLASS } from '@/lib/formClasses';

interface NewPasswordFieldsProps {
  passwordLabel: string;
  confirmLabel: string;
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
}

/** Nouveau mot de passe et sa confirmation (premier démarrage, réinitialisation). */
export function NewPasswordFields({
  passwordLabel,
  confirmLabel,
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
}: Readonly<NewPasswordFieldsProps>) {
  return (
    <>
      <label className={LABEL_CLASS}>
        {passwordLabel}
        <input
          required
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          className={FIELD_CLASS}
        />
      </label>
      <label className={LABEL_CLASS}>
        {confirmLabel}
        <input
          required
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => onConfirmChange(event.target.value)}
          className={FIELD_CLASS}
        />
      </label>
    </>
  );
}
