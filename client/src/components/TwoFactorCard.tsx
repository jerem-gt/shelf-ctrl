import type { TotpSetupResponse, TrustedDeviceItem } from '@shelfctrl/types';
import { QRCodeSVG } from 'qrcode.react';
import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useDisableTotp,
  useEnableTotp,
  useForgetAllDevices,
  useForgetDevice,
  useMe,
  useSetupTotp,
  useTrustedDevices,
} from '@/hooks/useAuth';
import {
  DANGER_BUTTON_CLASS,
  FIELD_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS as SECONDARY_CLASS,
  SUCCESS_BADGE_CLASS,
} from '@/lib/formClasses';
import { lastUsedParts } from '@/lib/lastUsed';

import { ConfirmDialog } from './ConfirmDialog';
import { ErrorText } from './ErrorText';
import { TotpCodeInput } from './TotpCodeInput';

function useLastUsedText() {
  const { t } = useTranslation();
  return (timestamp: number): string => {
    const { kind, time, date } = lastUsedParts(timestamp);
    if (kind === 'today') {
      return t('twoFactor.lastUsedToday', { time });
    }
    if (kind === 'yesterday') {
      return t('twoFactor.lastUsedYesterday', { time });
    }
    return t('twoFactor.lastUsedDate', { date, time });
  };
}

function DeviceRow({ device }: Readonly<{ device: TrustedDeviceItem }>) {
  const { t } = useTranslation();
  const forget = useForgetDevice();
  const lastUsedText = useLastUsedText();
  const name = device.label === '' ? t('twoFactor.deviceUnknown') : device.label;

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span>{name}</span>
          {device.current && (
            <span className={SUCCESS_BADGE_CLASS}>{t('twoFactor.deviceCurrent')}</span>
          )}
        </p>
        <p className="text-xs text-slate-500">{lastUsedText(device.lastUsedAt)}</p>
        <ErrorText error={forget.error} />
      </div>
      <button
        type="button"
        disabled={forget.isPending}
        onClick={() => forget.mutate(device.id)}
        aria-label={t('twoFactor.forgetLabel', { name })}
        className={SECONDARY_CLASS}
      >
        {t('twoFactor.forget')}
      </button>
    </li>
  );
}

/** « Oublier tous les appareils », après confirmation. */
function ForgetAllDevices() {
  const { t } = useTranslation();
  const forgetAll = useForgetAllDevices();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <ConfirmDialog
        label={t('twoFactor.forgetAll')}
        message={t('twoFactor.forgetAllConfirm')}
        error={forgetAll.error}
        confirmLabel={t('twoFactor.forgetAllYes')}
        cancelLabel={t('twoFactor.cancel')}
        pending={forgetAll.isPending}
        onConfirm={() => forgetAll.mutate(undefined, { onSuccess: () => setConfirming(false) })}
        onCancel={() => setConfirming(false)}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={`self-start ${SECONDARY_CLASS}`}
    >
      {t('twoFactor.forgetAll')}
    </button>
  );
}

/** Appareils où la 2FA est sautée pendant 30 jours (« se souvenir de cet appareil »). */
function TrustedDevices() {
  const { t } = useTranslation();
  const { data } = useTrustedDevices();
  const devices = data?.items ?? [];

  return (
    <section className="flex flex-col gap-2">
      <h4 className="font-medium">{t('twoFactor.devicesTitle')}</h4>
      {devices.length === 0 ? (
        <p className="text-sm text-slate-500">{t('twoFactor.devicesEmpty')}</p>
      ) : (
        <>
          <ul
            aria-label={t('twoFactor.devicesTitle')}
            className="flex flex-col divide-y divide-slate-200"
          >
            {devices.map((device) => (
              <DeviceRow key={device.id} device={device} />
            ))}
          </ul>
          <ForgetAllDevices />
        </>
      )}
    </section>
  );
}

/** QR code et clé proposés par le serveur, confirmés par un premier code. */
function SetupForm({
  setup,
  onEnabled,
  onCancel,
}: Readonly<{ setup: TotpSetupResponse; onEnabled: () => void; onCancel: () => void }>) {
  const { t } = useTranslation();
  const enable = useEnableTotp();
  const [code, setCode] = useState('');

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    enable.mutate(code, { onSuccess: onEnabled });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h4 className="font-medium">{t('twoFactor.setupTitle')}</h4>
      <p className="text-sm text-slate-600">{t('twoFactor.setupScan')}</p>
      <div className="self-center rounded-md border border-slate-200 bg-white p-3">
        <QRCodeSVG value={setup.uri} size={176} title={t('twoFactor.qrLabel')} />
      </div>
      <p className="text-xs text-slate-500">{t('twoFactor.setupSecret')}</p>
      <p className="rounded-md bg-slate-100 px-3 py-2 font-mono text-xs break-all select-all">
        {setup.secret}
      </p>
      <p className="text-sm text-slate-600">{t('twoFactor.setupConfirm')}</p>
      <TotpCodeInput
        label={t('twoFactor.code')}
        value={code}
        onChange={setCode}
        className="sm:w-40"
      />
      <ErrorText error={enable.error} />
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={code.length !== 6 || enable.isPending}
          className={PRIMARY_BUTTON_CLASS}
        >
          {enable.isPending ? t('twoFactor.confirming') : t('twoFactor.confirm')}
        </button>
        <button type="button" onClick={onCancel} className={SECONDARY_CLASS}>
          {t('twoFactor.cancel')}
        </button>
      </div>
    </form>
  );
}

function DisableForm({
  onDisabled,
  onCancel,
}: Readonly<{ onDisabled: () => void; onCancel: () => void }>) {
  const { t } = useTranslation();
  const disable = useDisableTotp();
  const [password, setPassword] = useState('');

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    disable.mutate(password, { onSuccess: onDisabled });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h4 className="font-medium">{t('twoFactor.disableTitle')}</h4>
      <p className="text-sm text-slate-600">{t('twoFactor.disableIntro')}</p>
      <label className={LABEL_CLASS}>
        {t('twoFactor.password')}
        <input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={FIELD_CLASS}
        />
      </label>
      <ErrorText error={disable.error} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={disable.isPending} className={DANGER_BUTTON_CLASS}>
          {disable.isPending ? t('twoFactor.disabling') : t('twoFactor.disable')}
        </button>
        <button type="button" onClick={onCancel} className={SECONDARY_CLASS}>
          {t('twoFactor.cancel')}
        </button>
      </div>
    </form>
  );
}

type Step = 'idle' | 'disable';

/** Carte « Double authentification » des réglages : activation, désactivation, appareils. */
export function TwoFactorCard() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const setupTotp = useSetupTotp();
  const [step, setStep] = useState<Step>('idle');
  const [done, setDone] = useState<string | null>(null);

  if (!me) {
    return null;
  }

  const enabled = me.totpEnabled;
  let body;
  if (setupTotp.data && !enabled) {
    body = (
      <SetupForm
        setup={setupTotp.data}
        onEnabled={() => {
          setDone(t('twoFactor.enabledDone'));
          setupTotp.reset();
        }}
        onCancel={() => setupTotp.reset()}
      />
    );
  } else if (step === 'disable' && enabled) {
    body = (
      <DisableForm
        onDisabled={() => {
          setDone(t('twoFactor.disabledDone'));
          setStep('idle');
        }}
        onCancel={() => setStep('idle')}
      />
    );
  } else if (enabled) {
    body = (
      <>
        <TrustedDevices />
        <button
          type="button"
          onClick={() => {
            setDone(null);
            setStep('disable');
          }}
          className={`self-start ${SECONDARY_CLASS}`}
        >
          {t('twoFactor.disable')}
        </button>
      </>
    );
  } else {
    body = (
      <>
        <ErrorText error={setupTotp.error} />
        <button
          type="button"
          disabled={setupTotp.isPending}
          onClick={() => {
            setDone(null);
            setupTotp.mutate();
          }}
          className={`self-start ${PRIMARY_BUTTON_CLASS}`}
        >
          {setupTotp.isPending ? t('twoFactor.preparing') : t('twoFactor.enable')}
        </button>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span
            aria-hidden
            className={`inline-block size-2 rounded-full ${enabled ? 'bg-green-600' : 'bg-slate-400'}`}
          />
          {enabled ? t('twoFactor.enabled') : t('twoFactor.disabled')}
        </p>
        <p className="text-sm text-slate-600">
          {enabled ? t('twoFactor.enabledIntro') : t('twoFactor.disabledIntro')}
        </p>
      </div>
      {done && <output className="block text-sm text-green-700">{done}</output>}
      {body}
    </div>
  );
}
