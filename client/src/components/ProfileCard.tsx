import type { SessionResponse } from '@shelfctrl/types';
import { type SyntheticEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useChangePassword, useMe, useUpdateProfile } from '@/hooks/useAuth';
import { FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/lib/formClasses';
import { newPasswordProblem } from '@/lib/passwords';

const BUTTON_CLASS = `self-start ${PRIMARY_BUTTON_CLASS}`;

/** Nom et e-mail : n'envoie que ce qui a changé, avec le mot de passe actuel. */
function ProfileForm({
  me,
  update,
}: Readonly<{ me: SessionResponse; update: ReturnType<typeof useUpdateProfile> }>) {
  const { t } = useTranslation();
  const hintId = useId();
  const [username, setUsername] = useState(me.username);
  const [email, setEmail] = useState(me.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');

  const nextEmail = email.trim() || null;
  const changed = username.trim() !== me.username || nextEmail !== me.email;

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    update.mutate(
      {
        currentPassword,
        username: username.trim() === me.username ? undefined : username.trim(),
        email: nextEmail === me.email ? undefined : nextEmail,
      },
      { onSuccess: () => setCurrentPassword('') },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className={LABEL_CLASS}>
        {t('profile.username')}
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
        {t('profile.email')}
        <input
          type="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={hintId}
          className={FIELD_CLASS}
        />
      </label>
      <p id={hintId} className="-mt-2 text-xs text-slate-500">
        {t('profile.emailHint')}
      </p>
      {changed && (
        <label className={LABEL_CLASS}>
          {t('profile.currentPassword')}
          <input
            required
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>
      )}
      {update.error && (
        <p role="alert" className="text-sm text-red-700">
          {update.error.message}
        </p>
      )}
      {update.isSuccess && !changed && (
        <p role="status" className="text-sm text-green-700">
          {t('profile.saved')}
        </p>
      )}
      <button type="submit" disabled={!changed || update.isPending} className={BUTTON_CLASS}>
        {update.isPending ? t('profile.saving') : t('profile.save')}
      </button>
    </form>
  );
}

function PasswordForm() {
  const { t } = useTranslation();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = newPasswordProblem(next, confirm);
    setProblem(found);
    if (found !== null) {
      return;
    }
    change.mutate(
      { current, next },
      {
        onSuccess: () => {
          setCurrent('');
          setNext('');
          setConfirm('');
        },
      },
    );
  };

  const error = problem === null ? change.error?.message : t(problem);

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h4 className="font-medium">{t('profile.passwordTitle')}</h4>
      <label className={LABEL_CLASS}>
        {t('profile.currentPassword')}
        <input
          required
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          className={FIELD_CLASS}
        />
      </label>
      <label className={LABEL_CLASS}>
        {t('profile.newPassword')}
        <input
          required
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          className={FIELD_CLASS}
        />
      </label>
      <label className={LABEL_CLASS}>
        {t('profile.confirm')}
        <input
          required
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className={FIELD_CLASS}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {change.isSuccess && (
        <p role="status" className="text-sm text-green-700">
          {t('profile.passwordChanged')}
        </p>
      )}
      <button type="submit" disabled={change.isPending} className={BUTTON_CLASS}>
        {change.isPending ? t('profile.changingPassword') : t('profile.changePassword')}
      </button>
    </form>
  );
}

/** Carte « Mon compte » des réglages : profil et mot de passe. */
export function ProfileCard() {
  const { data: me } = useMe();
  // Ici et non dans le formulaire, remonté après chaque enregistrement : garde le message de succès.
  const update = useUpdateProfile();
  if (!me) {
    return null;
  }
  return (
    <div className="flex flex-col gap-6 rounded-md border border-slate-200 bg-white p-4">
      {/* Clé : le formulaire repart des valeurs enregistrées après un changement de nom. */}
      <ProfileForm key={`${me.username}|${me.email ?? ''}`} me={me} update={update} />
      <PasswordForm />
    </div>
  );
}
