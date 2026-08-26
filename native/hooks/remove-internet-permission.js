// Strips the INTERNET permission from the generated Android manifest.
//
// cordova-android adds `android.permission.INTERNET` unconditionally. MathsCross
// makes no network requests — every puzzle is generated on the device — so the
// permission is not merely unused: its absence is what turns "works offline" from
// a claim in the store listing into something a player can check for themselves.
// Plan section 9.4.
//
// Done as a hook rather than through `<edit-config>` because Cordova's config
// mechanisms merge and overwrite, and neither removes an element another part of
// the build has already added.
//
// Fails loudly. A silent no-op here would ship the permission, and nobody would
// notice until someone read the listing.
const { existsSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const PERMISSION = 'android.permission.INTERNET'

module.exports = function removeInternetPermission(context) {
  const root = context.opts.projectRoot
  const manifest = join(root, 'platforms', 'android', 'app', 'src', 'main', 'AndroidManifest.xml')

  if (!existsSync(manifest)) {
    // The Android platform is not added, which is normal for an iOS-only prepare.
    return
  }

  const before = readFileSync(manifest, 'utf8')
  // Matches the whole element, self-closing or not, with any attribute order.
  const pattern = new RegExp(
    `\\s*<uses-permission[^>]*android:name="${PERMISSION.replace(/\./g, '\\.')}"[^>]*/?>`,
    'g',
  )
  const after = before.replace(pattern, '')

  if (after === before) {
    if (before.includes(PERMISSION)) {
      throw new Error(
        `remove-internet-permission: found ${PERMISSION} in the manifest but could not remove it. ` +
          'The element shape has changed; fix the pattern rather than skipping this.',
      )
    }
    // Already absent. Nothing to do, and nothing wrong.
    return
  }

  writeFileSync(manifest, after)

  if (readFileSync(manifest, 'utf8').includes(PERMISSION)) {
    throw new Error(`remove-internet-permission: ${PERMISSION} survived the rewrite.`)
  }

  console.log(`remove-internet-permission: removed ${PERMISSION}`)
}
