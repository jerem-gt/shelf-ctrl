import type { PlatformItem } from '@shelfctrl/types';
import { Trash2 } from 'lucide-react';
import { type ReactNode, type SyntheticEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ProfileCard } from '@/components/ProfileCard';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { TwoFactorCard } from '@/components/TwoFactorCard';
import {
  useAddPlatform,
  usePlatforms,
  useRemovePlatform,
  useSetDefaultPlatform,
  useSetPlatformUrl,
} from '@/hooks/usePlatforms';
import { findKnownPlatform, KNOWN_PLATFORMS } from '@/lib/platforms';

const FIELD_CLASS =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-line-strong focus:outline-none';
const BUTTON_CLASS =
  'rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium disabled:opacity-60';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Message d'une erreur de réglage : saisie invalide expliquée, sinon le code traduit du serveur. */
function useErrorMessage() {
  const { t } = useTranslation();
  return (error: Error): string => {
    if (error instanceof ApiError && error.code === 'validation.invalid') {
      return t('settings.errors.invalid');
    }
    return error.message;
  };
}

function CustomPlatformRow({
  platform,
  onRemove,
  busy,
}: Readonly<{ platform: PlatformItem; onRemove: () => void; busy: boolean }>) {
  const { t } = useTranslation();
  const urlId = useId();
  const saveUrl = useSetPlatformUrl();
  const errorMessage = useErrorMessage();
  const [url, setUrl] = useState(platform.publishUrl ?? '');
  const changed = url.trim() !== (platform.publishUrl ?? '');

  const save = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveUrl.mutate({ id: platform.id, publishUrl: url.trim() || null });
  };

  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{platform.name}</p>
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          aria-label={t('settings.remove', { name: platform.name })}
          className="rounded-md p-2 text-content-subtle hover:bg-surface-emphasis hover:text-danger disabled:opacity-60"
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      </div>
      <form onSubmit={save} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={urlId} className="text-xs font-medium text-content-muted">
            {t('settings.publishUrl')}
          </label>
          <input
            id={urlId}
            type="url"
            maxLength={500}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className={FIELD_CLASS}
          />
        </div>
        <button type="submit" disabled={!changed || saveUrl.isPending} className={BUTTON_CLASS}>
          {t('settings.saveUrl')}
        </button>
      </form>
      {saveUrl.error && (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(saveUrl.error)}
        </p>
      )}
    </li>
  );
}

function AddPlatformForm() {
  const { t } = useTranslation();
  const nameId = useId();
  const urlId = useId();
  const add = useAddPlatform();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    add.mutate(
      { name: name.trim(), publishUrl: url.trim() || undefined },
      {
        onSuccess: () => {
          setName('');
          setUrl('');
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h5 className="font-medium">{t('settings.addTitle')}</h5>
      <div className="flex flex-col gap-1">
        <label htmlFor={nameId} className="text-sm font-medium text-content-secondary">
          {t('settings.name')}
        </label>
        <input
          id={nameId}
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={FIELD_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={urlId} className="text-sm font-medium text-content-secondary">
          {t('settings.publishUrl')}
        </label>
        <input
          id={urlId}
          type="url"
          maxLength={500}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-describedby={`${urlId}-hint`}
          className={FIELD_CLASS}
        />
        <p id={`${urlId}-hint`} className="text-xs text-content-subtle">
          {t('settings.publishUrlHint')}
        </p>
      </div>
      {add.error && (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(add.error)}
        </p>
      )}
      <div>
        <button type="submit" disabled={add.isPending} className={BUTTON_CLASS}>
          {t(add.isPending ? 'settings.adding' : 'settings.add')}
        </button>
      </div>
    </form>
  );
}

function PlatformsSettings() {
  const { t } = useTranslation();
  const defaultId = useId();
  const { data, error, isPending } = usePlatforms();
  const add = useAddPlatform();
  const remove = useRemovePlatform();
  const setDefault = useSetDefaultPlatform();
  const errorMessage = useErrorMessage();

  if (error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error.message}
      </p>
    );
  }
  if (isPending) {
    return <p className="text-sm text-content-subtle">{t('settings.loading')}</p>;
  }

  const items = data.items;
  const custom = items.filter((item) => findKnownPlatform(item.name) === undefined);
  const busy = add.isPending || remove.isPending || setDefault.isPending;
  const mutationError = add.error ?? remove.error ?? setDefault.error;
  const current = items.find((item) => item.isDefault);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-content-muted">{t('settings.platformsIntro')}</p>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">{t('settings.known')}</legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {KNOWN_PLATFORMS.map((known) => {
            const row = items.find((item) => sameName(item.name, known.name));
            return (
              <li key={known.name}>
                <label className="flex items-center gap-2 rounded-md border border-line-subtle bg-surface px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row !== undefined}
                    disabled={busy}
                    onChange={() =>
                      row ? remove.mutate(row.id) : add.mutate({ name: known.name })
                    }
                  />
                  {known.name}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <section className="flex flex-col gap-2">
        <h4 className="font-medium">{t('settings.custom')}</h4>
        {custom.length === 0 ? (
          <p className="text-sm text-content-subtle">{t('settings.noCustom')}</p>
        ) : (
          <ul
            aria-label={t('settings.custom')}
            className="flex flex-col divide-y divide-line-subtle rounded-md border border-line-subtle bg-surface"
          >
            {custom.map((platform) => (
              <CustomPlatformRow
                key={platform.id}
                platform={platform}
                busy={busy}
                onRemove={() => remove.mutate(platform.id)}
              />
            ))}
          </ul>
        )}
        <AddPlatformForm />
      </section>

      <div className="flex flex-col gap-1">
        <label htmlFor={defaultId} className="text-sm font-medium text-content-secondary">
          {t('settings.default')}
        </label>
        <select
          id={defaultId}
          value={current?.id ?? ''}
          disabled={busy || items.length === 0}
          onChange={(event) =>
            setDefault.mutate(event.target.value === '' ? null : Number(event.target.value))
          }
          className={`${FIELD_CLASS} sm:w-64`}
        >
          <option value="">{t('settings.noDefault')}</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-content-subtle">{t('settings.defaultHint')}</p>
      </div>

      {mutationError && (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(mutationError)}
        </p>
      )}
    </div>
  );
}

/** Groupe de réglages : un titre, puis ses sous-parties, séparé des autres par un filet. */
function SettingsGroup({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 border-t border-line-subtle pt-5 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <h3 id={titleId} className="text-lg font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold">{t('settings.title')}</h2>
      <SettingsGroup title={t('profile.title')}>
        <ProfileCard />
        <h4 className="font-semibold">{t('twoFactor.title')}</h4>
        <TwoFactorCard />
      </SettingsGroup>
      <SettingsGroup title={t('settings.preferencesTitle')}>
        <h4 className="font-semibold">{t('language.title')}</h4>
        <LanguageSwitcher />
        <h4 className="font-semibold">{t('theme.title')}</h4>
        <ThemeSwitcher />
      </SettingsGroup>
      <SettingsGroup title={t('settings.salesTitle')}>
        <PlatformsSettings />
      </SettingsGroup>
    </div>
  );
}
