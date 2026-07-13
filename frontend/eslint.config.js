import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // `react-refresh/only-export-components` guards HMR fast-refresh boundaries.
    // These modules are intentionally not fast-refresh boundaries:
    //  - components/ui/** re-export Radix primitives (`const Dialog = D.Root`)
    //  - app/router.tsx exports route config + lazy() page references
    // The rule stays ON for feature/page files, where fast refresh matters.
    files: ['src/components/ui/**/*.tsx', 'src/app/router.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
