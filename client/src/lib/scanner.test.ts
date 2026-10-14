import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockCamera, restoreCamera } from '@/tests/cameraMocks';

import { isScanSupported, watchBarcodes } from './scanner';

afterEach(() => {
  restoreCamera();
});

describe('isScanSupported', () => {
  it('est faux sans BarcodeDetector', () => {
    expect(isScanSupported()).toBe(false);
  });

  it('est faux sans caméra, par exemple hors HTTPS', () => {
    vi.stubGlobal('BarcodeDetector', class {});
    expect(isScanSupported()).toBe(false);
  });

  it('est vrai avec BarcodeDetector et une caméra', () => {
    mockCamera();
    expect(isScanSupported()).toBe(true);
  });
});

describe('watchBarcodes', () => {
  it('réessaie après une lecture en échec puis signale le code stable', async () => {
    let calls = 0;
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        detect() {
          calls += 1;
          if (calls === 1) {
            return Promise.reject(new Error('image pas prête'));
          }
          return Promise.resolve([{ rawValue: '9782203001190', format: 'ean_13' }]);
        }
      },
    );
    const onStable = vi.fn();

    const stop = watchBarcodes(document.createElement('video'), onStable);
    await vi.waitFor(() => expect(onStable).toHaveBeenCalledWith('9782203001190'));
    stop();

    expect(onStable).toHaveBeenCalledTimes(1);
    expect(calls).toBe(3);
  });

  it('cesse de lire une fois arrêté', async () => {
    let calls = 0;
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        detect() {
          calls += 1;
          return Promise.resolve([]);
        }
      },
    );

    const stop = watchBarcodes(document.createElement('video'), vi.fn());
    await vi.waitFor(() => expect(calls).toBeGreaterThan(0));
    stop();
    const callsAtStop = calls;
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(calls).toBe(callsAtStop);
  });
});
