import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { AUTH_LINK_CLASS, AuthCard } from '@/components/AuthCard';
import { useForgotPassword } from '@/hooks/useAuth';
import { FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/lib/formClasses';

/** La réponse est la même que le compte existe ou non : la page ne dit jamais lequel. */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const forgot = useForgotPassword();
  const [identifier, setIdentifier] = useState('');

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    forgot.mutate(identifier.trim());
  };

  const back = (
    <Link to="/" className={AUTH_LINK_CLASS}>
      {t('forgot.back')}
    </Link>
  );

  if (forgot.isSuccess) {
    return (
      <AuthCard subtitle={t('forgot.subtitle')}>
        <p role="status" className="text-sm text-slate-700">
          {t('forgot.sent')}
        </p>
        {back}
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle={t('forgot.subtitle')} error={forgot.error?.message}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className={LABEL_CLASS}>
          {t('forgot.identifier')}
          <input
            required
            autoComplete="username"
            maxLength={254}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <button type="submit" disabled={forgot.isPending} className={PRIMARY_BUTTON_CLASS}>
          {forgot.isPending ? t('forgot.submitting') : t('forgot.submit')}
        </button>
      </form>
      {back}
    </AuthCard>
  );
}
