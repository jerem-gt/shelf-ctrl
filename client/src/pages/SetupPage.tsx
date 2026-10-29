import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '@/components/AuthCard';
import { useSetup } from '@/hooks/useAuth';
import { FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/lib/formClasses';
import { newPasswordProblem } from '@/lib/passwords';

/** Premier démarrage : création du premier compte (admin) avec le jeton écrit dans les logs. */
export function SetupPage() {
  const { t } = useTranslation();
  const setup = useSetup();
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = newPasswordProblem(password, confirm);
    setProblem(found);
    if (found === null) {
      setup.mutate({ token: token.trim(), username: username.trim(), password });
    }
  };

  return (
    <AuthCard
      subtitle={t('setup.subtitle')}
      error={problem === null ? setup.error?.message : t(problem)}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className={LABEL_CLASS}>
          {t('setup.token')}
          <input
            required
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            aria-describedby="setup-token-help"
            className={FIELD_CLASS}
          />
        </label>
        <p id="setup-token-help" className="-mt-2 text-xs text-slate-500">
          {t('setup.tokenHelp')}
        </p>
        <label className={LABEL_CLASS}>
          {t('setup.username')}
          <input
            required
            autoComplete="username"
            maxLength={64}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <label className={LABEL_CLASS}>
          {t('setup.password')}
          <input
            required
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <label className={LABEL_CLASS}>
          {t('setup.confirm')}
          <input
            required
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <button type="submit" disabled={setup.isPending} className={PRIMARY_BUTTON_CLASS}>
          {setup.isPending ? t('setup.submitting') : t('setup.submit')}
        </button>
      </form>
    </AuthCard>
  );
}
