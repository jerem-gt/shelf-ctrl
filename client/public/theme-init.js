// Anti-flash : applique le thème avant le premier affichage. Fichier séparé (et non script
// inline) : la CSP par défaut de helmet (`script-src 'self'`) bloque les scripts inline.
// En dev la CSS arrive par JS : le fond est aussi posé sur <html>, aux valeurs de --c-canvas
// (index.css) ; useTheme le retire au chargement.
(function () {
  const root = globalThis.document.documentElement;
  try {
    const stored = globalThis.localStorage.getItem('shelfctrl.theme');
    const dark =
      stored === 'dark' ||
      (stored !== 'light' && globalThis.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', dark);
    root.style.backgroundColor = dark ? '#0f172a' : '#f8fafc';
  } catch {
    root.classList.remove('dark');
  }
})();
