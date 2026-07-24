import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  // ---------------------------------------------------------------------------
  // Layering. Dependencies point one way: pages → components → hooks → lib.
  //
  //   src/lib        pure domain logic + the API client. No React, no UI.
  //   src/hooks      React-coupled application layer (React Query hooks, url
  //                  state, analytics, shared search). May use lib.
  //   src/components presentation. May use hooks and lib, never pages.
  //   src/pages      routes; may use anything below.
  //
  // Each block below bans the imports that would point the wrong way.
  // ---------------------------------------------------------------------------
  {
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-dom',
                'react-dom/*',
                'react-router-dom',
                '@mui/*',
                '@emotion/*',
                '@tanstack/*',
                'posthog-js',
              ],
              message:
                'src/lib is the pure domain layer — no React, UI, or data-fetching frameworks. React-coupled code belongs in src/hooks.',
            },
            {
              group: [
                '@/hooks/*',
                '@/components/*',
                '@/pages/*',
                '**/hooks/*',
                '**/components/*',
                '**/pages/*',
              ],
              message:
                'src/lib must not depend on upper layers (hooks/components/pages).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/hooks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/components/*',
                '@/pages/*',
                '**/components/*',
                '**/pages/*',
              ],
              message:
                'src/hooks must not depend on presentation (components/pages).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/pages/*', '**/pages/*'],
              message: 'src/components must not depend on pages.',
            },
          ],
        },
      ],
    },
  },
  {
    // Test files and test utilities aren't part of the HMR component graph, so
    // the Fast Refresh rule about mixing component and non-component exports
    // (e.g. re-exporting Testing Library from test-utils) doesn't apply.
    files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Keep this last so it disables stylistic rules that conflict with Prettier.
  prettier,
)
