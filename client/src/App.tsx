import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Link, Route, Routes } from 'react-router';

import { AddCopyPage } from '@/pages/AddCopyPage';
import { CollectionPage } from '@/pages/CollectionPage';

export function AppRoutes() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-xl font-bold">
            <h1>{t('appName')}</h1>
          </Link>
          <p className="hidden text-sm text-slate-500 sm:block">{t('tagline')}</p>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Routes>
          <Route path="/" element={<CollectionPage />} />
          <Route path="/add" element={<AddCopyPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
