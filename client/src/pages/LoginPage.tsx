import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { AUTH_LINK_CLASS, AuthCard } from '@/components/AuthCard';
import { useLogin } from '@/hooks/useAuth';
import { FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/lib/formClasses';

export function LoginPage() {
  const { t } = useTranslation();
  const login = useLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate({ username: username.trim(), password });
  };

  return (
    <AuthCard subtitle={t('login.title')} error={login.error?.message}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className={LABEL_CLASS}>
          {t('login.username')}
          <input
            required
            autoComplete="username"
            maxLength={200}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <label className={LABEL_CLASS}>
          {t('login.password')}
          <input
            required
            type="password"
            autoComplete="current-password"
            maxLength={200}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <button type="submit" disabled={login.isPending} className={PRIMARY_BUTTON_CLASS}>
          {login.isPending ? t('login.submitting') : t('login.submit')}
        </button>
      </form>
      <Link to="/forgot-password" className={AUTH_LINK_CLASS}>
        {t('login.forgotLink')}
      </Link>
    </AuthCard>
  );
}
