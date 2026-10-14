import js from '@eslint/js';
import reactPlugin from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  // base JS
  js.configs.recommended,

  // TypeScript (avec type-checking)
  ...tseslint.configs.recommendedTypeChecked,

  // Activer le type-checking pour les fichiers TS
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.config.ts', '*/*.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Désactiver les règles typées pour les fichiers JS (postcss, scripts…)
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },

  // GLOBAL RULES
  {
    files: ['**/*.{ts,js,tsx,jsx}'],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },

  // SonarJS
  {
    files: ['**/*.{ts,js,tsx,jsx}'],
    ...sonarjs.configs.recommended,
  },

  // Unicorn — règles alignées sur SonarCloud
  {
    files: ['**/*.{ts,js,tsx,jsx}'],
    plugins: { unicorn },
    rules: {
      'unicorn/prefer-number-properties': 'error', // Number.NaN, Number.isNaN, Number.parseInt…
      'unicorn/prefer-string-replace-all': 'error', // replaceAll() plutôt que replace(/x/g, …)
      'unicorn/no-for-loop': 'error', // for…of plutôt que for(let i…)
      'unicorn/prefer-array-flat': 'error', // flat() plutôt que flatMap(x => x)
      'unicorn/prefer-export-from': 'error', // export…from plutôt que import + re-export
      'unicorn/prefer-global-this': 'error', // globalThis plutôt que window (es2020portability)
    },
  },

  // SERVER
  {
    files: ['server/**/*.{ts,js}'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // CLIENT (React)
  {
    files: ['client/**/*.{tsx,jsx,ts}'],
    ...reactPlugin.configs['recommended-typescript'],
    languageOptions: {
      parser: tseslint.parser,
    },
  },
  {
    files: ['client/**/*.{tsx,jsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-console': 'warn',
      '@eslint-react/no-array-index-key': 'error',
    },
  },

  // Tests client — utilise tsconfig.test.json (vitest globals)
  {
    files: ['client/src/**/*.test.{ts,tsx}', 'client/src/tests/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ['./client/tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Fichiers de test — assouplissements ciblés
  {
    files: ['**/*.test.{ts,tsx,js}', '**/*.spec.{ts,tsx,js}'],
    rules: {
      'sonarjs/slow-regex': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', '**/coverage/**'],
  },
];
