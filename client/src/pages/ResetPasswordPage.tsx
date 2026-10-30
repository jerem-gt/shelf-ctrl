import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { ApiError } from '@/api/client';
import { AUTH_LINK_CLASS, AuthCard } from '@/components/AuthCard';
import { NewPasswordFields } from '@/components/NewPasswordFields';
import { useResetPassword } from '@/hooks/useAuth';
import { PRIMARY_BUTTON_CLASS } from '@/lib/formClasses';
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
        <NewPasswordFields
          passwordLabel={t('reset.password')}
          confirmLabel={t('reset.confirm')}
          password={password}
          confirm={confirm}
          onPasswordChange={setPassword}
          onConfirmChange={setConfirm}
        />
        <button type="submit" disabled={reset.isPending} className={PRIMARY_BUTTON_CLASS}>
          {reset.isPending ? t('reset.submitting') : t('reset.submit')}
        </button>
      </form>
    </AuthCard>
  );
}
