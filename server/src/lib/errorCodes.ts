/**
 * Registre unique des codes d'erreur de l'API et de leurs messages FR de repli.
 *
 * Le serveur renvoie `{ error: { code, message, params? } }` : `code` est la clé
 * stable traduite côté client (namespace i18n `errors`), `message` est le rendu FR
 * (repli si une traduction manque, et lisibilité en debug/logs). Les templates
 * utilisent des placeholders `{{param}}` interpolés par `renderMessage`.
 */
export const ERROR_MESSAGES = {
  // ── Communs ───────────────────────────────────────────────────────────────
  'common.unauthorized': 'Non authentifié',
  'common.forbidden': 'Accès refusé',
  'common.invalid_request': 'Requête invalide',
  'common.internal': 'Erreur interne du serveur.',
  'common.payload_too_large': 'Requête trop volumineuse',
  'common.unsupported_media_type': 'Type de contenu non pris en charge',

  // ── Validation (par champ) ────────────────────────────────────────────────
  'validation.invalid': 'Données invalides',
  'validation.required': 'Ce champ est requis',
  'validation.invalid_type': 'Type de valeur incorrect',
  'validation.too_small': 'La valeur doit être au moins {{minimum}}',
  'validation.too_big': 'La valeur ne doit pas dépasser {{maximum}}',
  'validation.too_short': 'Doit contenir au moins {{minimum}} caractère(s)',
  'validation.too_long': 'Doit contenir au plus {{maximum}} caractère(s)',
  'validation.invalid_format': 'Format invalide',
  'validation.invalid_value': 'Valeur non autorisée',

  // ── Exemplaires et éditions ───────────────────────────────────────────────
  'copy.not_found': 'Exemplaire introuvable',
  'edition.not_found': 'Édition introuvable',

  // ── Prêts ─────────────────────────────────────────────────────────────────
  'loan.not_found': 'Prêt introuvable',
  'loan.copy_sold': 'Un exemplaire vendu ne peut pas être prêté',
  'loan.already_loaned': 'Cet exemplaire est déjà prêté',
  'loan.already_returned': 'Ce prêt est déjà rendu',
  'loan.invalid_date': 'La date de retour précède celle du prêt',

  // ── Ventes ────────────────────────────────────────────────────────────────
  'sale.not_found': 'Aucune annonce ni vente pour cet exemplaire',
  'sale.already_listed': 'Cet exemplaire est déjà en vente',
  'sale.already_sold': 'Cet exemplaire est déjà vendu',
  'sale.copy_loaned': 'Un exemplaire prêté ne peut pas être vendu',
  'sale.invalid_date': 'La date de vente précède celle de la mise en vente',

  // ── Plateformes de vente ──────────────────────────────────────────────────
  'platform.not_found': 'Plateforme introuvable',
  'platform.duplicate': 'Cette plateforme existe déjà',

  // ── Images ────────────────────────────────────────────────────────────────
  'image.invalid': 'Image illisible',
  'image.no_cover_found': 'Aucune pochette trouvée en ligne',

  // ── Codes-barres ──────────────────────────────────────────────────────────
  'barcode.invalid': 'Code-barres invalide',
  'barcode.not_found': 'Code-barres introuvable',

  // ── Import CSV ────────────────────────────────────────────────────────────
  'import.empty_file': 'Fichier vide',
  'import.no_columns': 'Aucune colonne titre ni code-barres',
  'import.too_many_rows': 'Le fichier dépasse {{max}} lignes',
  'import.running': 'Un import est déjà en cours',
  'import.not_found': 'Import introuvable',

  // ── Utilisateurs ──────────────────────────────────────────────────────────
  'user.not_found': 'Utilisateur introuvable',
  'user.username_taken': "Nom d'utilisateur déjà utilisé",
  'user.email_taken': 'Adresse e-mail déjà utilisée',
  'user.last_admin': 'Il doit rester au moins un administrateur',
  'user.cannot_delete_self': 'Vous ne pouvez pas supprimer votre propre compte',

  // ── Authentification ──────────────────────────────────────────────────────
  'auth.invalid_credentials': 'Identifiants invalides',
  'auth.too_many_attempts': 'Trop de tentatives. Réessayez plus tard.',
  'auth.current_password_incorrect': 'Mot de passe actuel incorrect',
  'auth.setup_done': 'La configuration initiale est déjà terminée',
  'auth.setup_token_invalid': 'Jeton de configuration invalide',
  'auth.reset_token_invalid': 'Lien de réinitialisation invalide ou expiré',
  'auth.email_missing': "Aucune adresse e-mail n'est renseignée pour ce compte",
  'auth.smtp_not_configured': "L'envoi d'e-mails n'est pas configuré sur le serveur",
  'auth.email_send_failed': "Échec de l'envoi de l'e-mail",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;
export type ErrorParams = Record<string, string | number>;

export interface ApiErrorField {
  path: string;
  code: ErrorCode;
  params?: ErrorParams;
  message: string;
}

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  params?: ErrorParams;
  fields?: ApiErrorField[];
}

/** Interpole les placeholders `{{key}}` d'un template avec les params fournis. */
export function renderMessage(code: ErrorCode, params?: ErrorParams): string {
  const template = ERROR_MESSAGES[code];
  if (!params) return template;
  return template.replaceAll(/\{\{(\w+)\}\}/g, (_match, key: string) =>
    key in params ? String(params[key]) : `{{${key}}}`,
  );
}

/** Construit le corps d'erreur structuré renvoyé au client. */
export function buildError(code: ErrorCode, params?: ErrorParams): ApiErrorBody {
  return { code, message: renderMessage(code, params), ...(params ? { params } : {}) };
}
