import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router';

import { ApiError } from '@/api/client';
import { AccountMenu } from '@/components/AccountMenu';
import { ME_KEY, useMe, useSetupStatus } from '@/hooks/useAuth';
import { COLLECTION_ROUTES, matchesAnyRoute } from '@/lib/navigation';
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

const ACTIVE_NAV = 'text-content underline underline-offset-4';
const IDLE_NAV = 'text-content-subtle hover:text-content';

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? ACTIVE_NAV : IDLE_NAV;
}

export function AppRoutes() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isAdmin = useMe().data?.isAdmin === true;
  // La collection reste l'onglet actif sur ses pages (ajout, import, fiche d'un exemplaire).
  const inCollection = pathname === '/' || matchesAnyRoute(pathname, COLLECTION_ROUTES);

  return (
    <div className="min-h-screen bg-canvas text-content">
      <header className="border-b border-line-subtle bg-surface">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:gap-x-6">
          <Link to="/" className="order-1 text-xl font-bold">
            <h1>{t('appName')}</h1>
          </Link>
          <nav
            aria-label={t('nav.main')}
            className="order-3 flex w-full flex-wrap gap-x-4 gap-y-1 text-sm font-medium sm:order-2 sm:w-auto"
          >
            <Link
              to="/"
              aria-current={inCollection ? 'page' : undefined}
              className={navClass({ isActive: inCollection })}
            >
              {t('nav.collection')}
            </Link>
            <NavLink to="/loans" className={navClass}>
              {t('nav.loans')}
            </NavLink>
            <NavLink to="/sales" className={navClass}>
              {t('nav.sales')}
            </NavLink>
          </nav>
          <div className="order-2 ml-auto sm:order-3">
            <AccountMenu />
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
    return <p className="p-6 text-content-subtle">{t('collection.loading')}</p>;
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
    return <p className="p-6 text-content-subtle">{t('collection.loading')}</p>;
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
    <p role="alert" className="p-6 text-danger">
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
