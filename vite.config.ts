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
 * `package.json` is the single source. A release is triggered by pushing a
 * `vX.Y.Z` tag, and `scripts/stamp-version.mjs` writes that version into
 * `package.json` and `native/config.xml` before either build runs — so the web
 * bundle, the Android store version and the package metadata cannot disagree.
 *
 * An earlier version read `GITHUB_REF_NAME` here as well, which meant the tag was
 * parsed in two places with two slightly different notions of what a valid tag was.
 * One parser, in the stamping script, which fails loudly on a malformed tag.
 *
 * Anything not stamped is a development build, and says so rather than reporting a
 * bare commit hash that looks like it might be a release.
 */
function resolveVersion(): string {
  const packageVersion = (
    JSON.parse(readFileSync('package.json', 'utf8')) as { version?: string }
  ).version

  if (typeof packageVersion === 'string' && packageVersion !== '0.0.0') {
    return packageVersion
  }

  try {
    const describe = execSync('git describe --tags --always --dirty', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return `0.0.0-dev+${describe}`
  } catch {
    // No git, no tags, or a shallow checkout. Not an error.
    return '0.0.0-dev'
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
      relaxCspForDevServer(),
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
          // Relative, so they resolve against the manifest's own location. An
          // absolute '/icons/...' would point outside the subdirectory on Pages.
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/icon-192-maskable.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
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

/**
 * Lets the dev server's HMR websocket through the Content-Security-Policy.
 *
 * `index.html` sets `connect-src 'none'`, which is exactly right for the shipped
 * app — it makes the offline guarantee enforceable rather than merely intended — and
 * exactly wrong for `vite dev`, whose hot-update channel is a websocket to
 * localhost. Blocked, HMR silently never applies: the file changes on disk, the
 * browser keeps the old module, and the change looks like it did not work. That
 * cost a real misdiagnosis at M5 before the console explained it.
 *
 * So the directive is relaxed for the dev server only. `apply: 'serve'` means this
 * plugin does not run during a build, and the two build targets carry the strict
 * policy untouched.
 */
function relaxCspForDevServer() {
  return {
    name: 'mathscross:relax-csp-for-dev-server',
    apply: 'serve' as const,
    transformIndexHtml(html: string): string {
      return html.replace(
        "connect-src 'none'",
        "connect-src 'self' ws: wss:",
      )
    },
  }
}

export default createConfig('web')
