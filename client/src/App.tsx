import { useTranslation } from 'react-i18next';

export default function App() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-2 p-6">
      <h1 className="text-3xl font-bold">{t('appName')}</h1>
      <p className="text-slate-600">{t('tagline')}</p>
    </main>
  );
}
