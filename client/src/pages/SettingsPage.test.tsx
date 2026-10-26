import type { PlatformItem } from '@shelfctrl/types';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { SettingsPage } from './SettingsPage';

/** Serveur de réglages simulé, avec son état : la page recharge la liste après chaque action. */
function stubServer(initial: PlatformItem[] = []) {
  let items = [...initial];
  let nextId = 100;
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const log = async (request: Request) => {
    const text = await request.text();
    calls.push({
      method: request.method,
      url: new URL(request.url).pathname,
      body: text ? JSON.parse(text) : undefined,
    });
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  };

  server.use(
    http.get('/api/platforms', () => HttpResponse.json({ items })),
    http.post('/api/platforms', async ({ request }) => {
      const body = (await log(request)) as { name: string; publishUrl?: string };
      if (items.some((item) => item.name.toLowerCase() === body.name.toLowerCase())) {
        return HttpResponse.json({ error: 'duplicate' }, { status: 409 });
      }
      // Comme le serveur : adresse de dépôt en http/https seulement
      if (body.publishUrl !== undefined && !/^https?:\/\//i.test(body.publishUrl)) {
        return HttpResponse.json({ error: 'validation' }, { status: 400 });
      }
      const created = {
        id: nextId++,
        name: body.name,
        publishUrl: body.publishUrl ?? null,
        isDefault: items.length === 0,
      };
      items = [...items, created].sort((a, b) => a.name.localeCompare(b.name));
      return HttpResponse.json(created, { status: 201 });
    }),
    http.put('/api/platforms/default', async ({ request }) => {
      const body = (await log(request)) as { id: number | null };
      items = items.map((item) => ({ ...item, isDefault: item.id === body.id }));
      return new HttpResponse(null, { status: 204 });
    }),
    http.patch('/api/platforms/:id', async ({ request, params }) => {
      const body = (await log(request)) as { publishUrl: string | null };
      items = items.map((item) =>
        item.id === Number(params.id) ? { ...item, publishUrl: body.publishUrl } : item,
      );
      return HttpResponse.json(items.find((item) => item.id === Number(params.id)));
    }),
    http.delete('/api/platforms/:id', async ({ request, params }) => {
      await log(request);
      items = items.filter((item) => item.id !== Number(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { calls };
}

const URL_LABEL = "Adresse de la page de dépôt d'annonce (facultative)";

const VINTED: PlatformItem = { id: 1, name: 'Vinted', publishUrl: null, isDefault: true };
const BDFUGUE: PlatformItem = {
  id: 2,
  name: 'BDfugue',
  publishUrl: 'https://www.bdfugue.com/vendre',
  isDefault: false,
};

describe('SettingsPage — plateformes', () => {
  it('liste les plateformes connues, décochées, sans plateforme par défaut possible', async () => {
    stubServer();
    renderWithProviders(<SettingsPage />, '/settings');

    expect(await screen.findByRole('checkbox', { name: 'Vinted' })).not.toBeChecked();
    expect(screen.getAllByRole('checkbox')).toHaveLength(6);
    expect(screen.getByText('Aucune autre plateforme.')).toBeInTheDocument();
    expect(screen.getByLabelText('Plateforme par défaut')).toBeDisabled();
  });

  it('coche une plateforme connue, la première devenant la plateforme par défaut', async () => {
    const { calls } = stubServer();
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, '/settings');

    await user.click(await screen.findByRole('checkbox', { name: 'Vinted' }));

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Vinted' })).toBeChecked());
    expect(calls).toEqual([{ method: 'POST', url: '/api/platforms', body: { name: 'Vinted' } }]);
    expect(screen.getByLabelText('Plateforme par défaut')).toHaveValue('100');
  });

  it('décoche une plateforme pour la retirer', async () => {
    const { calls } = stubServer([VINTED]);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, '/settings');

    await user.click(await screen.findByRole('checkbox', { name: 'Vinted' }));

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Vinted' })).not.toBeChecked());
    expect(calls).toEqual([{ method: 'DELETE', url: '/api/platforms/1', body: undefined }]);
  });

  it('ajoute une plateforme personnalisée avec son adresse de dépôt', async () => {
    const { calls } = stubServer();
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, '/settings');

    await user.type(await screen.findByLabelText('Nom'), '  BDfugue ');
    await user.type(screen.getByLabelText(URL_LABEL), 'https://www.bdfugue.com/vendre');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByRole('list', { name: 'Autres plateformes' })).toHaveTextContent(
      'BDfugue',
    );
    expect(calls[0]).toEqual({
      method: 'POST',
      url: '/api/platforms',
      body: { name: 'BDfugue', publishUrl: 'https://www.bdfugue.com/vendre' },
    });
    expect(screen.getByLabelText('Nom')).toHaveValue('');
  });

  it('refuse un doublon et une adresse invalide avec un message clair', async () => {
    stubServer([VINTED]);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, '/settings');

    await user.type(await screen.findByLabelText('Nom'), 'vinted');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cette plateforme existe déjà.');

    await user.clear(screen.getByLabelText('Nom'));
    await user.type(screen.getByLabelText('Nom'), 'Autre');
    await user.type(screen.getByLabelText(URL_LABEL), 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByText(/Nom ou adresse invalide/)).toBeInTheDocument();
  });

  it('change la plateforme par défaut, ou n’en garde aucune', async () => {
    const { calls } = stubServer([BDFUGUE, VINTED]);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, '/settings');
    const select = await screen.findByLabelText('Plateforme par défaut');
    expect(select).toHaveValue('1');

    await user.selectOptions(select, 'BDfugue');
    await waitFor(() => expect(screen.getByLabelText('Plateforme par défaut')).toHaveValue('2'));
    await user.selectOptions(screen.getByLabelText('Plateforme par défaut'), 'Aucune');

    await waitFor(() => expect(screen.getByLabelText('Plateforme par défaut')).toHaveValue(''));
    expect(calls.map((call) => call.body)).toEqual([{ id: 2 }, { id: null }]);
  });

  it('modifie l’adresse d’une plateforme personnalisée, seulement quand elle change', async () => {
    const { calls } = stubServer([BDFUGUE]);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, '/settings');

    const save = await screen.findByRole('button', { name: "Enregistrer l'adresse" });
    expect(save).toBeDisabled();
    const url = screen.getByDisplayValue('https://www.bdfugue.com/vendre');
    await user.clear(url);
    await user.type(url, 'https://www.bdfugue.com/nouveau');
    await user.click(save);

    await waitFor(() =>
      expect(calls).toEqual([
        {
          method: 'PATCH',
          url: '/api/platforms/2',
          body: { publishUrl: 'https://www.bdfugue.com/nouveau' },
        },
      ]),
    );
  });

  it('efface l’adresse en vidant le champ', async () => {
    const { calls } = stubServer([BDFUGUE]);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, '/settings');

    await user.clear(await screen.findByDisplayValue('https://www.bdfugue.com/vendre'));
    await user.click(screen.getByRole('button', { name: "Enregistrer l'adresse" }));

    await waitFor(() => expect(calls[0].body).toEqual({ publishUrl: null }));
  });

  it('retire une plateforme personnalisée', async () => {
    const { calls } = stubServer([BDFUGUE]);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, '/settings');

    await user.click(await screen.findByRole('button', { name: 'Retirer BDfugue' }));

    expect(await screen.findByText('Aucune autre plateforme.')).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'DELETE', url: '/api/platforms/2', body: undefined }]);
  });

  it('signale une liste impossible à charger', async () => {
    server.use(http.get('/api/platforms', () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<SettingsPage />, '/settings');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
