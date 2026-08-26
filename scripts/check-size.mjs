// Fails the build when a gzipped output exceeds its ceiling. Plan section 8.4.
//
// Run with `npm run size` after a web build. A budget with no gate is a comment,
// and the one real threat to these numbers is a dependency added without weighing
// it — which is exactly the kind of change nobody notices in review.
//
// Ceilings are set from measurement, not intuition. Update them here and in plan
// section 8.4 together, and only ever to *lower* them: a rise means something was
// added, which is the thing this is for.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

/**
 * Gzipped ceilings, in bytes.
 *
 * Tightened at M3 from the plan's opening budget of 100 KiB JS and 15 KiB CSS,
 * which were guesses. Measured at M3 with the engine, worker, board, keypad,
 * controls and onboarding all present: 13.0 KiB JS and 1.7 KiB CSS.
 *
 * These leave roughly triple the measured size for what M4 to M7 still add — the
 * difficulty menu, stats, settings, the daily screen and the service worker — and
 * no more. Generous slack is what lets a bad dependency in unnoticed, which is the
 * one real threat to these numbers.
 */
const CEILINGS = {
  js: 40 * 1024,
  css: 8 * 1024,
  // Icons arrive at M5, so this is the only figure still unmeasured.
  assets: 150 * 1024,
}

const DIST = 'dist'

function walk(directory) {
  const found = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) {
      found.push(...walk(path))
    } else {
      found.push(path)
    }
  }
  return found
}

function gzippedSize(path) {
  return gzipSync(readFileSync(path)).byteLength
}

function kib(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

let files
try {
  files = walk(DIST)
} catch {
  console.error(`No ${DIST}/ directory. Run \`npm run build\` first.`)
  process.exit(1)
}

const totals = { js: 0, css: 0, assets: 0 }

for (const path of files) {
  // The service worker and its workbox runtime are excluded: they are generated
  // by the PWA plugin rather than written here, so a ceiling on them would police
  // someone else's code and would move whenever the plugin is updated.
  if (path.endsWith('sw.js') || path.includes('workbox-')) {
    continue
  }
  if (path.endsWith('.js')) {
    totals.js += gzippedSize(path)
  } else if (path.endsWith('.css')) {
    totals.css += gzippedSize(path)
  } else if (/\.(png|svg|ico|woff2?|webmanifest)$/.test(path)) {
    totals.assets += gzippedSize(path)
  }
}

let failed = false
for (const [kind, total] of Object.entries(totals)) {
  const ceiling = CEILINGS[kind]
  const verdict = total <= ceiling ? 'ok' : 'OVER'
  if (total > ceiling) {
    failed = true
  }
  console.log(
    `${kind.padEnd(7)} ${kib(total).padStart(10)} / ${kib(ceiling).padStart(10)}  ${verdict}`,
  )
}

if (failed) {
  console.error('\nBundle size ceiling exceeded. Plan section 8.4.')
  console.error('If the growth is justified, state its gzipped cost and raise the')
  console.error('ceiling here and in the plan together. Do not raise it silently.')
  process.exit(1)
}
