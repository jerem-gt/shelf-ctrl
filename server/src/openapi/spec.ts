import type { ZodType } from 'zod';
import { toJSONSchema } from 'zod';

import { ERROR_MESSAGES } from '../lib/errorCodes.js';
import { SESSION_COOKIE } from '../modules/auth/auth.routes.js';
import {
  changePasswordSchema,
  disableTotpSchema,
  enableTotpSchema,
  forgotPasswordSchema,
  loginSchema,
  profileSchema,
  resetPasswordSchema,
  setupSchema,
  verifyTotpSchema,
} from '../modules/auth/auth.schema.js';
import {
  createCopySchema,
  listCopiesSchema,
  updateCopySchema,
} from '../modules/copies/copies.schema.js';
import { lendSchema, returnSchema } from '../modules/loans/loans.schema.js';
import {
  createPlatformSchema,
  setDefaultSchema,
  updatePlatformSchema,
} from '../modules/platforms/platforms.schema.js';
import { listSchema, sellSchema, updateSaleSchema } from '../modules/sales/sales.schema.js';
import { querySchema as titleQuerySchema } from '../modules/titles/titles.routes.js';
import { createUserSchema, updateUserSchema } from '../modules/users/users.schema.js';

// ─── helpers ───────────────────────────────────────────────────────────────

const TO_JSON_OPTS = { unrepresentable: 'any' } as const;

function schema(zod: ZodType) {
  return toJSONSchema(zod, TO_JSON_OPTS);
}

function body(zod: ZodType) {
  return {
    required: true,
    content: { 'application/json': { schema: schema(zod) } },
  };
}

/** Corps facultatif : les dates par défaut valent aujourd'hui. */
function optionalBody(zod: ZodType) {
  return { ...body(zod), required: false };
}

/** Corps brut (fichier envoyé tel quel), comme `express.raw`. */
function rawBody(mediaTypes: readonly string[]) {
  return {
    required: true,
    content: Object.fromEntries(
      mediaTypes.map((type) => [type, { schema: { type: 'string', format: 'binary' } }]),
    ),
  };
}

// Convertit les propriétés d'un schéma Zod objet en paramètres de requête OpenAPI.
function queryParams(zod: ZodType) {
  const js = toJSONSchema(zod, { ...TO_JSON_OPTS, io: 'input' }) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  if (!js.properties) return [];
  return Object.entries(js.properties).map(([name, propSchema]) => ({
    name,
    in: 'query',
    required: (js.required ?? []).includes(name),
    schema: propSchema,
  }));
}

const r200 = (description = 'OK') => ({ 200: { description } });
const r201 = { 201: { description: 'Created' } };
const r202 = { 202: { description: 'Accepted' } };
const r204 = { 204: { description: 'No Content' } };
// Corps `{ error: { code, message, params?, fields? } }` (cf. lib/errorCodes.ts).
const ERROR_CODES = Object.keys(ERROR_MESSAGES);
const errorBodySchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string', enum: ERROR_CODES },
        message: { type: 'string', description: 'Message FR de repli' },
        params: { type: 'object', additionalProperties: { type: ['string', 'number'] } },
        fields: {
          type: 'array',
          description: 'Détail par champ (validation)',
          items: {
            type: 'object',
            required: ['path', 'code', 'message'],
            properties: {
              path: { type: 'string' },
              code: { type: 'string', enum: ERROR_CODES },
              message: { type: 'string' },
              params: { type: 'object', additionalProperties: { type: ['string', 'number'] } },
            },
          },
        },
      },
    },
  },
};
const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const r400 = { 400: errorResponse('Validation error') };
const r401 = { 401: errorResponse('Unauthorized') };
const r403 = { 403: errorResponse('Forbidden (admin only)') };
const r404 = { 404: errorResponse('Not found') };
const r409 = { 409: errorResponse('Conflict') };
const r415 = { 415: errorResponse('Unsupported image') };
const r429 = { 429: errorResponse('Too many failures') };

const sessionAuth = [{ sessionCookie: [] }];

function pathInt(name: string) {
  return { name, in: 'path', required: true, schema: { type: 'integer' } };
}

const pId = [pathInt('id')];

const IMAGE_TYPES = ['image/*', 'application/octet-stream'] as const;
const CSV_TYPES = ['application/octet-stream'] as const;

// ─── spec ──────────────────────────────────────────────────────────────────

export function buildOpenApiSpec() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'ShelfCtrl API',
      version: '1.0.0',
      description: 'API REST interne de ShelfCtrl (collection de BD, DVD et Blu-ray).',
    },
    components: {
      schemas: { Error: errorBodySchema },
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: SESSION_COOKIE,
          description: 'Cookie de session posé par POST /api/auth/login.',
        },
      },
    },
    paths: {
      // ── Auth ─────────────────────────────────────────────────────────────
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Connexion (`{ totpRequired: true }` si la 2FA attend un code)',
          requestBody: body(loginSchema),
          responses: {
            ...r200('Session started or TOTP code required'),
            ...r400,
            ...r401,
            ...r429,
          },
        },
      },
      '/api/auth/2fa/verify': {
        post: {
          tags: ['Auth'],
          summary:
            'Second temps de la connexion : code TOTP (à usage unique), « se souvenir » 30 jours',
          requestBody: body(verifyTotpSchema),
          responses: {
            ...r200('Session started'),
            ...r400,
            401: errorResponse('Invalid code or expired login'),
            ...r429,
          },
        },
      },
      '/api/auth/2fa/setup': {
        post: {
          tags: ['Auth'],
          summary: 'Proposer un secret TOTP (QR code), gardé en session jusqu’à sa confirmation',
          security: sessionAuth,
          responses: { ...r200(), ...r401, 409: errorResponse('2FA already enabled') },
        },
      },
      '/api/auth/2fa/enable': {
        post: {
          tags: ['Auth'],
          summary: 'Activer la 2FA avec un premier code (révoque les appareils mémorisés)',
          security: sessionAuth,
          requestBody: body(enableTotpSchema),
          responses: {
            ...r204,
            400: errorResponse('Validation error or no pending secret'),
            401: errorResponse('Invalid code'),
            409: errorResponse('2FA already enabled'),
          },
        },
      },
      '/api/auth/2fa/disable': {
        post: {
          tags: ['Auth'],
          summary: 'Désactiver la 2FA (mot de passe actuel requis, révoque les appareils)',
          security: sessionAuth,
          requestBody: body(disableTotpSchema),
          responses: { ...r204, ...r400, ...r401, 409: errorResponse('2FA not enabled'), ...r429 },
        },
      },
      '/api/auth/devices': {
        get: {
          tags: ['Auth'],
          summary: 'Appareils mémorisés du compte',
          security: sessionAuth,
          responses: { ...r200(), ...r401 },
        },
        delete: {
          tags: ['Auth'],
          summary: 'Oublier tous les appareils mémorisés',
          security: sessionAuth,
          responses: { ...r204, ...r401 },
        },
      },
      '/api/auth/devices/{id}': {
        delete: {
          tags: ['Auth'],
          summary: 'Oublier un appareil mémorisé',
          security: sessionAuth,
          parameters: pId,
          responses: { ...r204, ...r400, ...r401, ...r404 },
        },
      },
      '/api/auth/setup': {
        get: {
          tags: ['Auth'],
          summary: 'Premier démarrage : création du premier compte attendue ?',
          responses: r200(),
        },
        post: {
          tags: ['Auth'],
          summary: 'Créer le premier compte (admin), avec le jeton écrit dans les logs',
          requestBody: body(setupSchema),
          responses: {
            ...r200('Session started'),
            ...r400,
            403: errorResponse('Invalid setup token'),
            409: errorResponse('An account already exists'),
            ...r429,
          },
        },
      },
      '/api/auth/profile': {
        patch: {
          tags: ['Auth'],
          summary: 'Modifier son nom ou son e-mail (mot de passe actuel requis)',
          security: sessionAuth,
          requestBody: body(profileSchema),
          responses: { ...r200(), ...r400, ...r401, ...r409, ...r429 },
        },
      },
      '/api/auth/change-password': {
        post: {
          tags: ['Auth'],
          summary: 'Changer son mot de passe (ferme les autres sessions)',
          security: sessionAuth,
          requestBody: body(changePasswordSchema),
          responses: { ...r204, ...r400, ...r401, ...r429 },
        },
      },
      '/api/auth/password/forgot': {
        post: {
          tags: ['Auth'],
          summary:
            'Mot de passe oublié : lien par e-mail (réponse identique si le compte est inconnu)',
          requestBody: body(forgotPasswordSchema),
          responses: { ...r204, ...r400, ...r429 },
        },
      },
      '/api/auth/password/reset': {
        post: {
          tags: ['Auth'],
          summary: 'Nouveau mot de passe avec le jeton reçu (ferme toutes les sessions)',
          requestBody: body(resetPasswordSchema),
          responses: {
            ...r204,
            400: errorResponse('Validation error or invalid token'),
            ...r429,
          },
        },
      },
      '/api/auth/test-email': {
        post: {
          tags: ['Auth'],
          summary: "Envoyer un e-mail de test à l'admin connecté",
          security: sessionAuth,
          responses: {
            ...r204,
            400: errorResponse('No email on the account'),
            ...r401,
            ...r403,
            502: errorResponse('Sending failed'),
            503: errorResponse('SMTP not configured'),
          },
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Déconnexion',
          responses: r204,
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Utilisateur connecté',
          responses: { ...r200(), ...r401 },
        },
      },

      // ── Utilisateurs (admin) ─────────────────────────────────────────────
      '/api/users': {
        get: {
          tags: ['Utilisateurs'],
          summary: 'Liste des comptes',
          security: sessionAuth,
          responses: { ...r200(), ...r401, ...r403 },
        },
        post: {
          tags: ['Utilisateurs'],
          summary: 'Créer un compte',
          security: sessionAuth,
          requestBody: body(createUserSchema),
          responses: { ...r201, ...r400, ...r401, ...r403, ...r409 },
        },
      },
      '/api/users/{id}': {
        patch: {
          tags: ['Utilisateurs'],
          summary: 'Modifier un compte (nom, e-mail, mot de passe, rôle admin)',
          security: sessionAuth,
          parameters: pId,
          requestBody: body(updateUserSchema),
          responses: { ...r200(), ...r400, ...r401, ...r403, ...r404, ...r409 },
        },
        delete: {
          tags: ['Utilisateurs'],
          summary: 'Supprimer un compte, ses données et ses images',
          security: sessionAuth,
          parameters: pId,
          responses: { ...r204, ...r401, ...r403, ...r404, ...r409 },
        },
      },
      '/api/users/{id}/2fa': {
        delete: {
          tags: ['Utilisateurs'],
          summary: 'Désactiver la 2FA d’un compte (téléphone perdu), révoque ses appareils',
          security: sessionAuth,
          parameters: pId,
          responses: {
            ...r204,
            ...r400,
            ...r401,
            ...r403,
            ...r404,
            409: errorResponse('2FA not enabled'),
          },
        },
      },

      // ── Exemplaires ──────────────────────────────────────────────────────
      '/api/copies': {
        get: {
          tags: ['Exemplaires'],
          summary: 'Liste des exemplaires (recherche, format, statut, pagination)',
          security: sessionAuth,
          parameters: queryParams(listCopiesSchema),
          responses: { ...r200(), ...r400 },
        },
        post: {
          tags: ['Exemplaires'],
          summary: 'Ajouter un exemplaire (œuvre et édition créées ou réutilisées)',
          security: sessionAuth,
          requestBody: body(createCopySchema),
          responses: { ...r201, ...r400 },
        },
      },
      '/api/copies/{id}': {
        get: {
          tags: ['Exemplaires'],
          summary: "Fiche d'un exemplaire",
          security: sessionAuth,
          parameters: pId,
          responses: { ...r200(), ...r404 },
        },
        patch: {
          tags: ['Exemplaires'],
          summary: 'Modifier un exemplaire',
          security: sessionAuth,
          parameters: pId,
          requestBody: body(updateCopySchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
        delete: {
          tags: ['Exemplaires'],
          summary: 'Supprimer un exemplaire',
          security: sessionAuth,
          parameters: pId,
          responses: { ...r204, ...r404 },
        },
      },

      // ── Images ───────────────────────────────────────────────────────────
      '/api/editions/{id}/cover': {
        put: {
          tags: ['Images'],
          summary: "Envoyer la pochette d'une édition (12 Mo max, convertie en WebP)",
          security: sessionAuth,
          parameters: pId,
          requestBody: rawBody(IMAGE_TYPES),
          responses: { ...r200(), ...r404, ...r415 },
        },
        delete: {
          tags: ['Images'],
          summary: "Retirer la pochette d'une édition",
          security: sessionAuth,
          parameters: pId,
          responses: { ...r204, ...r404 },
        },
      },
      '/api/editions/{id}/cover/fetch': {
        post: {
          tags: ['Images'],
          summary: 'Rechercher la pochette en ligne et remplacer la pochette actuelle',
          security: sessionAuth,
          parameters: pId,
          responses: { ...r200(), ...r404 },
        },
      },
      '/api/copies/{id}/photo': {
        put: {
          tags: ['Images'],
          summary: "Envoyer la photo d'un exemplaire (12 Mo max, convertie en WebP)",
          security: sessionAuth,
          parameters: pId,
          requestBody: rawBody(IMAGE_TYPES),
          responses: { ...r200(), ...r404, ...r415 },
        },
        delete: {
          tags: ['Images'],
          summary: "Retirer la photo d'un exemplaire",
          security: sessionAuth,
          parameters: pId,
          responses: { ...r204, ...r404 },
        },
      },

      // ── Prêts ────────────────────────────────────────────────────────────
      '/api/copies/{id}/loans': {
        get: {
          tags: ['Prêts'],
          summary: "Historique des prêts d'un exemplaire",
          security: sessionAuth,
          parameters: pId,
          responses: { ...r200(), ...r404 },
        },
        post: {
          tags: ['Prêts'],
          summary: 'Prêter un exemplaire',
          security: sessionAuth,
          parameters: pId,
          requestBody: body(lendSchema),
          responses: { ...r201, ...r400, ...r404, ...r409 },
        },
      },
      '/api/loans': {
        get: {
          tags: ['Prêts'],
          summary: 'Prêts en cours',
          security: sessionAuth,
          responses: r200(),
        },
      },
      '/api/loans/{id}/return': {
        post: {
          tags: ['Prêts'],
          summary: 'Enregistrer le retour (id : exemplaire prêté)',
          security: sessionAuth,
          parameters: pId,
          requestBody: optionalBody(returnSchema),
          responses: { ...r200(), ...r400, ...r404, ...r409 },
        },
      },
      '/api/borrowers': {
        get: {
          tags: ['Prêts'],
          summary: 'Emprunteurs connus',
          security: sessionAuth,
          responses: r200(),
        },
      },

      // ── Ventes ───────────────────────────────────────────────────────────
      '/api/copies/{id}/sale': {
        get: {
          tags: ['Ventes'],
          summary: "Annonce ou vente d'un exemplaire",
          security: sessionAuth,
          parameters: pId,
          responses: { ...r200(), ...r404 },
        },
        post: {
          tags: ['Ventes'],
          summary: 'Mettre en vente',
          security: sessionAuth,
          parameters: pId,
          requestBody: optionalBody(listSchema),
          responses: { ...r201, ...r400, ...r404, ...r409 },
        },
        patch: {
          tags: ['Ventes'],
          summary: "Modifier l'annonce ou la vente",
          security: sessionAuth,
          parameters: pId,
          requestBody: body(updateSaleSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
        delete: {
          tags: ['Ventes'],
          summary: "Retirer l'annonce ou annuler la vente",
          security: sessionAuth,
          parameters: pId,
          responses: { ...r204, ...r404 },
        },
      },
      '/api/copies/{id}/sale/sold': {
        post: {
          tags: ['Ventes'],
          summary: 'Marquer comme vendu (avec ou sans annonce préalable)',
          security: sessionAuth,
          parameters: pId,
          requestBody: optionalBody(sellSchema),
          responses: { ...r200(), ...r400, ...r404, ...r409 },
        },
      },
      '/api/sales': {
        get: {
          tags: ['Ventes'],
          summary: 'Annonces et ventes',
          security: sessionAuth,
          responses: r200(),
        },
      },

      // ── Plateformes ──────────────────────────────────────────────────────
      '/api/platforms': {
        get: {
          tags: ['Plateformes'],
          summary: 'Plateformes de vente du compte',
          security: sessionAuth,
          responses: r200(),
        },
        post: {
          tags: ['Plateformes'],
          summary: 'Ajouter une plateforme',
          security: sessionAuth,
          requestBody: body(createPlatformSchema),
          responses: { ...r201, ...r400, ...r409 },
        },
      },
      '/api/platforms/default': {
        put: {
          tags: ['Plateformes'],
          summary: 'Choisir la plateforme par défaut (null : aucune)',
          security: sessionAuth,
          requestBody: body(setDefaultSchema),
          responses: { ...r204, ...r400, ...r404 },
        },
      },
      '/api/platforms/{id}': {
        patch: {
          tags: ['Plateformes'],
          summary: "Modifier l'adresse de dépôt",
          security: sessionAuth,
          parameters: pId,
          requestBody: body(updatePlatformSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
        delete: {
          tags: ['Plateformes'],
          summary: 'Retirer une plateforme',
          security: sessionAuth,
          parameters: pId,
          responses: { ...r204, ...r404 },
        },
      },

      // ── Recherche ────────────────────────────────────────────────────────
      '/api/barcodes/{code}': {
        get: {
          tags: ['Recherche'],
          summary: 'Résoudre un code-barres (collection, puis sources en ligne)',
          security: sessionAuth,
          parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { ...r200(), ...r400, ...r404 },
        },
      },
      '/api/titles/search': {
        get: {
          tags: ['Recherche'],
          summary: 'Rechercher par titre (livres et films, liste vide sans résultat)',
          security: sessionAuth,
          parameters: queryParams(titleQuerySchema),
          responses: { ...r200(), ...r400 },
        },
      },

      // ── Import ───────────────────────────────────────────────────────────
      '/api/import/template': {
        get: {
          tags: ['Import'],
          summary: 'Modèle de fichier CSV',
          security: sessionAuth,
          responses: r200('CSV file download'),
        },
      },
      '/api/import/preview': {
        post: {
          tags: ['Import'],
          summary: 'Contrôler un fichier CSV sans rien écrire (2 Mo, 1000 lignes max)',
          security: sessionAuth,
          requestBody: rawBody(CSV_TYPES),
          responses: { ...r200(), ...r400 },
        },
      },
      '/api/import': {
        post: {
          tags: ['Import'],
          summary: 'Lancer un import en tâche de fond',
          security: sessionAuth,
          requestBody: rawBody(CSV_TYPES),
          responses: { ...r202, ...r400, ...r409 },
        },
      },
      '/api/import/{id}': {
        get: {
          tags: ['Import'],
          summary: "Suivi d'un import",
          security: sessionAuth,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { ...r200(), ...r404 },
        },
      },

      // ── Système ──────────────────────────────────────────────────────────
      '/api/health': {
        get: {
          tags: ['System'],
          summary: 'Health check',
          responses: { ...r200(), 503: { description: 'Unhealthy' } },
        },
      },
    },
  };
}
