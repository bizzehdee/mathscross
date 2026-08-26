# iOS deletes all script-writable storage after 7 days

Established in the Sudoku project, 2026-08-25, by web research. Copied here
because MathsCross has the same offline-storage dependency, and because the
finding is the reason a common "fix" for it does not work.

## The fact

iOS Safari deletes **all** script-writable storage for a site after seven days of
Safari use without user interaction on that site. The deletion covers
`localStorage`, **IndexedDB**, SessionStorage, media keys, and the service worker
registration itself.

A web application **added to the home screen is exempt**. It keeps its own counter
of days of use, which advances only when the application is actually used, so an
installed app opened occasionally is never evicted. An application used in a
Safari tab is **not** exempt.

## The consequence that is easy to get wrong

Because the bucket includes IndexedDB, **moving from `localStorage` to IndexedDB
does not avoid this**, with or without a wrapper such as `localForage`. A claim
that iOS clears `localStorage` under memory pressure and that IndexedDB is the
remedy is a different and incorrect account of the same symptom.

What does survive eviction is a native file outside the WebView storage bucket: on
Cordova, a SQLite plugin or `cordova-plugin-file`. That is the real remedy, and it
does not exist on the web target.

## Why it matters here

MathsCross stores stats, settings, completed daily date keys and two in-progress
boards in `localStorage`. Release 1 ships no iOS native build, so the exposure is
limited to web players on iOS who have not installed to the home screen.

Do not attempt to work around the eviction in script. It is a platform policy, not
a bug.

## Evidence

- <https://therawragency.com/2020/04/what-safaris-7-day-cap-on-script-writeable-storage-means-for-pwa-developers/>
- <https://support.didomi.io/apple-adds-a-7-day-cap-on-all-script-writable-storage>

WebKit introduced the cap in iOS 13.4 and Safari 13.1. Re-check before relying on
the home-screen exemption, because it is a policy Apple can change.
