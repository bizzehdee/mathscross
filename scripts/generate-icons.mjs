// Generates every icon from one description. Plan section 9.5.
//
// Run with `npm run icons`. Output goes to public/icons/ and is committed, so a
// build needs no image tooling.
//
// The mark: a small cell fragment with a visible plus and equals, indigo on light.
// It has to read at 48px and it has to be obviously not the sibling Sudoku app's
// mark, because the accent alone does not distinguish two grid games at icon size.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createCanvas } from './png.mjs'

const OUT = join('public', 'icons')

const INDIGO = [0x3a, 0x5f, 0xa8]
const LIGHT = [0xf7, 0xf7, 0xf5]

/**
 * Draws the mark into a square canvas.
 *
 * `inset` is the fraction of the canvas left as margin. A maskable icon needs the
 * mark inside the safe zone — Android may crop up to 20% from each edge — so it
 * gets a larger inset and a full-bleed ground.
 *
 * `ground` draws the indigo behind the mark. Off for an adaptive icon foreground,
 * which supplies its own background layer.
 */
function draw(size, { maskable, ground = true }) {
  const canvas = createCanvas(size, size)
  const inset = maskable ? 0.22 : 0.08

  if (!ground) {
    // Left transparent: an Android adaptive foreground is composited over its own
    // background layer, so drawing the indigo here would hide that layer and the
    // launcher's parallax would move a solid block instead of the mark.
  } else if (maskable) {
    // Full bleed, so whatever shape the launcher crops to is filled.
    canvas.fill(INDIGO)
  } else {
    canvas.fillRect(0, 0, size, size, INDIGO)
  }

  const board = size * (1 - inset * 2)
  const origin = size * inset
  const cell = board / 3
  const gap = Math.max(1, Math.round(size / 64))

  // A 3x3 fragment. Two cells are left as ground to read as blanks a player fills,
  // which is what the game actually asks of them.
  const filled = [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [1, 2],
  ]
  for (const [cx, cy] of filled) {
    canvas.fillRect(
      origin + cx * cell + gap / 2,
      origin + cy * cell + gap / 2,
      cell - gap,
      cell - gap,
      LIGHT,
    )
  }

  // A plus in the middle cell of the top row's gap position, and an equals below
  // it, both cut out of the light cells in indigo. Drawn as bars rather than text,
  // so no font is involved and the result is identical everywhere.
  const bar = Math.max(2, Math.round(cell * 0.14))
  const armLength = cell * 0.5

  // Plus, centred in cell (1, 1) — the one deliberately left as ground.
  const px = origin + 1.5 * cell
  const py = origin + 1.5 * cell
  canvas.fillRect(px - armLength / 2, py - bar / 2, armLength, bar, LIGHT)
  canvas.fillRect(px - bar / 2, py - armLength / 2, bar, armLength, LIGHT)

  // Equals, in cell (2, 2), the other ground cell.
  const ex = origin + 2.5 * cell
  const ey = origin + 2.5 * cell
  canvas.fillRect(ex - armLength / 2, ey - bar * 1.4, armLength, bar, LIGHT)
  canvas.fillRect(ex - armLength / 2, ey + bar * 0.4, armLength, bar, LIGHT)

  return canvas
}

mkdirSync(OUT, { recursive: true })

const targets = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-192-maskable.png', size: 192, maskable: true },
  { name: 'icon-512-maskable.png', size: 512, maskable: true },
  // iOS ignores the manifest and uses this. It is composited onto an opaque
  // background by the OS, so it must not rely on transparency.
  { name: 'apple-touch-icon-180.png', size: 180, maskable: false },
]

for (const target of targets) {
  const canvas = draw(target.size, { maskable: target.maskable })
  writeFileSync(join(OUT, target.name), canvas.toPng())
  console.log(`${target.name} ${target.size}x${target.size}`)
}

// The SVG is the source of truth for the shape and is what a browser tab uses.
// Hand-written rather than traced from the raster, so the two cannot drift into
// disagreeing about what the mark is.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" role="img" aria-label="MathsCross">
  <rect width="48" height="48" rx="6" fill="#3a5fa8"/>
  <g fill="#f7f7f5">
    <rect x="5" y="5" width="11" height="11" rx="1"/>
    <rect x="18.5" y="5" width="11" height="11" rx="1"/>
    <rect x="32" y="5" width="11" height="11" rx="1"/>
    <rect x="5" y="18.5" width="11" height="11" rx="1"/>
    <rect x="32" y="18.5" width="11" height="11" rx="1"/>
    <rect x="5" y="32" width="11" height="11" rx="1"/>
    <rect x="18.5" y="32" width="11" height="11" rx="1"/>
    <rect x="20.75" y="22.5" width="6.5" height="2" rx="1"/>
    <rect x="23" y="20.25" width="2" height="6.5" rx="1"/>
    <rect x="34.25" y="34.75" width="6.5" height="2" rx="1"/>
    <rect x="34.25" y="38.25" width="6.5" height="2" rx="1"/>
  </g>
</svg>
`
writeFileSync(join('public', 'icon.svg'), svg)
console.log('icon.svg')

// The installed Android launcher icon.
//
// Without these the packaged app ships cordova-android's default Cordova mark,
// which is not the icon on the store listing. Play rejects that mismatch, and it
// is invisible locally because nothing in the web build uses these files. Adaptive
// and legacy are both generated: adaptive is what Android 8+ actually shows,
// legacy is the fallback below it. See ../.learnings/installed-icon-must-match-store.md.
const NATIVE_OUT = join('native', 'res', 'icon', 'android')
mkdirSync(NATIVE_OUT, { recursive: true })

// Legacy launcher icon sizes, in dp at each density.
const LEGACY_DENSITIES = [
  ['ldpi', 36],
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
]

// Adaptive layers are 108dp square, of which only the middle 72dp is guaranteed
// visible. ldpi has no adaptive bucket.
const ADAPTIVE_DENSITIES = [
  ['mdpi', 108],
  ['hdpi', 162],
  ['xhdpi', 216],
  ['xxhdpi', 324],
  ['xxxhdpi', 432],
]

for (const [density, size] of LEGACY_DENSITIES) {
  const name = `${density}.png`
  writeFileSync(join(NATIVE_OUT, name), draw(size, { maskable: false }).toPng())
  console.log(`native ${name} ${size}x${size}`)
}

for (const [density, size] of ADAPTIVE_DENSITIES) {
  const foreground = `${density}-foreground.png`
  writeFileSync(
    join(NATIVE_OUT, foreground),
    draw(size, { maskable: true, ground: false }).toPng(),
  )
  console.log(`native ${foreground} ${size}x${size}`)

  // A flat colour, as a file rather than a colour reference, so the layer is one
  // less thing that has to survive Cordova's resource generation.
  const background = createCanvas(size, size)
  background.fill(INDIGO)
  writeFileSync(join(NATIVE_OUT, `${density}-background.png`), background.toPng())
  console.log(`native ${density}-background.png ${size}x${size}`)
}
