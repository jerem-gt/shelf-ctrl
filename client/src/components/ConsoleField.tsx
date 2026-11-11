import { CONSOLE_MAX_LENGTH, GAME_CONSOLES } from '@shelfctrl/types';
import { useId } from 'react';

interface ConsoleFieldProps {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
}

/** Console d'un jeu vidéo : texte libre, consoles connues proposées (ajout et modification). */
export function ConsoleField({
  label,
  hint,
  value,
  onChange,
  inputClassName,
}: Readonly<ConsoleFieldProps>) {
  const id = useId();
  const listId = `${id}-consoles`;
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1 text-sm font-medium text-content-secondary">
        {label}
        <input
          list={listId}
          maxLength={CONSOLE_MAX_LENGTH}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={hintId}
          className={inputClassName}
        />
      </label>
      <datalist id={listId}>
        {GAME_CONSOLES.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <p id={hintId} className="text-xs text-content-subtle">
        {hint}
      </p>
    </div>
  );
}
