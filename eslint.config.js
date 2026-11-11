import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', 'web/dist', '.wrangler', 'test-results', 'playwright-report'] },
  ...tseslint.configs.recommended,
);
