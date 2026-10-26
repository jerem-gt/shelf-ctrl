import { defineConfig } from 'tsup';

import externals from './runtime-externals.json' with { type: 'json' };

// Modules natifs ou servant des fichiers statiques : non bundlables, livrés par prepare-runtime-deps (@jerem-gt/ctrl-shared)
const bundled = new RegExp(`^(?!(${externals.join('|')})(/|$))`);

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  clean: true,
  minify: true,
  splitting: false,
  external: externals,
  // noExternal est évalué avant external : on bundle tout sauf les externes
  noExternal: [bundled],
  // Les deps CJS bundlées font des require() de builtins
  banner: {
    js: "import { createRequire as __cjsCreateRequire } from 'node:module'; const require = __cjsCreateRequire(import.meta.url);",
  },
});
