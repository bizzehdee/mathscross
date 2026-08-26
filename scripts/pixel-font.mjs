// A 5x7 bitmap font, for the feature graphic's wording.
//
// Bitmap rather than a real font file for the same reason png.mjs exists: drawing
// three short lines of capitals does not justify a font loader or a rasteriser, and
// a bitmap renders identically on every machine, so the committed graphic never
// depends on what fonts happen to be installed.
//
// It covers only the characters the graphic uses and **throws on anything else**.
// That is deliberate: a change to the wording should fail loudly rather than
// silently drop a letter.

/** Each glyph is 7 rows of 5 columns, '#' set and '.' clear. */
const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  W: ['#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
}

export const GLYPH_WIDTH = 5
export const GLYPH_HEIGHT = 7

/** Columns of blank space between glyphs, in font units. */
const TRACKING = 1

export function measureText(text, scale) {
  const glyphs = text.length
  const width = (glyphs * GLYPH_WIDTH + Math.max(0, glyphs - 1) * TRACKING) * scale
  return { width, height: GLYPH_HEIGHT * scale }
}

/**
 * Draws text at `scale` pixels per font unit.
 *
 * Throws on an unknown character rather than skipping it, so a reworded graphic
 * fails the build instead of shipping a hole in a word.
 */
export function drawText(canvas, text, x, y, scale, colour) {
  let cursor = x

  for (const character of text) {
    const glyph = GLYPHS[character]
    if (glyph === undefined) {
      throw new Error(
        `pixel-font: no glyph for ${JSON.stringify(character)}. ` +
          'Add it to GLYPHS rather than changing the wording to avoid it.',
      )
    }

    for (let row = 0; row < GLYPH_HEIGHT; row += 1) {
      const bits = glyph[row]
      for (let column = 0; column < GLYPH_WIDTH; column += 1) {
        if (bits[column] === '#') {
          canvas.fillRect(cursor + column * scale, y + row * scale, scale, scale, colour)
        }
      }
    }

    cursor += (GLYPH_WIDTH + TRACKING) * scale
  }
}
