import { defineConfig } from 'vitest/config'

// The default run excludes *.slow.test.ts. Those cover 100 seeds per difficulty
// and are expected to take minutes, because a difficulty with a narrow
// acceptance band can need many generation attempts. Plan section 10.4: a slow
// default suite stops being run.
export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.slow.test.ts', '**/node_modules/**'],
    // Generation is measured at M2, and the sibling's comparable grade cost a
    // median of 279ms per puzzle. Vitest's 5s default is below what a small
    // fixed seed set legitimately needs, which would make timing-dependent
    // failures look like logic failures.
    testTimeout: 30_000,
  },
  // Vite injects these when building; Vitest does not load vite.config.ts, so a
  // test importing a module that reads one would fail on an undefined
  // identifier rather than on anything to do with the test. The web values, so
  // that an unmocked test exercises the web behaviour by default.
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __NATIVE_SHELL__: 'false',
  },
})
