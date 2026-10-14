// API Shape Detection : absente des types DOM de TypeScript.
// Supportée par Chrome (Android et certains ordinateurs), uniquement en contexte sécurisé (HTTPS).
interface DetectedBarcode {
  rawValue: string;
  format: string;
}

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
