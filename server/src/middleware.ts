// Module d'auth de ctrl-shared : `currentUserId` lit le compte posé par `requireAuth` (ou `actAs`
// sans authentification, dans les tests de modules).
export { actAs, currentUserId } from '@jerem-gt/ctrl-shared/server/auth';
