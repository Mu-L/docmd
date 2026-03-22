import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Buffer: 'readonly',
        exports: 'writable',
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        IntersectionObserver: 'readonly',
        fetch: 'readonly',
        DOMParser: 'readonly',
        history: 'readonly',
        CustomEvent: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        URL: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'preserve-caught-error': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-useless-escape': 'off',
      'no-useless-assignment': 'off',
      '@typescript-eslint/no-unused-expressions': 'off'
    }
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/site/**', 'temp-*/**', '**/public/**']
  }
];