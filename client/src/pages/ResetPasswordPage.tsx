import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { ApiError } from '@/api/client';
import { AUTH_LINK_CLASS, AuthCard } from '@/components/AuthCard';
import { useResetPassword } from '@/hooks/useAuth';
import { FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/lib/formClasses';
import { newPasswordProblem } from '@/lib/passwords';

/** Ouverte depuis le lien reçu (`/reset-password?token=…`), avec ou sans session. */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const reset = useResetPassword();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const tokenInvalid =
    token === '' || (reset.error instanceof ApiError && reset.error.code === 'reset_token_invalid');
  if (tokenInvalid) {
    return (
      <AuthCard subtitle={t('reset.invalidToken')}>
        <Link to="/forgot-password" className={AUTH_LINK_CLASS}>
          {t('reset.requestNew')}
        </Link>
      </AuthCard>
    );
  }
  if (reset.isSuccess) {
    return (
      <AuthCard subtitle={t('reset.success')}>
        <Link to="/" replace className={AUTH_LINK_CLASS}>
          {t('reset.toLogin')}
        </Link>
      </AuthCard>
    );
  }

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = newPasswordProblem(password, confirm);
    setProblem(found);
    if (found === null) {
      reset.mutate({ token, password });
    }
  };

  return (
    <AuthCard
      subtitle={t('reset.subtitle')}
      error={problem === null ? reset.error?.message : t(problem)}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className={LABEL_CLASS}>
          {t('reset.password')}
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
          {t('reset.confirm')}
          <input
            required
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <button type="submit" disabled={reset.isPending} className={PRIMARY_BUTTON_CLASS}>
          {reset.isPending ? t('reset.submitting') : t('reset.submit')}
        </button>
      </form>
    </AuthCard>
  );
}
