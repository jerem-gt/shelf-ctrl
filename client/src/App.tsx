import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router';

import { ApiError } from '@/api/client';
import { ME_KEY, useLogout, useMe } from '@/hooks/useAuth';
import { AddCopyPage } from '@/pages/AddCopyPage';
import { CollectionPage } from '@/pages/CollectionPage';
import { CopyPage } from '@/pages/CopyPage';
import { ImportPage } from '@/pages/ImportPage';
import { LoansPage } from '@/pages/LoansPage';
import { LoginPage } from '@/pages/LoginPage';
import { SalesPage } from '@/pages/SalesPage';

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'text-slate-900 underline underline-offset-4' : 'text-slate-500';
}

export function AppRoutes() {
  const { t } = useTranslation();
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/" className="text-xl font-bold">
              <h1>{t('appName')}</h1>
            </Link>
            <nav aria-label={t('nav.main')} className="flex gap-3 text-sm font-medium sm:gap-4">
              <NavLink to="/" end className={navClass}>
                {t('nav.collection')}
              </NavLink>
              <NavLink to="/loans" className={navClass}>
                {t('nav.loans')}
              </NavLink>
              <NavLink to="/sales" className={navClass}>
                {t('nav.sales')}
              </NavLink>
              <NavLink to="/import" className={navClass}>
                {t('nav.import')}
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm text-slate-500 lg:block">{t('tagline')}</p>
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              aria-label={t('nav.logout')}
              title={t('nav.logout')}
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"
            >
              <LogOut aria-hidden className="size-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Routes>
          <Route path="/" element={<CollectionPage />} />
          <Route path="/add" element={<AddCopyPage />} />
          <Route path="/copies/:id" element={<CopyPage />} />
          <Route path="/loans" element={<LoansPage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </main>
    </div>
  );
}

/** Affiche la page de connexion tant qu'il n'y a pas de session, l'application sinon. */
function AuthGate({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useTranslation();
  const { data, error, isPending } = useMe();

  if (isPending) {
    return <p className="p-6 text-slate-500">{t('collection.loading')}</p>;
  }
  // Le 401 d'abord : après une déconnexion ou une expiration, la dernière donnée connue reste en
  // cache à côté de l'erreur, et ne doit pas ouvrir l'application.
  if (error instanceof ApiError && error.status === 401) {
    return <LoginPage />;
  }
  if (data) {
    return <>{children}</>;
  }
  return (
    <p role="alert" className="p-6 text-red-700">
      {error?.message}
    </p>
  );
}

/** Une seule nouvelle tentative, et seulement pour une panne : une erreur 4xx (dont 401) ne passe pas. */
function retryOnce(failureCount: number, error: Error): boolean {
  const clientError = error instanceof ApiError && error.status >= 400 && error.status < 500;
  return failureCount < 1 && !clientError;
}

function createQueryClient(): QueryClient {
  // Une session expirée en cours d'usage (401 hors connexion) ramène à la page de connexion.
  const onUnauthorized = (error: Error) => {
    if (error instanceof ApiError && error.status === 401) {
      void client.invalidateQueries({ queryKey: ME_KEY });
    }
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.queryKey[0] !== ME_KEY[0]) {
          onUnauthorized(error);
        }
      },
    }),
    mutationCache: new MutationCache({ onError: onUnauthorized }),
    defaultOptions: { queries: { retry: retryOnce, staleTime: 30_000 } },
  });
  return client;
}

export default function App() {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate>
          <AppRoutes />
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
