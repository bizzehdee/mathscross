# Google Play listing

The text and declarations for the Play Console listing. Everything here is uploaded
by hand; nothing in this directory is used by the app at runtime.

**Keep this file honest.** Every claim below is one the app actually meets. A listing
that overstates a puzzle game is both a policy risk and the fastest route to
one-star reviews.

## App name

30 characters maximum.

```
MathsCross
```

## Short description

80 characters maximum. Currently 77, counted rather than estimated — an earlier
draft of this line was 82 and would have been rejected at the paste.

```
Offline maths crosswords solvable by logic. No adverts, accounts or tracking.
```

The things that actually distinguish it, in the order they matter. "Solvable by
logic" is the claim a parent choosing a maths game cares about most, and it is
enforced rather than asserted. "Offline" follows because every puzzle is generated
on the device and the app makes no network requests at all.

The line said "no internet" until the first submission. The app does hold the
INTERNET permission — the WebView will not load the bundle from its own https
origin without it, per section 9.4 — so a claim resting on the permission list
would have been false. What is true is that nothing is ever sent, and that is what
the text now says.

## Full description

4000 characters maximum. The text below is about 1,500.

```
A crossword made of sums. Fill the grid so that every row and column reads as a
correct equation, across and down at the same time.

Every puzzle is generated on your device, so there is nothing to download and
nothing to wait for. The app makes no network requests at all — not for the first
puzzle, and not for the ten thousandth.

SOLVABLE BY LOGIC, NOT BY GUESSING

Easy and Medium are guaranteed to be solvable by reasoning alone. Every puzzle is
checked during generation: there is a chain of steps from the numbers you are given
to the answer, and at no point do you have to try a value to see whether it works.
Nothing is left to trial and error.

That makes them suited to children of around nine and up, and to anyone who finds a
puzzle that requires guesswork unsatisfying. Hard lifts the restriction — it still
has exactly one answer, but finding it may take experiment.

WHAT YOU GET

• Three difficulties, each adding one thing rather than several at once.
  Easy is a 5x5 with single digits, plus and minus.
  Medium is a 7x7 with two-digit numbers and multiplication, every operator shown.
  Hard is an 11x11 with three-digit numbers, and it hides some of the operators.
• A daily puzzle. One shared puzzle a day, the same for everyone, with a streak to
  keep. It changes at midnight UTC.
• Unlimited puzzles. Each one is made fresh and has exactly one solution — always
  checked, never guessed.
• Undo and redo, so a wrong turn costs nothing.
• Your progress is saved. Close the app mid-puzzle and pick it up later, undo
  history included.
• Statistics: puzzles completed, best and typical times, and your daily streak.
• Nine themes, including a high-contrast one and five for players who would rather
  do their sums on a football pitch, in space, or underwater.

NORMAL ARITHMETIC

Sums work the way you were taught. Division and multiplication before addition and
subtraction, left to right within each. A game about arithmetic does not get to
invent arithmetic.

There are no trick questions either: no puzzle will ever ask you for something like
9 + 0, where the answer can be copied rather than worked out.

The one thing worth knowing: digits next to each other make one number. Two cells
holding 1 and 5 read as fifteen, not as one and five. Grouped cells are drawn joined
together so you can always see which digits belong together.

NO NONSENSE

• No adverts.
• No in-app purchases.
• No accounts and no sign-in.
• No analytics, no tracking, no data collection of any kind.
• No network requests of any kind, so nothing you do here leaves your phone.

Works on a plane, on the underground, and on a phone that has never been online.
```

## Graphics

| Asset | Size | Source |
|---|---|---|
| Store icon | 512 x 512 | `icon-512.png`, copied from `public/icons/` |
| Feature graphic | exactly 1024 x 500 | `feature-graphic-1024x500.png`, generated |
| Phone screenshots | 1080 x 1920, at least 2 and Play asks for 4 | **not yet captured** — see `README.md` |
| 7-inch tablet | 1920 x 1080 | **not yet captured**, and optional |
| 10-inch tablet | 2560 x 1440 | **not yet captured**, and optional |

Re-check these against Play Console before submitting. Play changes its
requirements, and the figures here were taken from a sibling project's verified
values rather than from current policy.

## Data safety

The easiest declaration this app will ever make, and worth stating plainly on the
listing because it is a genuine differentiator.

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Not applicable — no data leaves the device |
| Do you provide a way for users to request that their data be deleted? | Not applicable — nothing is collected |

This is not a promise to keep, it is a description of code that has nowhere to send
anything: no request is made anywhere in the app, `config.xml` grants no `<access>`
or `<allow-navigation>`, and the CSP in `src/index.html` sets `connect-src 'none'`,
which the browser enforces. `release.yml` fails the build if any permission beyond
`INTERNET` — which the webview needs to load the bundle from its own origin, per
section 9.4 — appears in the manifest.

Puzzle progress, statistics and settings are stored **on the device only**, in the
browser storage of the app's own webview. Clearing the app's data removes them, and
they are never sent anywhere.

## Content rating

Answer the questionnaire as a general-audience puzzle game:

- No violence, sexuality, profanity, or controlled substances.
- No user-generated content.
- No user interaction or sharing features.
- No adverts.
- No purchases.
- No location or personal data.

Expected outcome: the lowest available rating in every region.

## Category and contact

| Field | Value |
|---|---|
| Application type | App |
| Category | Puzzle |
| Tags | Brain games, Education |
| Privacy policy URL | `https://bizzehdee.github.io/mathscross/privacy.html` |
| Contact email | **Set before submission.** Play publishes this on the listing, so use an address chosen for that purpose |

## Not declared, because they are not present

Listed so a future reviewer can see these were considered rather than missed:

- No ads declaration — there are none.
- No families or Designed for Families declaration — **but this needs deciding
  before submission, not after.** It was settled when the audience was general adult
  players and the Kids tier was deferred. Easy and Medium were then re-graded
  explicitly for ages nine to fifteen, with a guarantee written into the generator
  to serve that, so the premise has changed even though no Kids tier was added.

  What turns on it: Play asks for a target age range, and selecting one that
  includes under-13s brings the app under Families policy. On the substance this app
  would very likely qualify — no adverts, no purchases, no accounts, no data
  collection, no network permission, and a privacy policy already published — but it
  adds review requirements and a second content-rating path, and it cannot be
  undeclared casually afterwards.

  The alternative is to keep the general-audience declaration and treat "suitable
  for nine and up" as a description rather than a targeting claim, which is what the
  full description above does.
- No parental gate — one guards external links, adverts or purchases, and release 1
  has none.
- No account deletion flow — there are no accounts.
