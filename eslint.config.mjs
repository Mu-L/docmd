import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-undef': 'off',
      'prefer-const': 'off',
      'no-useless-escape': 'off',
      'no-useless-assignment': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'preserve-caught-error': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-empty': 'off',
      'no-dupe-else-if': 'off'
    }
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/site/**', 'temp-*/**', '**/public/**']
  }
];