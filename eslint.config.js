import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dist-electron',
      'release',
      'node_modules',
      'data',
      'docs',
      'public',
      'build',
      'e2e',
      'playwright-report',
      'test-results',
      '*.config.js',
      'postcss.config.js',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': refresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          // shadcn variants viven al lado de su componente; useAuth es el hook
          // pareja de AuthProvider y partir el archivo no agrega valor.
          allowExportNames: ['buttonVariants', 'badgeVariants', 'useAuth'],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      // `incompatible-library` flagga useForm().watch() de react-hook-form
      // ~11 veces — el linter lo marca porque React Compiler no lo puede
      // memoizar, pero el lib está funcionando bien y no hay acción posible.
      // Los dejamos como informativos pero sin generar ruido.
      'react-hooks/incompatible-library': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
    },
    settings: { react: { version: '18' } },
  },

  {
    files: ['electron/**/*.ts', 'scripts/**/*.ts', 'electron.vite.config.ts', 'vitest.config.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  prettier,
);
