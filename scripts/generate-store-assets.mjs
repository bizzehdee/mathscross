// Generates the Play listing graphics that have to be drawn rather than captured:
// the 1024x500 feature graphic, and the 512x512 store icon. Plan section 9.6.
//
// Run with `npm run store:assets`. Output goes to store/, is committed, and is
// uploaded to Play Console by hand.
//
// Screenshots are NOT here. Those are captured from the running app, because a
// drawn imitation of the game would misrepresent it — and a store screenshot is a
// representation of the product, not an illustration. See store/README.md.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createCanvas } from './png.mjs'
import { drawText, measureText } from './pixel-font.mjs'

const OUT = 'store'
const INDIGO = [0x3a, 0x5f, 0xa8]
const LIGHT = [0xf7, 0xf7, 0xf5]

/** Play rejects a feature graphic that is not exactly this size. */
const FEATURE_WIDTH = 1024
const FEATURE_HEIGHT = 500

/**
 * Draws a grid of `divisions` cells with the given cells filled.
 *
 * The outer box uses the same weight as the dividers, so the figure reads as one
 * object at thumbnail size rather than as a box containing lines.
 */
function drawGrid(canvas, { x, y, size, divisions, lineWidth, colour, filled }) {
  const cell = size / divisions

  canvas.fillRect(x, y, size, lineWidth, colour)
  canvas.fillRect(x, y + size - lineWidth, size, lineWidth, colour)
  canvas.fillRect(x, y, lineWidth, size, colour)
  canvas.fillRect(x + size - lineWidth, y, lineWidth, size, colour)

  for (let n = 1; n < divisions; n += 1) {
    canvas.fillRect(x + cell * n - lineWidth / 2, y, lineWidth, size, colour)
    canvas.fillRect(x, y + cell * n - lineWidth / 2, size, lineWidth, colour)
  }

  // Inset, so a filled cell never touches a divider and the grid stays legible.
  const inset = lineWidth * 1.6
  for (const [cx, cy] of filled) {
    canvas.fillRect(
      x + cell * cx + inset,
      y + cell * cy + inset,
      cell - inset * 2,
      cell - inset * 2,
      colour,
    )
  }
}

function featureGraphic() {
  const canvas = createCanvas(FEATURE_WIDTH, FEATURE_HEIGHT)
  canvas.fill(INDIGO)

  // A 4x4 grid on the left, a few cells filled to suggest entered digits and
  // blanks waiting. Deliberately not a full board: at thumbnail size a 9x9 reads
  // as texture rather than as a puzzle.
  const gridSize = 320
  drawGrid(canvas, {
    x: 90,
    y: (FEATURE_HEIGHT - gridSize) / 2,
    size: gridSize,
    divisions: 4,
    lineWidth: 6,
    colour: LIGHT,
    filled: [
      [0, 0],
      [2, 0],
      [1, 1],
      [3, 1],
      [0, 2],
      [2, 3],
    ],
  })

  // Wording kept to three short lines. A feature graphic is shown small and
  // cropped, so anything longer is unreadable where it matters.
  const lines = ['MATHSCROSS', 'OFFLINE MATHS', 'CROSSWORDS']
  const scale = [7, 5, 5]
  let y = 150

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const size = scale[index]
    drawText(canvas, line, 500, y, size, LIGHT)
    y += measureText(line, size).height + (index === 0 ? 40 : 18)
  }

  return canvas
}

mkdirSync(OUT, { recursive: true })
mkdirSync(join(OUT, 'screenshots'), { recursive: true })

writeFileSync(join(OUT, 'feature-graphic-1024x500.png'), featureGraphic().toPng())
console.log(`feature-graphic-1024x500.png ${FEATURE_WIDTH}x${FEATURE_HEIGHT}`)

// Copied, not redrawn. A redrawn store icon drifts away from the installed one,
// and the two disagreeing is exactly the kind of thing nobody notices until a
// player does.
copyFileSync(join('public', 'icons', 'icon-512.png'), join(OUT, 'icon-512.png'))
console.log('icon-512.png copied from public/icons/')
