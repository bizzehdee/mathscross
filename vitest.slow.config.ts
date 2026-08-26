import { defineConfig } from 'vitest/config'

// The slow suite. Run with `npm run test:slow`, nightly and on tags in
// slow.yml, never on a pull request. Includes the 100-seed generation coverage
// the default suite skips. Plan section 10.4.
export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    include: ['src/**/*.slow.test.ts'],
    exclude: ['**/node_modules/**'],
    testTimeout: 300_000,
  },
})
