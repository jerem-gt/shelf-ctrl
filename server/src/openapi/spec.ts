import { createAuthOpenApiPaths } from '@jerem-gt/ctrl-shared/server/auth';
import {
  body,
  errorResponse,
  errorSchema,
  optionalBody,
  pId,
  queryParams,
  r200,
  r201,
  r202,
  r204,
  r400,
  r404,
  r409,
  rawBody,
  sessionAuth,
  sessionCookieScheme,
} from '@jerem-gt/ctrl-shared/server/openapi';

import { ERROR_MESSAGES } from '../lib/errorCodes.js';
import { LANGUAGES, SESSION_COOKIE } from '../modules/auth/authOptions.js';
import {
  createCopySchema,
  listCopiesSchema,
  updateCopySchema,
} from '../modules/copies/copies.schema.js';
import { templateQuerySchema } from '../modules/import/import.routes.js';
import { lendSchema, returnSchema } from '../modules/loans/loans.schema.js';
import {
  createPlatformSchema,
  setDefaultSchema,
  updatePlatformSchema,
} from '../modules/platforms/platforms.schema.js';
import { listSchema, sellSchema, updateSaleSchema } from '../modules/sales/sales.schema.js';
import { querySchema as titleQuerySchema } from '../modules/titles/titles.routes.js';

// Helpers communs avec cash-ctrl : @jerem-gt/ctrl-shared/server/openapi.
const r415 = { 415: errorResponse('Unsupported image') };

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
      schemas: { Error: errorSchema(Object.keys(ERROR_MESSAGES)) },
      securitySchemes: sessionCookieScheme(SESSION_COOKIE),
    },
    paths: {
      // ── Auth et utilisateurs (admin) : module d'auth de ctrl-shared ─────
      ...createAuthOpenApiPaths({
        languages: LANGUAGES,
        tags: { auth: 'Auth', users: 'Utilisateurs' },
      }),

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
          responses: { ...r200(), ...r400, ...r404 },
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
          responses: { ...r204, ...r400, ...r404 },
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
          responses: { ...r200(), ...r400, ...r404, ...r415 },
        },
        delete: {
          tags: ['Images'],
          summary: "Retirer la pochette d'une édition",
          security: sessionAuth,
          parameters: pId,
          responses: { ...r204, ...r400, ...r404 },
        },
      },
      '/api/editions/{id}/cover/fetch': {
        post: {
          tags: ['Images'],
          summary: 'Rechercher la pochette en ligne et remplacer la pochette actuelle',
          security: sessionAuth,
          parameters: pId,
          responses: { ...r200(), ...r400, ...r404 },
        },
      },
      '/api/copies/{id}/photo': {
        put: {
          tags: ['Images'],
          summary: "Envoyer la photo d'un exemplaire (12 Mo max, convertie en WebP)",
          security: sessionAuth,
          parameters: pId,
          requestBody: rawBody(IMAGE_TYPES),
          responses: { ...r200(), ...r400, ...r404, ...r415 },
        },
        delete: {
          tags: ['Images'],
          summary: "Retirer la photo d'un exemplaire",
          security: sessionAuth,
          parameters: pId,
          responses: { ...r204, ...r400, ...r404 },
        },
      },

      // ── Prêts ────────────────────────────────────────────────────────────
      '/api/copies/{id}/loans': {
        get: {
          tags: ['Prêts'],
          summary: "Historique des prêts d'un exemplaire",
          security: sessionAuth,
          parameters: pId,
          responses: { ...r200(), ...r400, ...r404 },
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
          responses: { ...r200(), ...r400, ...r404 },
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
          responses: { ...r204, ...r400, ...r404 },
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
          responses: { ...r204, ...r400, ...r404 },
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
          summary: 'Modèle de fichier CSV (en-têtes et exemples dans la langue demandée)',
          security: sessionAuth,
          parameters: queryParams(templateQuerySchema),
          responses: { ...r200('CSV file download'), ...r400 },
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
