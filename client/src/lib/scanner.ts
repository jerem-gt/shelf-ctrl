/** Le scan demande `BarcodeDetector` et une caméra (`mediaDevices` n'existe qu'en HTTPS). */
export function isScanSupported(): boolean {
  return (
    'BarcodeDetector' in globalThis && typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

// EAN-13 couvre les ISBN et la plupart des films ; upc_a les produits importés.
const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a'];
const POLL_INTERVAL_MS = 200;
const BARCODE_PATTERN = /^\d{8,13}$/;

function pickBarcode(barcodes: DetectedBarcode[]): string | undefined {
  return barcodes.map((barcode) => barcode.rawValue).find((value) => BARCODE_PATTERN.test(value));
}

/**
 * Lit la vidéo toutes les 200 ms et appelle `onStable` quand le même code est lu deux fois
 * de suite (écarte les mauvaises lectures isolées). Renvoie la fonction qui arrête la lecture.
 */
export function watchBarcodes(
  video: HTMLVideoElement,
  onStable: (code: string) => void,
): () => void {
  const detector = new BarcodeDetector({ formats: SCAN_FORMATS });
  let lastSeen: string | undefined;
  let busy = false;
  let active = true;

  const poll = async () => {
    if (busy || !active) {
      return;
    }
    busy = true;
    try {
      const code = pickBarcode(await detector.detect(video));
      if (code !== undefined && code === lastSeen) {
        active = false;
        onStable(code);
      }
      lastSeen = code;
    } catch {
      // Image pas encore prête : on réessaie au prochain tour.
    } finally {
      busy = false;
    }
  };

  const timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
  return () => {
    active = false;
    clearInterval(timer);
  };
}
