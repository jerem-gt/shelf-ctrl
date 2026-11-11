import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export const AUTH_LINK_CLASS =
  'text-center text-sm text-content-muted underline underline-offset-4 hover:text-content';

/** Carte centrée des écrans hors session : connexion, premier compte, mot de passe oublié. */
export function AuthCard({
  subtitle,
  error,
  children,
}: Readonly<{ subtitle: string; error?: string | null; children: ReactNode }>) {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-line-subtle bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-bold">{t('appName')}</h1>
        <h2 className="text-sm font-semibold text-content-muted">{subtitle}</h2>
        {children}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
