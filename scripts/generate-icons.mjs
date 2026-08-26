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
 */
function draw(size, { maskable }) {
  const canvas = createCanvas(size, size)
  const inset = maskable ? 0.22 : 0.08

  if (maskable) {
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
