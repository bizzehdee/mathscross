// Patches one version, from a tag, into every place that has to agree.
//
// Run with `node scripts/stamp-version.mjs v1.2.3`. A release is triggered by
// pushing a `vX.Y.Z` tag, and that tag is the single source of the version. Three
// artefacts then have to carry it, and a release where they disagree is a release
// nobody can reason about afterwards:
//
//   1. `package.json`      — what the build reports and what tooling reads.
//   2. `native/config.xml` — the Play store version, which comes from here and not
//                            from the bundle. Without stamping it, every release
//                            would publish as 0.0.0 whatever was tagged.
//   3. the bundle          — via `__APP_VERSION__`, which `vite.config.ts` derives
//                            from `package.json` once this has run.
//
// It also computes the Android `versionCode`, and prints both for a workflow to
// pick up.
//
// Strict about the tag on purpose. See `assertVersion`.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const TAG = process.argv[2]

/**
 * Requires exactly `vX.Y.Z`.
 *
 * Not a permissive parse. `v1.2` would give an ambiguous patch level, and a
 * pre-release such as `v1.2.3-rc1` cannot be represented in a Play store version,
 * which must be numeric — an earlier draft silently truncated it to `1.2.3`, which
 * means a release candidate and its release would publish as the same version and
 * the second upload would be rejected as not an increase.
 *
 * Failing loudly on a malformed tag costs one re-tag. Guessing costs a wasted
 * version number that can never be reused.
 */
function assertVersion(tag) {
  if (typeof tag !== 'string' || !/^v\d+\.\d+\.\d+$/.test(tag)) {
    console.error(`Expected a tag of exactly vX.Y.Z, got ${JSON.stringify(tag)}.`)
    console.error('A release version must be three numeric parts: v1.0.0, v1.2.3.')
    console.error('Pre-release suffixes are not supported, because a Play store')
    console.error('version cannot carry one and truncating it would collide with the')
    console.error('release it precedes.')
    process.exit(1)
  }
  return tag.slice(1)
}

const version = assertVersion(TAG)
const [major, minor, patch] = version.split('.').map(Number)

/**
 * `versionCode` is what Play orders releases by, and it must increase on every
 * upload.
 *
 * Not cordova-android's default of `major*10000 + minor*100 + patch`, which
 * collides: `1.0.100` and `1.1.0` both produce `10100`, so the second upload is
 * rejected. This scheme allows 999 minor and 999 patch releases before the same
 * problem, which is far enough away.
 */
if (minor > 999 || patch > 999) {
  console.error(`Version ${version} has a minor or patch above 999, which this`)
  console.error('versionCode scheme cannot encode. Widen the scheme before releasing.')
  process.exit(1)
}
const versionCode = major * 1_000_000 + minor * 1_000 + patch

// package.json
const packagePath = 'package.json'
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
packageJson.version = version
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)
console.log(`${packagePath}: version ${version}`)

// native/config.xml, if the shell is present
const configPath = 'native/config.xml'
if (existsSync(configPath)) {
  const before = readFileSync(configPath, 'utf8')
  const after = before.replace(
    /(<widget id="[^"]*" version=)"[^"]*"/,
    `$1"${version}"`,
  )
  if (after === before) {
    console.error(`${configPath}: could not find the widget version attribute to stamp.`)
    process.exit(1)
  }
  writeFileSync(configPath, after)
  console.log(`${configPath}: version ${version}`)
} else {
  console.log(`${configPath}: absent, skipped`)
}

// Outputs for the workflow.
const output = process.env['GITHUB_OUTPUT']
if (output !== undefined && output !== '') {
  writeFileSync(output, `version=${version}\nversionCode=${versionCode}\n`, { flag: 'a' })
}
console.log(`versionCode: ${versionCode}`)
