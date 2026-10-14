import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockCamera, restoreCamera } from '@/tests/cameraMocks';

import { BarcodeScanner } from './BarcodeScanner';

afterEach(() => {
  restoreCamera();
});

const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

describe('BarcodeScanner', () => {
  it('ouvre la caméra arrière, détecte un code lu deux fois puis libère la caméra', async () => {
    const { stop, getUserMedia } = mockCamera({ reads: [['9782203001190']] });
    const onDetect = vi.fn();
    render(<BarcodeScanner onDetect={onDetect} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Scanner un code-barres' })).toBeInTheDocument();
    await waitFor(() => expect(onDetect).toHaveBeenCalledWith('9782203001190'));

    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    expect(onDetect).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalled();
  });

  it('ignore une lecture isolée qui change d’une fois sur l’autre', async () => {
    mockCamera({ reads: [['1111111111111'], ['2222222222222'], ['1111111111111']] });
    const onDetect = vi.fn();
    render(<BarcodeScanner onDetect={onDetect} onClose={vi.fn()} />);

    await wait(600);

    expect(onDetect).not.toHaveBeenCalled();
  });

  it('ignore ce qui n’est pas un code-barres numérique', async () => {
    mockCamera({ reads: [['https://exemple.test/qr']] });
    const onDetect = vi.fn();
    render(<BarcodeScanner onDetect={onDetect} onClose={vi.fn()} />);

    await wait(600);

    expect(onDetect).not.toHaveBeenCalled();
  });

  it('appelle la dernière version de onDetect', async () => {
    mockCamera();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<BarcodeScanner onDetect={first} onClose={vi.fn()} />);

    rerender(<BarcodeScanner onDetect={second} onClose={vi.fn()} />);

    await waitFor(() => expect(second).toHaveBeenCalledWith('9782203001190'));
    expect(first).not.toHaveBeenCalled();
  });

  it.each([
    [
      'NotAllowedError',
      'Accès à la caméra refusé : autorise-le dans les réglages du navigateur pour ce site.',
    ],
    ['NotFoundError', 'Aucune caméra disponible sur cet appareil.'],
    ['AbortError', 'Impossible de démarrer la caméra.'],
  ])('explique l’erreur %s', async (name, message) => {
    mockCamera({ getUserMedia: () => Promise.reject(new DOMException('refusé', name)) });
    render(<BarcodeScanner onDetect={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('explique une erreur qui n’est pas une DOMException', async () => {
    mockCamera({ getUserMedia: () => Promise.reject(new Error('boom')) });
    render(<BarcodeScanner onDetect={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de démarrer la caméra.');
  });

  it('se ferme avec le bouton et libère la caméra au démontage', async () => {
    const { stop } = mockCamera({ reads: [[]] });
    const onClose = vi.fn();
    const { unmount } = render(<BarcodeScanner onDetect={vi.fn()} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    await waitFor(() => expect(stop).toHaveBeenCalled());
  });

  it('libère la caméra obtenue après le démontage', async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    let resolveStream: ((value: MediaStream) => void) | undefined;
    mockCamera({
      getUserMedia: () =>
        new Promise<MediaStream>((resolve) => {
          resolveStream = resolve;
        }),
    });
    const { unmount } = render(<BarcodeScanner onDetect={vi.fn()} onClose={vi.fn()} />);

    unmount();
    resolveStream?.(stream);

    await waitFor(() => expect(stop).toHaveBeenCalled());
  });
});
