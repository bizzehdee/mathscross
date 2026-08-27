# The Cordova shell

This directory packages the web build as an Android app. It contains no game
code: `npm run build:native` in the repository root builds `../src` into `./www`,
and `www/`, `platforms/` and `plugins/` are all generated and git-ignored.

**Nothing here should be edited to change game behaviour.** If a change belongs to
the game, it belongs in `../src`.

## No plugins

`package.json` lists none, and that is deliberate. cordova-android 15 handles the
splash screen through the preferences in `config.xml`, so the usual splash and
status-bar plugins buy nothing. Every plugin is native code and a supply-chain
surface.

It also matters for a decision recorded in `plan.md` section 9.1: needing a third
plugin is one of the four triggers to reconsider Cordova against Capacitor. At zero
plugins that threshold is a long way off.

## Building locally

Requires the Android SDK and JDK 21.

```bash
npm run build:native          # from the repository root, writes native/www
cd native
npm ci
npm run prepare:android
npm run build:aab             # or build:android for a sideloadable APK
```

An unsigned build is fine for checking that the app runs. It cannot be uploaded to
Play.

## The INTERNET permission is removed

`hooks/remove-internet-permission.js` strips `android.permission.INTERNET` from the
generated manifest after every prepare. The game makes no network requests, and the
absence of the permission is what turns "works offline" from a claim into something
a player can verify from the store listing.

The hook throws rather than warning if it cannot do its job. A silent no-op would
ship the permission and nobody would notice.

Check it after a build:

```bash
grep -c INTERNET platforms/android/app/src/main/AndroidManifest.xml   # expect 0
```

## Signing

Release builds are signed with an **upload key**, which is yours. Google holds a
separate app signing key and re-signs what users install. So "Releases are signed by
Google Play" in the console does **not** mean uploads are signed for you: an AAB
still has to be signed before Play will accept it.

The consequence worth knowing: the APK this repository builds is signed with the
upload key and is **not** the artefact users receive. To test what users actually
get, upload the AAB and download the universal APK from the console's App Bundle
Explorer. See `../.learnings/play-app-signing.md`.

Create an upload keystore once:

```bash
keytool -genkeypair -v -keystore release.p12 -storetype PKCS12 \
  -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Then base64-encode it and set four repository secrets. **Never commit the keystore
or its base64 form** — `.gitignore` covers both as a backstop, not as permission to
keep them here.

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the keystore, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | store password |
| `ANDROID_KEY_ALIAS` | `upload`, or whatever alias was used |
| `ANDROID_KEY_PASSWORD` | key password |

Losing the **upload** key is recoverable: export a new certificate and request an
upload key reset. Losing an **app signing** key would be terminal, which is why the
two must be different and why the app signing key must never be reused as the upload
key.

**Use an upload key belonging to this app alone.** Do not reuse the key from another
app, including the Sudoku sibling. These secrets are per-repository, so a shared key
would have to be pasted here as well and would save no work — it would only mean
that compromising either repository compromises both apps, and that rotating the key
forces an upload key reset for each of them. Reasoning in
`.learnings/play-app-signing.md`.

## Publishing

The first upload to Play must be done by hand — Google requires it, and a personal
developer account may need a 14-day closed test before production access is granted.
Set the `PLAY_TRACK` repository variable to `internal` until then.

Once that has happened, setting `PLAY_SERVICE_ACCOUNT_JSON` turns on automated
publishing from `release.yml`. Until it is set, the publish step is dormant and the
binaries are simply attached to the GitHub Release.

## What has not been verified

The shell has never been built. There is no Android SDK on the development machine,
so `config.xml`, the hook and the release workflow are written from the plan and from
the sibling project's working setup, and are **unverified**. Before the first
release, check on a device:

- the app launches and the board is playable offline;
- `localStorage` survives an app restart **and an upgrade** — the origin
  preferences in `config.xml` are what make that work, and the failure is silent
  (see `../.learnings/native-shell-origin.md`);
- the manifest has no INTERNET permission;
- rotation does not reload the WebView or lose an in-progress board;
- a tap on a board cell registers with no perceptible delay.
