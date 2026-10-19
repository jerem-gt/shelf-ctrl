import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { COPY_TINTIN } from '@/tests/fixtures';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/renderWithProviders';

import { ImagesSection } from './ImagesSection';

const WITH_IMAGES = {
  ...COPY_TINTIN,
  photoPath: '1-bbbbbbbbbb.webp',
  edition: { ...COPY_TINTIN.edition, coverPath: '1-aaaaaaaaaa.webp' },
};

const image = (name = 'tintin.png', type = 'image/png') => new File(['x'], name, { type });

describe('ImagesSection', () => {
  it('propose d’ajouter une image quand il n’y en a pas', () => {
    renderWithProviders(<ImagesSection copy={COPY_TINTIN} />);

    expect(screen.getAllByText('Aucune image')).toHaveLength(2);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retirer' })).not.toBeInTheDocument();
  });

  it('affiche la pochette et la photo servies par le serveur', () => {
    renderWithProviders(<ImagesSection copy={WITH_IMAGES} />);

    expect(screen.getByRole('img', { name: 'Pochette de Tintin au Tibet' })).toHaveAttribute(
      'src',
      '/covers/1-aaaaaaaaaa.webp',
    );
    expect(
      screen.getByRole('img', { name: "Photo de l'exemplaire de Tintin au Tibet" }),
    ).toHaveAttribute('src', '/photos/1-bbbbbbbbbb.webp');
  });

  it('envoie la pochette choisie, avec son type, à l’édition', async () => {
    let received: { type: string | null; size: number } | undefined;
    server.use(
      http.put('/api/editions/:id/cover', async ({ request, params }) => {
        received = {
          type: request.headers.get('content-type'),
          size: (await request.arrayBuffer()).byteLength,
        };
        expect(params.id).toBe(String(COPY_TINTIN.edition.id));
        return HttpResponse.json({ coverPath: '1-aaaaaaaaaa.webp' });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ImagesSection copy={COPY_TINTIN} />);

    const [coverInput] = screen.getAllByLabelText('Ajouter');
    await user.upload(coverInput, image());

    await waitFor(() => expect(received).toEqual({ type: 'image/png', size: 1 }));
  });

  it('envoie un fichier sans type MIME en application/octet-stream', async () => {
    let type: string | null = null;
    server.use(
      http.put('/api/editions/:id/cover', ({ request }) => {
        type = request.headers.get('content-type');
        return HttpResponse.json({ coverPath: '1-aaaaaaaaaa.webp' });
      }),
    );
    const user = userEvent.setup({ applyAccept: false });
    renderWithProviders(<ImagesSection copy={COPY_TINTIN} />);

    await user.upload(screen.getAllByLabelText('Ajouter')[0], image('photo', ''));

    await waitFor(() => expect(type).toBe('application/octet-stream'));
  });

  it('envoie la photo à l’exemplaire', async () => {
    let called = false;
    server.use(
      http.put('/api/copies/:id/photo', ({ params }) => {
        called = params.id === String(COPY_TINTIN.id);
        return HttpResponse.json({ photoPath: '1-bbbbbbbbbb.webp' });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ImagesSection copy={COPY_TINTIN} />);

    const [, photoInput] = screen.getAllByLabelText('Ajouter');
    await user.upload(photoInput, image('photo.jpg', 'image/jpeg'));

    await waitFor(() => expect(called).toBe(true));
  });

  it('signale une image refusée par le serveur', async () => {
    server.use(
      http.put('/api/editions/:id/cover', () =>
        HttpResponse.json({ error: 'invalid_image' }, { status: 415 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ImagesSection copy={COPY_TINTIN} />);

    await user.upload(screen.getAllByLabelText('Ajouter')[0], image());

    expect(await screen.findByRole('alert')).toHaveTextContent('pas une image exploitable');
  });

  it('retire la pochette ou la photo', async () => {
    const deleted: string[] = [];
    server.use(
      http.delete('/api/editions/:id/cover', () => {
        deleted.push('cover');
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete('/api/copies/:id/photo', () => {
        deleted.push('photo');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ImagesSection copy={WITH_IMAGES} />);

    const [removeCover, removePhoto] = screen.getAllByRole('button', { name: 'Retirer' });
    await user.click(removeCover);
    await user.click(removePhoto);

    await waitFor(() => expect(deleted).toEqual(['cover', 'photo']));
  });

  it('cherche la pochette en ligne', async () => {
    let fetched = false;
    server.use(
      http.post('/api/editions/:id/cover/fetch', () => {
        fetched = true;
        return HttpResponse.json({ fetched: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ImagesSection copy={COPY_TINTIN} />);

    await user.click(screen.getByRole('button', { name: 'Chercher en ligne' }));

    await waitFor(() => expect(fetched).toBe(true));
  });

  it('invite à envoyer sa propre image quand aucune pochette n’est trouvée en ligne', async () => {
    server.use(
      http.post('/api/editions/:id/cover/fetch', () =>
        HttpResponse.json({ error: 'no_cover_found' }, { status: 404 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ImagesSection copy={COPY_TINTIN} />);

    await user.click(screen.getByRole('button', { name: 'Chercher en ligne' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Aucune pochette trouvée en ligne');
  });
});
