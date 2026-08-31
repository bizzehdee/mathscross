# The installed icon is not the store icon, and nothing local says so

**Established in MathsCross, after a Play rejection.**

Google Play rejects a submission whose installed launcher icon does not match the
icon on the store listing. MathsCross was rejected for exactly that.

## What was wrong

`native/config.xml` declared no `<icon>` elements. cordova-android supplies its own
default when none is given, so the built AAB shipped the Cordova logo, while the
listing carried `store/icon-512.png` — the generated indigo mark. The two had never
been the same icon.

Nothing in the repository could have surfaced it:

- `scripts/generate-icons.mjs` wrote only `public/icons/`, which is the **web**
  icon set. The native shell reads none of it.
- `scripts/generate-store-assets.mjs` copies the store icon from `public/icons/`
  precisely so the store and web icons cannot drift — which made the store icon
  look verified while the one that actually ships was not in the comparison at all.
- The web build, the native bundle build, the unit suite and the size check all
  pass without any native icon existing.

The general shape: an asset that only the packaged app uses is invisible to every
check that runs before packaging.

## What is true about Android launcher icons

- Android 8+ shows an **adaptive** icon: two layers, foreground and background,
  each 108dp square, of which only the middle 72dp is guaranteed visible. The
  launcher crops the rest to whatever mask the device uses.
- The foreground layer must be transparent outside the mark. Drawing the ground
  colour into it hides the background layer and makes the launcher's parallax move
  a solid block.
- Older Android uses the flat `src` icon instead, so both are generated.
- Paths in `<icon>` are relative to `config.xml`, not to the repository root.

## What was done

`npm run icons` now also writes `native/res/icon/android/`, from the same drawing
function as the web and store icons, and `config.xml` names those files per density.
Two checks stand behind it:

- CI regenerates every icon and fails on a diff, so a committed icon cannot drift
  from the generator.
- `release.yml` compares the bytes Cordova copied into
  `platforms/android/app/src/main/res/mipmap-xxxhdpi/` against the source files. A
  bad path in `config.xml` is only a warning to Cordova, so the copy has to be
  verified rather than assumed.

## Read this before

Adding any asset the packaged app consumes but the web build does not — icons,
splash images, notification badges. Ask what would catch it being absent, and if
the answer is a store reviewer, add the check first.
