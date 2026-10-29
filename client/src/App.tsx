import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router';

import { ApiError } from '@/api/client';
import { ME_KEY, useLogout, useMe, useSetupStatus } from '@/hooks/useAuth';
import { AddCopyPage } from '@/pages/AddCopyPage';
import { CollectionPage } from '@/pages/CollectionPage';
import { CopyPage } from '@/pages/CopyPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ImportPage } from '@/pages/ImportPage';
import { LoansPage } from '@/pages/LoansPage';
import { LoginPage } from '@/pages/LoginPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { SalesPage } from '@/pages/SalesPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SetupPage } from '@/pages/SetupPage';
import { UsersPage } from '@/pages/UsersPage';

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'text-slate-900 underline underline-offset-4' : 'text-slate-500';
}

export function AppRoutes() {
  const { t } = useTranslation();
  const logout = useLogout();
  const isAdmin = useMe().data?.isAdmin === true;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:gap-x-6">
          <Link to="/" className="order-1 text-xl font-bold">
            <h1>{t('appName')}</h1>
          </Link>
          <nav
            aria-label={t('nav.main')}
            className="order-3 flex w-full flex-wrap gap-x-3 gap-y-1 text-sm font-medium sm:order-2 sm:w-auto sm:gap-x-4"
          >
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
            <NavLink to="/settings" className={navClass}>
              {t('nav.settings')}
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navClass}>
                {t('nav.users')}
              </NavLink>
            )}
          </nav>
          <div className="order-2 ml-auto flex items-center gap-3 sm:order-3">
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
          <Route path="/settings" element={<SettingsPage />} />
          {isAdmin && <Route path="/admin" element={<UsersPage />} />}
        </Routes>
      </main>
    </div>
  );
}

/** Écrans sans session : premier compte tant qu'aucun n'existe, sinon connexion et mot de passe oublié. */
function PublicRoutes() {
  const { t } = useTranslation();
  const setup = useSetupStatus();

  if (setup.isPending) {
    return <p className="p-6 text-slate-500">{t('collection.loading')}</p>;
  }
  if (setup.data?.required) {
    return <SetupPage />;
  }
  return (
    <Routes>
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="*" element={<LoginPage />} />
    </Routes>
  );
}

/** Affiche la page de connexion tant qu'il n'y a pas de session, l'application sinon. */
function AuthGate({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { data, error, isPending } = useMe();

  // Le lien reçu par e-mail s'ouvre avec ou sans session.
  if (pathname === '/reset-password') {
    return <ResetPasswordPage />;
  }
  if (isPending) {
    return <p className="p-6 text-slate-500">{t('collection.loading')}</p>;
  }
  // Le 401 d'abord : après une déconnexion ou une expiration, la dernière donnée connue reste en
  // cache à côté de l'erreur, et ne doit pas ouvrir l'application.
  if (error instanceof ApiError && error.status === 401) {
    return <PublicRoutes />;
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
