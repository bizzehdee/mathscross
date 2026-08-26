# Store assets

Everything Google Play needs that is not the binary. Uploaded to Play Console by
hand; nothing here ships in the app.

The listing text, the asset sizes and the Data Safety answers are in
[listing.md](listing.md).

## Generated

```bash
npm run store:assets
```

Writes `feature-graphic-1024x500.png` and `icon-512.png`, both committed. Drawn with
this repository's own PNG encoder in `scripts/png.mjs`, so no rasteriser or design
tool is needed to reproduce them.

The store icon is **copied** from `public/icons/icon-512.png` rather than redrawn, so
the listing and the installed app cannot drift apart. The feature graphic's type is a
5x7 bitmap font in `scripts/pixel-font.mjs` which covers only the characters the
graphic uses and throws on anything else — so a change to the wording fails loudly
instead of dropping a letter.

## Screenshots

**Captured from the running app, never drawn.** A store screenshot is a
representation of the product; an illustration of a grid that is not the actual UI
misleads whoever is deciding whether to install. That is a policy risk as well as a
dishonest one.

Play requires exactly 16:9 or 9:16, so use these dimensions rather than a real
device's odd aspect ratio.

| Set | Size | Notes |
|---|---|---|
| Phone | 1080 x 1920 | At least 4 needed for promotion eligibility |
| 7-inch tablet | 1920 x 1080 | Landscape shows the side-by-side layout |
| 10-inch tablet | 2560 x 1440 | Both sides must be 1080 px or more |

### Set the CSS viewport, not the pixel size

The single thing to get right.

The board is sized by a `min()` that caps it — see `--board-cap` in
`src/styles/layout.css`. So a CSS viewport 1080 px wide does **not** produce a bigger
board. It produces the same capped board sitting in a much emptier frame, which looks
broken.

What is wanted is a phone-sized CSS viewport at a device pixel ratio of 2, which is
what a real phone actually is:

| CSS viewport | DPR | Output |
|---|---|---|
| 540 x 960 | 2 | 1080 x 1920, laid out as a phone |
| 1080 x 1920 | 1 | 1080 x 1920, but laid out as a tablet |

For the landscape sets, a CSS viewport of 768 x 432 at DPR 2.5 gives 1920 x 1080 and
triggers the aspect-ratio layout switch. Expect margins either side of the board: at
16:9 the board is capped by height, and that is genuinely how the app looks on a 16:9
tablet.

### Capturing them

Either produces the sizes above:

- **Chrome DevTools.** Device toolbar, a custom device with the CSS viewport and DPR
  from the table, then Capture screenshot. It writes the full device-pixel image, so
  a 540 x 960 device at DPR 2 saves as 1080 x 1920. Capture the viewport only — no
  browser chrome and no device frame; Play rejects a screenshot padded out to the
  wrong aspect ratio.
- **An Android emulator** running the built app. Slower, but it is the real webview,
  which is the only way to catch a layout problem that appears only in the shell.

Set the theme deliberately rather than accepting whatever the machine is in. A mix of
light and dark shots looks accidental; one theme throughout, with at most one shot
showing the alternative, reads as a choice.

Check each file afterwards, because a capture at the wrong DPR silently doubles or
halves it:

```bash
node -e "const b=require('fs').readFileSync(process.argv[1]);console.log(process.argv[1],b.readUInt32BE(16)+'x'+b.readUInt32BE(20))" store/screenshots/phone-1-board.png
```

### What to show

Four phone screenshots, in this order. The choices are specific to this game:

1. **A part-solved Medium board**, showing the grouping cue on a multi-cell number.
   The grouping is the one thing about MathsCross worth explaining, so show it.
2. **The how-to-play screen.** A player who learns from the listing that digits join
   into numbers arrives already understanding the mechanic.
3. **The home screen**, showing three difficulties and the daily.
4. **Statistics**, showing a daily streak.

Use the landscape sets on the side-by-side layout, since that is what a tablet user
is choosing between.

Name them so the upload order is obvious:

```
screenshots/phone-1-board.png
screenshots/phone-2-howtoplay.png
screenshots/phone-3-home.png
screenshots/phone-4-stats.png
screenshots/tablet7-1-board.png
screenshots/tablet10-1-board.png
```

## Not yet done

`screenshots/` is empty. Screenshots cannot be captured until the app is running in
the native shell, and the shell has never been built — there is no Android SDK on the
development machine. See `../native/README.md` for what else is waiting on a device.

The contact email in `listing.md` is also unset, and Play requires one.
