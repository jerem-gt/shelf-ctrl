import { FIELD_CLASS, LABEL_CLASS } from '@/lib/formClasses';

/** Champ du code à 6 chiffres de l'application d'authentification : ne garde que les chiffres. */
export function TotpCodeInput({
  label,
  value,
  onChange,
  className = '',
}: Readonly<{
  label: string;
  value: string;
  onChange: (code: string) => void;
  className?: string;
}>) {
  return (
    <label className={LABEL_CLASS}>
      {label}
      <input
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replaceAll(/\D/g, ''))}
        className={`${FIELD_CLASS} font-mono tracking-widest ${className}`}
      />
    </label>
  );
}
