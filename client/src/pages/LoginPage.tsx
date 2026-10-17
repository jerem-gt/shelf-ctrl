import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLogin } from '@/hooks/useAuth';

const FIELD_CLASS =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none';

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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold">{t('appName')}</h1>
        <h2 className="text-sm font-semibold text-slate-600">{t('login.title')}</h2>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
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
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
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

        {login.error && (
          <p role="alert" className="text-sm text-red-700">
            {login.error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={login.isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {login.isPending ? t('login.submitting') : t('login.submit')}
        </button>
      </form>
    </main>
  );
}
