import type { ImportJob, ImportPreview } from '@shelfctrl/types';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { apiError } from '@/tests/msw/apiError';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { ImportPage } from './ImportPage';

const PREVIEW: ImportPreview = {
  total: 3,
  valid: 2,
  invalid: 1,
  duplicates: 1,
  toComplete: 2,
  ignoredColumns: ['Prix'],
  rows: [
    { line: 2, title: 'Tintin', barcode: null, issues: [], duplicate: false, willComplete: true },
    { line: 3, title: 'Alien', barcode: null, issues: [], duplicate: true, willComplete: true },
    {
      line: 4,
      title: 'Dune',
      barcode: null,
      issues: [{ code: 'invalid_volume', field: 'volume' }],
      duplicate: false,
      willComplete: false,
    },
  ],
};

const JOB: ImportJob = {
  id: 'abc',
  status: 'running',
  total: 4,
  processed: 1,
  created: 1,
  completed: 0,
  coversFound: 0,
  failures: [],
};

const csvFile = (content = 'Titre\nTintin\n', type = 'text/csv') =>
  new File([content], 'collection.csv', { type });

const stubPreview = (body: ImportPreview) =>
  server.use(http.post('/api/import/preview', () => HttpResponse.json(body)));
const stubJob = (job: ImportJob) =>
  server.use(http.get('/api/import/:id', () => HttpResponse.json(job)));

async function chooseFile(file = csvFile()) {
  const user = userEvent.setup({ applyAccept: false });
  renderWithProviders(<ImportPage />, '/import');
  await user.upload(screen.getByLabelText('Choisir un fichier CSV'), file);
  return user;
}

describe('ImportPage — fichier', () => {
  it('propose le modèle de fichier et le choix d’un CSV', () => {
    renderWithProviders(<ImportPage />, '/import');

    expect(screen.getByRole('link', { name: /fichier modèle/ })).toHaveAttribute(
      'href',
      '/api/import/template?lang=fr',
    );
    expect(screen.getByLabelText('Choisir un fichier CSV')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Importer/ })).not.toBeInTheDocument();
  });

  it('envoie le fichier tel quel pour l’aperçu et affiche le bilan', async () => {
    let received: { type: string | null; text: string } | undefined;
    server.use(
      http.post('/api/import/preview', async ({ request }) => {
        received = { type: request.headers.get('content-type'), text: await request.text() };
        return HttpResponse.json(PREVIEW);
      }),
    );

    await chooseFile(csvFile('Titre\nTintin\n'));

    expect(
      await screen.findByText('3 lignes lues : 2 importables, 1 à corriger.'),
    ).toBeInTheDocument();
    expect(received).toEqual({ type: 'application/octet-stream', text: 'Titre\nTintin\n' });
    expect(screen.getByText(/2 lignes seront complétées en ligne/)).toBeInTheDocument();
    expect(
      screen.getByText(/1 lignes correspondent à une édition déjà présente/),
    ).toBeInTheDocument();
    expect(screen.getByText('Colonnes ignorées : Prix.')).toBeInTheDocument();
  });

  it('liste les lignes à corriger avec leur problème et leur colonne', async () => {
    stubPreview(PREVIEW);

    await chooseFile();

    const list = await screen.findByRole('list', { name: 'Lignes à corriger' });
    expect(list).toHaveTextContent('Ligne 4 · Dune');
    expect(list).toHaveTextContent('Numéro de tome invalide (colonne tome)');
    expect(list).not.toHaveTextContent('Tintin');
  });

  it('indique quand rien n’est importable', async () => {
    stubPreview({ ...PREVIEW, valid: 0, invalid: 3, rows: PREVIEW.rows.slice(2) });

    await chooseFile();

    expect(await screen.findByText('Aucune ligne importable dans ce fichier.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Importer/ })).not.toBeInTheDocument();
  });

  it.each([
    ['import.no_columns', 400, /Aucune colonne « titre » ni « code-barres »/],
    ['import.empty_file', 400, /Le fichier est vide/],
    ['import.too_many_rows', 400, /trop de lignes \(1000 au maximum\)/],
  ])('explique l’erreur « %s » du serveur', async (code, status, message) => {
    server.use(http.post('/api/import/preview', () => apiError(code, status, { max: 1000 })));

    await chooseFile();

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('explique un fichier trop lourd', async () => {
    server.use(http.post('/api/import/preview', () => apiError('common.payload_too_large', 413)));

    await chooseFile();

    expect(await screen.findByRole('alert')).toHaveTextContent('2 Mo au maximum');
  });
});

describe('ImportPage — lecture du fichier', () => {
  it('lit le fichier une seule fois : l’aperçu et l’import portent sur le même contenu', async () => {
    stubPreview(PREVIEW);
    let previewed = '';
    let imported = '';
    server.use(
      http.post('/api/import/preview', async ({ request }) => {
        previewed = await request.text();
        return HttpResponse.json(PREVIEW);
      }),
      http.post('/api/import', async ({ request }) => {
        imported = await request.text();
        return HttpResponse.json(JOB, { status: 202 });
      }),
    );
    stubJob(JOB);
    const file = csvFile('Titre\nTintin\n');
    const read = vi.spyOn(file, 'arrayBuffer');

    const user = await chooseFile(file);
    await user.click(await screen.findByRole('button', { name: 'Importer 2 lignes' }));
    await screen.findByText('Import en cours : 1 / 4');

    // Si le fichier change sur le disque après l'aperçu, c'est quand même ce contenu qui part.
    expect(read).toHaveBeenCalledTimes(1);
    expect(imported).toBe('Titre\nTintin\n');
    expect(previewed).toBe(imported);
  });

  it('signale un fichier devenu illisible, sans rien envoyer', async () => {
    let called = false;
    server.use(
      http.post('/api/import/preview', () => {
        called = true;
        return HttpResponse.json(PREVIEW);
      }),
    );
    const file = csvFile();
    vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new Error('NotReadableError'));

    await chooseFile(file);

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de lire ce fichier');
    expect(called).toBe(false);
    expect(screen.queryByRole('button', { name: /Importer/ })).not.toBeInTheDocument();
  });
});

describe('ImportPage — import', () => {
  it('lance l’import du même fichier et affiche l’avancement', async () => {
    stubPreview(PREVIEW);
    let received = '';
    server.use(
      http.post('/api/import', async ({ request }) => {
        received = await request.text();
        return HttpResponse.json(JOB, { status: 202 });
      }),
    );
    stubJob(JOB);

    const user = await chooseFile(csvFile('Titre\nTintin\n'));
    await user.click(await screen.findByRole('button', { name: 'Importer 2 lignes' }));

    expect(await screen.findByText('Import en cours : 1 / 4')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: "Avancement de l'import" })).toHaveAttribute(
      'value',
      '1',
    );
    expect(received).toBe('Titre\nTintin\n');
  });

  it('signale un import déjà en cours', async () => {
    stubPreview(PREVIEW);
    server.use(http.post('/api/import', () => apiError('import.running', 409)));

    const user = await chooseFile();
    await user.click(await screen.findByRole('button', { name: 'Importer 2 lignes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Un import est déjà en cours');
  });

  it('affiche le rapport final avec les lignes non importées', async () => {
    stubJob({
      ...JOB,
      status: 'done',
      processed: 4,
      created: 2,
      completed: 1,
      coversFound: 1,
      failures: [
        { line: 5, title: null, issues: [{ code: 'not_found_online', field: 'title' }] },
        { line: 6, title: 'Dune', issues: [{ code: 'invalid', field: null }] },
      ],
    });

    renderWithProviders(<ImportPage />, '/import?job=abc');

    expect(await screen.findByText('Import terminé')).toBeInTheDocument();
    expect(screen.getByText('2 exemplaires créés')).toBeInTheDocument();
    expect(screen.getByText('1 complétés en ligne')).toBeInTheDocument();
    expect(screen.getByText('1 pochettes trouvées')).toBeInTheDocument();
    const failures = screen.getByRole('list', { name: 'Lignes non importées' });
    expect(failures).toHaveTextContent('Ligne 5 · (sans titre)');
    expect(failures).toHaveTextContent(
      'Code-barres inconnu en ligne et aucun titre dans le fichier',
    );
    expect(failures).toHaveTextContent('Ligne 6 · Dune');
    expect(screen.getByRole('link', { name: 'Voir la collection' })).toHaveAttribute('href', '/');
  });

  it('signale un import interrompu par une erreur', async () => {
    stubJob({ ...JOB, status: 'failed', created: 1 });

    renderWithProviders(<ImportPage />, '/import?job=abc');

    expect(await screen.findByText(/L'import s'est arrêté sur une erreur/)).toBeInTheDocument();
    expect(screen.getByText('1 exemplaires créés')).toBeInTheDocument();
  });

  it('explique un import introuvable et permet d’en relancer un', async () => {
    server.use(http.get('/api/import/:id', () => apiError('import.not_found', 404)));
    const user = userEvent.setup();
    renderWithProviders(<ImportPage />, '/import?job=perdu');

    expect(await screen.findByRole('alert')).toHaveTextContent('Cet import est introuvable');
    await user.click(screen.getByRole('button', { name: 'Nouvel import' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Choisir un fichier CSV')).toBeInTheDocument(),
    );
  });
});
