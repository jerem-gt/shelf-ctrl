import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { watchBarcodes } from '@/lib/scanner';

function errorKey(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'scan.denied';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'scan.noCamera';
  }
  return 'scan.error';
}

interface BarcodeScannerProps {
  onDetect: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetect, onClose }: Readonly<BarcodeScannerProps>) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    let stopWatching: (() => void) | undefined;

    const stop = () => {
      stopped = true;
      stopWatching?.();
      stream?.getTracks().forEach((track) => track.stop());
    };

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        const video = videoRef.current;
        if (stopped || !video) {
          stop();
          return;
        }
        video.srcObject = stream;
        await video.play();
        stopWatching = watchBarcodes(video, (code) => {
          stop();
          onDetectRef.current(code);
        });
      } catch (cause) {
        stop();
        setError(t(errorKey(cause)));
      }
    };

    void start();
    return stop;
  }, [t]);

  return (
    // <dialog open> plutôt que role="dialog" ; les styles remplacent ceux, centrés, du navigateur.
    <dialog
      open
      aria-modal="true"
      aria-label={t('scan.title')}
      className="fixed inset-0 z-50 m-0 flex h-full w-full max-w-none flex-col items-center justify-center gap-4 border-0 bg-black/85 p-4"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-md border-2 border-white/80"
        />
      </div>

      {error ? (
        <p role="alert" className="max-w-md text-center text-sm text-red-300">
          {error}
        </p>
      ) : (
        <p className="max-w-md text-center text-sm text-white">{t('scan.hint')}</p>
      )}

      <button
        type="button"
        onClick={onClose}
        className="flex items-center gap-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-900"
      >
        <X aria-hidden className="size-4" />
        {t('scan.close')}
      </button>
    </dialog>
  );
}
