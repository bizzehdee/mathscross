import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * The path the application is served from.
 *
 * GitHub Pages for a project repository serves at
 * https://<user>.github.io/<repo>/, which is a subdirectory rather than a root.
 * Every asset path, the manifest scope and the service worker scope must agree
 * with it. Plan section 10.2.
 *
 * Defaults to '/' so the dev server and preview keep working unchanged. The
 * Pages workflow sets APP_BASE. A custom domain serving from a root needs
 * APP_BASE='/'.
 */
const BASE = normaliseBase(process.env['APP_BASE'])

/**
 * Forces a leading and a trailing slash.
 *
 * Callers supply the path in several shapes: actions/configure-pages emits
 * '/mathscross' with no trailing slash, a person might write 'mathscross' or
 * '/mathscross/', and a custom domain needs '/'. Vite's base, the manifest
 * scope and the navigation fallback all require the trailing slash, and
 * concatenating without it produces paths like '/mathscrossindex.html'.
 */
function normaliseBase(value: string | undefined): string {
  const trimmed = (value ?? '').trim()
  if (trimmed === '' || trimmed === '/') {
    return '/'
  }
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`
}

/**
 * The version stamped into the bundle.
 *
 * Source order: the release tag from CI, then git describe, then the
 * package.json version. Each fallback exists because the one before it is
 * absent in some legitimate case: no CI, no tags yet, or no git at all.
 * Plan section 4.
 */
function resolveVersion(): string {
  const packageVersion = (
    JSON.parse(readFileSync('package.json', 'utf8')) as { version?: string }
  ).version

  // GitHub Actions sets this to the tag name for a tag-triggered run.
  const tag = process.env['GITHUB_REF_NAME']
  if (typeof tag === 'string' && /^v\d/.test(tag)) {
    return tag.replace(/^v/, '')
  }

  try {
    return execSync('git describe --tags --always --dirty', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    // No git, no tags, or a shallow checkout. Not an error.
    return packageVersion ?? '0.0.0'
  }
}

const APP_VERSION = resolveVersion()

/**
 * Where the bundle is going to run.
 *
 * 'web' is the GitHub Pages deployment. 'native' is the bundle a Cordova shell
 * loads from the device.
 */
export type BuildTarget = 'web' | 'native'

/**
 * Builds the configuration for one target.
 *
 * A function rather than two config files with two copies of the settings,
 * because everything except three differences has to stay identical: the two
 * bundles are the same application, and a setting that drifted between them
 * would be a defect only reproducible on one platform. Plan section 4.
 */
export function createConfig(target: BuildTarget) {
  const native = target === 'native'

  // Relative, so the bundle resolves correctly whatever origin the shell serves
  // it from. The shell is configured for https://localhost rather than file://
  // (plan section 9.2), under which absolute paths would work — but relative
  // paths fail loudly and immediately if that configuration is ever lost,
  // whereas the storage consequence of losing it is silent.
  const base = native ? './' : BASE

  return defineConfig({
    base,
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
      __NATIVE_SHELL__: JSON.stringify(native),
    },
    root: 'src',
    publicDir: '../public',
    build: {
      // Cordova serves whatever is in its www directory, so the build writes
      // straight into it. Kept out of dist/, so a native build never overwrites
      // what the Pages workflow is about to deploy.
      outDir: native ? '../native/www' : '../dist',
      emptyOutDir: true,
    },
    plugins: [
      VitePWA({
        // Emits no service worker and no manifest for a native build. A shell
        // already holds every asset on the device, so there is nothing to cache
        // and no update to find: the store ships new versions instead.
        disable: native,
        // 'prompt', not 'autoUpdate'. Plan section 4 requires that a service
        // worker swap must never discard an in-progress puzzle, and autoUpdate
        // activates and reloads without asking. Registration itself arrives at
        // M5 with the update flow.
        registerType: 'prompt',
        injectRegister: null,
        manifest: {
          name: 'MathsCross',
          short_name: 'MathsCross',
          description: 'Offline maths crossword with three difficulties and a daily puzzle',
          display: 'standalone',
          // Both must match the served path, or an installed app opens outside
          // its own scope and loses the service worker.
          start_url: BASE,
          scope: BASE,
          // One value, because a manifest theme colour cannot follow the active
          // theme. Plan section 8.1.
          theme_color: '#3a5fa8',
          background_color: '#f7f7f5',
          // Icons are authored at M5, per plan section 9.5. The array is absent
          // rather than pointing at files that do not exist yet, so the manifest
          // is valid at every commit.
        },
        workbox: {
          // Precache everything. The application is static and makes no network
          // requests, so there are no runtime caching rules.
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          // Without this an offline navigation has nothing to serve. It must
          // carry the base, or the fallback points above the subdirectory.
          navigateFallback: `${BASE}index.html`,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  })
}

export default createConfig('web')
