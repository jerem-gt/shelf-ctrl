import { vi } from 'vitest';

interface CameraMockOptions {
  /** Codes renvoyés à chaque lecture ; la dernière entrée se répète ensuite. */
  reads?: string[][];
  getUserMedia?: () => Promise<MediaStream>;
}

/** jsdom n'a ni caméra ni BarcodeDetector : on installe des doublures. */
export function mockCamera(options: CameraMockOptions = {}) {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  const getUserMedia = vi.fn(options.getUserMedia ?? (() => Promise.resolve(stream)));
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);

  const reads = options.reads ?? [['9782203001190']];
  let polls = 0;
  class FakeBarcodeDetector {
    detect() {
      const values = reads[Math.min(polls, reads.length - 1)];
      polls += 1;
      return Promise.resolve(values.map((rawValue) => ({ rawValue, format: 'ean_13' })));
    }
  }
  vi.stubGlobal('BarcodeDetector', FakeBarcodeDetector);

  return { stop, getUserMedia };
}

export function restoreCamera() {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'mediaDevices');
}
