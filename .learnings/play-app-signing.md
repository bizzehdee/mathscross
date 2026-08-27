# Play App Signing: what Google holds, and what you still have to sign

Established in the Sudoku project, 2026-08-26, by documentation research, and
verified against Google's own pages cited below. Copied here because MathsCross
publishes through the same mechanism.

## The fact

With Play App Signing there are **two** keys, doing different jobs:

- The **app signing key** signs what users install. For a new app Google generates
  it and keeps it. It cannot be downloaded.
- The **upload key** is yours. You sign the AAB with it, and Play uses it only to
  verify the upload came from you before re-signing with the app signing key.

So "Releases are signed by Google Play" in the console does **not** mean uploads
are signed for you. An AAB still has to be signed with an upload key before Play
will accept it, which is why the release job needs a keystore and the four
`ANDROID_*` secrets.

## What the console lets you download

Certificates and fingerprints, not private keys: the app signing and upload
certificates and their SHA-1 and SHA-256 fingerprints. A certificate is the public
half and cannot sign anything.

The console will also build and hand back a **signed universal APK** from an
uploaded bundle. That one is signed with the real app signing key, so it is the
only installable artefact matching what users get.

## Consequence for this repository

The APK `release.yml` produces is signed with the **upload** key. It is fine for
sideloading a build to check it runs, but it is not what users receive, and its
signature will not match the installed app from Play. To test what users actually
get, upload the AAB and download the universal APK from App Bundle Explorer.

## Losing a key

Losing the upload key is recoverable: export a new certificate and request an
upload key reset. Losing an app signing key would be terminal, which is why the
two keys must be different and why the app signing key must never be reused as
the upload key.

Do not write, anywhere, that losing the keystore means never being able to update
the app. That is wrong for any app using Play App Signing, and it is the kind of
wrong that makes people afraid to rotate a compromised key.

## One upload key per app, not one shared across apps

Decided for MathsCross, 2026-08-27, with the Sudoku sibling publishing through the
same mechanism.

Signing several apps with one key is perfectly legal on Play — an app is identified
by its package name, not by its key — so this is a blast-radius decision rather than
a technical one. What settles it is that **GitHub Actions secrets are
per-repository**. A shared keystore still has to be pasted into every repository
that publishes, so sharing saves no setup work at all, while making a compromise of
any one repository a compromise of every app signed with that key.

Per-app keys therefore cost nothing extra and isolate the damage. Rotation becomes
per-app too: a suspected leak means one upload key reset rather than one per app,
each of which is its own support round-trip with Google.

The usual argument for sharing is fear of losing a key, and that fear is mostly
obsolete here — see "Losing a key" above. Under Play App Signing the thing being
managed is an upload key, which is resettable. The backup discipline two keystores
demand is real but much cheaper than it was before 2021.

Rejected middle option: one keystore file with an alias per app. Fiddlier in CI for
almost no isolation, because the file and its store password travel together into
every repository anyway.

## Evidence

- <https://support.google.com/googleplay/android-developer/answer/9842756>
- <https://developer.android.com/studio/publish/app-signing>
- <https://developer.android.com/guide/app-bundle/faq>
