import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { ApiError } from '@/api/client';
import { AUTH_LINK_CLASS, AuthCard } from '@/components/AuthCard';
import { TotpCodeInput } from '@/components/TotpCodeInput';
import { useLogin, useVerifyTotp } from '@/hooks/useAuth';
import { FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/lib/formClasses';

/**
 * Second temps de la connexion quand la 2FA est active : le code, et « se souvenir ». Passé le
 * délai du serveur, retour au mot de passe avec le message (`onExpired`).
 */
function TotpStep({
  onBack,
  onExpired,
}: Readonly<{ onBack: () => void; onExpired: (error: ApiError) => void }>) {
  const { t } = useTranslation();
  const verify = useVerifyTotp();
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(false);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    verify.mutate(
      { code, remember },
      {
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'auth.totp_token_invalid') {
            onExpired(error);
          }
        },
      },
    );
  };

  return (
    <AuthCard subtitle={t('login.totpTitle')} error={verify.error?.message}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">{t('login.totpIntro')}</p>
        <TotpCodeInput label={t('login.totpCode')} value={code} onChange={setCode} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          {t('login.totpRemember')}
        </label>
        <button
          type="submit"
          disabled={code.length !== 6 || verify.isPending}
          className={PRIMARY_BUTTON_CLASS}
        >
          {verify.isPending ? t('login.submitting') : t('login.totpSubmit')}
        </button>
      </form>
      <button type="button" onClick={onBack} className={AUTH_LINK_CLASS}>
        {t('login.totpBack')}
      </button>
    </AuthCard>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const login = useLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [expired, setExpired] = useState<ApiError | null>(null);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setExpired(null);
    login.mutate({ username: username.trim(), password });
  };

  const backToPassword = () => {
    setPassword('');
    login.reset();
  };

  if (login.data && 'totpRequired' in login.data) {
    return (
      <TotpStep
        onBack={backToPassword}
        onExpired={(error) => {
          setExpired(error);
          backToPassword();
        }}
      />
    );
  }

  return (
    <AuthCard subtitle={t('login.title')} error={(login.error ?? expired)?.message}>
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
