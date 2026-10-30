import type { UserItem } from '@shelfctrl/types';
import { Pencil, ShieldOff, Trash2 } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMe } from '@/hooks/useAuth';
import {
  useCreateUser,
  useDisableUserTotp,
  useRemoveUser,
  useTestEmail,
  useUpdateUser,
  useUsers,
} from '@/hooks/useUsers';
import { formatDate } from '@/lib/format';
import { FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS as PRIMARY_CLASS } from '@/lib/formClasses';
import { MIN_PASSWORD_LENGTH } from '@/lib/passwords';

const SECONDARY_CLASS = 'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm';
const ICON_CLASS =
  'rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60';

interface AccountFields {
  username: string;
  email: string;
  password: string;
  isAdmin: boolean;
}

/** Champs communs à la création et à la modification d'un compte. */
function AccountFieldset({
  fields,
  onChange,
  passwordLabel,
  passwordRequired,
}: Readonly<{
  fields: AccountFields;
  onChange: (fields: AccountFields) => void;
  passwordLabel: string;
  passwordRequired: boolean;
}>) {
  const { t } = useTranslation();
  return (
    <>
      <label className={LABEL_CLASS}>
        {t('users.username')}
        <input
          required
          autoComplete="off"
          maxLength={64}
          value={fields.username}
          onChange={(event) => onChange({ ...fields, username: event.target.value })}
          className={FIELD_CLASS}
        />
      </label>
      <label className={LABEL_CLASS}>
        {t('users.email')}
        <input
          type="email"
          autoComplete="off"
          maxLength={254}
          value={fields.email}
          onChange={(event) => onChange({ ...fields, email: event.target.value })}
          className={FIELD_CLASS}
        />
      </label>
      <label className={LABEL_CLASS}>
        {passwordLabel}
        <input
          required={passwordRequired}
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          value={fields.password}
          onChange={(event) => onChange({ ...fields, password: event.target.value })}
          className={FIELD_CLASS}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={fields.isAdmin}
          onChange={(event) => onChange({ ...fields, isAdmin: event.target.checked })}
        />
        {t('users.isAdmin')}
      </label>
    </>
  );
}

const EMPTY_FIELDS: AccountFields = { username: '', email: '', password: '', isAdmin: false };

function AddUserForm() {
  const { t } = useTranslation();
  const create = useCreateUser();
  const [fields, setFields] = useState(EMPTY_FIELDS);

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate(
      {
        username: fields.username.trim(),
        password: fields.password,
        email: fields.email.trim() || null,
        isAdmin: fields.isAdmin,
      },
      { onSuccess: () => setFields(EMPTY_FIELDS) },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4"
    >
      <h3 className="font-medium">{t('users.addTitle')}</h3>
      <AccountFieldset
        fields={fields}
        onChange={setFields}
        passwordLabel={t('users.password')}
        passwordRequired
      />
      {create.error && (
        <p role="alert" className="text-sm text-red-700">
          {create.error.message}
        </p>
      )}
      <button type="submit" disabled={create.isPending} className={`self-start ${PRIMARY_CLASS}`}>
        {create.isPending ? t('users.adding') : t('users.add')}
      </button>
    </form>
  );
}

function EditUserForm({ user, onDone }: Readonly<{ user: UserItem; onDone: () => void }>) {
  const { t } = useTranslation();
  const update = useUpdateUser();
  const [fields, setFields] = useState<AccountFields>({
    username: user.username,
    email: user.email ?? '',
    password: '',
    isAdmin: user.isAdmin,
  });

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = fields.username.trim();
    const email = fields.email.trim() || null;
    update.mutate(
      {
        id: user.id,
        payload: {
          username: username === user.username ? undefined : username,
          email: email === user.email ? undefined : email,
          password: fields.password || undefined,
          isAdmin: fields.isAdmin === user.isAdmin ? undefined : fields.isAdmin,
        },
      },
      { onSuccess: onDone },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <AccountFieldset
        fields={fields}
        onChange={setFields}
        passwordLabel={t('users.newPassword')}
        passwordRequired={false}
      />
      {update.error && (
        <p role="alert" className="text-sm text-red-700">
          {update.error.message}
        </p>
      )}
      <div className="flex gap-3">
        <button type="submit" disabled={update.isPending} className={PRIMARY_CLASS}>
          {update.isPending ? t('users.saving') : t('users.save')}
        </button>
        <button type="button" onClick={onDone} className={SECONDARY_CLASS}>
          {t('users.cancel')}
        </button>
      </div>
    </form>
  );
}

function RemoveUserConfirmation({
  user,
  onCancel,
}: Readonly<{ user: UserItem; onCancel: () => void }>) {
  const { t } = useTranslation();
  const remove = useRemoveUser();
  const title = t('users.remove', { name: user.username });

  return (
    <div
      role="alertdialog"
      aria-label={title}
      className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
    >
      <p className="text-sm text-red-800">{t('users.confirmRemove', { name: user.username })}</p>
      {remove.error && (
        <p role="alert" className="text-sm text-red-700">
          {remove.error.message}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() => remove.mutate(user.id)}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {remove.isPending ? t('users.removing') : t('users.removeConfirm')}
        </button>
        <button type="button" onClick={onCancel} className={SECONDARY_CLASS}>
          {t('users.cancel')}
        </button>
      </div>
    </div>
  );
}

/** Téléphone perdu : la 2FA du compte est désactivée, ses appareils mémorisés oubliés. */
function DisableTotpConfirmation({
  user,
  onDone,
}: Readonly<{ user: UserItem; onDone: () => void }>) {
  const { t } = useTranslation();
  const disable = useDisableUserTotp();

  return (
    <div
      role="alertdialog"
      aria-label={t('users.disableTotp', { name: user.username })}
      className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
    >
      <p className="text-sm text-red-800">
        {t('users.confirmDisableTotp', { name: user.username })}
      </p>
      {disable.error && (
        <p role="alert" className="text-sm text-red-700">
          {disable.error.message}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={disable.isPending}
          onClick={() => disable.mutate(user.id, { onSuccess: onDone })}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {disable.isPending ? t('users.disablingTotp') : t('users.disableTotpConfirm')}
        </button>
        <button type="button" onClick={onDone} className={SECONDARY_CLASS}>
          {t('users.cancel')}
        </button>
      </div>
    </div>
  );
}

type RowMode = 'view' | 'edit' | 'remove' | 'disableTotp';

function UserRow({ user, isMe }: Readonly<{ user: UserItem; isMe: boolean }>) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<RowMode>('view');
  const details = [user.email ?? t('users.noEmail'), t('users.copies', { count: user.copyCount })];
  if (user.lastCopyAt) {
    details.push(t('users.lastCopy', { date: formatDate(user.lastCopyAt) }));
  }
  details.push(t('users.createdOn', { date: formatDate(user.createdAt) }));

  return (
    <li className="flex flex-col gap-3 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="break-all">{user.username}</span>
            {isMe && <span className="text-sm font-normal text-slate-500">({t('users.you')})</span>}
            {user.isAdmin && (
              <span className="rounded bg-slate-900 px-1.5 py-0.5 text-xs font-medium text-white">
                {t('users.admin')}
              </span>
            )}
            {user.totpEnabled && (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
                {t('users.twoFactor')}
              </span>
            )}
          </p>
          <p className="text-sm break-words text-slate-500">{details.join(' · ')}</p>
        </div>
        <div className="flex shrink-0">
          <button
            type="button"
            onClick={() => setMode('edit')}
            aria-label={t('users.edit', { name: user.username })}
            title={t('users.edit', { name: user.username })}
            className={ICON_CLASS}
          >
            <Pencil aria-hidden className="size-4" />
          </button>
          {user.totpEnabled && (
            <button
              type="button"
              onClick={() => setMode('disableTotp')}
              aria-label={t('users.disableTotp', { name: user.username })}
              title={t('users.disableTotp', { name: user.username })}
              className={`${ICON_CLASS} hover:text-red-700`}
            >
              <ShieldOff aria-hidden className="size-4" />
            </button>
          )}
          {!isMe && (
            <button
              type="button"
              onClick={() => setMode('remove')}
              aria-label={t('users.remove', { name: user.username })}
              title={t('users.remove', { name: user.username })}
              className={`${ICON_CLASS} hover:text-red-700`}
            >
              <Trash2 aria-hidden className="size-4" />
            </button>
          )}
        </div>
      </div>
      {mode === 'edit' && <EditUserForm user={user} onDone={() => setMode('view')} />}
      {mode === 'remove' && <RemoveUserConfirmation user={user} onCancel={() => setMode('view')} />}
      {mode === 'disableTotp' && (
        <DisableTotpConfirmation user={user} onDone={() => setMode('view')} />
      )}
    </li>
  );
}

function TestEmailCard() {
  const { t } = useTranslation();
  const testEmail = useTestEmail();
  return (
    <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4">
      <h3 className="font-medium">{t('users.mailTitle')}</h3>
      <p className="text-sm text-slate-600">{t('users.mailIntro')}</p>
      {testEmail.error && (
        <p role="alert" className="text-sm text-red-700">
          {testEmail.error.message}
        </p>
      )}
      {testEmail.isSuccess && (
        <output className="block text-sm text-green-700">{t('users.testEmailSent')}</output>
      )}
      <button
        type="button"
        disabled={testEmail.isPending}
        onClick={() => testEmail.mutate()}
        className={`self-start ${SECONDARY_CLASS} disabled:opacity-60`}
      >
        {testEmail.isPending ? t('users.testEmailSending') : t('users.testEmail')}
      </button>
    </div>
  );
}

/** Page des administrateurs : comptes et vérification de l'envoi des e-mails. */
export function UsersPage() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const users = useUsers();

  let list;
  if (users.isPending) {
    list = <p className="text-sm text-slate-500">{t('users.loading')}</p>;
  } else if (users.error) {
    list = (
      <p role="alert" className="text-sm text-red-700">
        {users.error.message}
      </p>
    );
  } else {
    list = (
      <ul className="flex flex-col divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
        {users.data.items.map((user) => (
          <UserRow key={user.id} user={user} isMe={user.id === me?.id} />
        ))}
      </ul>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{t('users.title')}</h2>
      {list}
      <AddUserForm />
      <TestEmailCard />
    </section>
  );
}
