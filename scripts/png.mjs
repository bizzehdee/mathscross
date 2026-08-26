// A minimal PNG encoder, so icons can be generated with no dependency.
//
// The alternative was a rasteriser or an image library for what amounts to
// drawing rectangles. Plan section 8.4 keeps runtime dependencies at zero and asks
// every build dependency to justify itself; a hundred lines of RGBA and zlib does
// not clear the bar for a package.
//
// Truecolour with alpha (colour type 6), 8 bits per channel, no interlacing. That
// is the simplest encoding every decoder supports.
import { deflateSync } from 'node:zlib'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let c = 0xff_ff_ff_ff
  for (const byte of bytes) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xff_ff_ff_ff) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBytes, data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

/**
 * A drawing surface.
 *
 * Coordinates are pixels with the origin top left. Colours are `[r, g, b]` with an
 * optional alpha; everything starts fully transparent.
 */
export function createCanvas(width, height) {
  const pixels = new Uint8Array(width * height * 4)

  const setPixel = (x, y, [r, g, b], alpha = 255) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return
    }
    const index = (Math.floor(y) * width + Math.floor(x)) * 4
    pixels[index] = r
    pixels[index + 1] = g
    pixels[index + 2] = b
    pixels[index + 3] = alpha
  }

  return {
    width,
    height,

    fill(colour, alpha) {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          setPixel(x, y, colour, alpha)
        }
      }
    },

    fillRect(x, y, w, h, colour, alpha) {
      const x0 = Math.round(x)
      const y0 = Math.round(y)
      const x1 = Math.round(x + w)
      const y1 = Math.round(y + h)
      for (let py = y0; py < y1; py += 1) {
        for (let px = x0; px < x1; px += 1) {
          setPixel(px, py, colour, alpha)
        }
      }
    },

    /** A filled circle, for a maskable icon's safe-zone-friendly ground. */
    fillCircle(cx, cy, radius, colour, alpha) {
      const r2 = radius * radius
      for (let py = Math.floor(cy - radius); py <= Math.ceil(cy + radius); py += 1) {
        for (let px = Math.floor(cx - radius); px <= Math.ceil(cx + radius); px += 1) {
          const dx = px - cx + 0.5
          const dy = py - cy + 0.5
          if (dx * dx + dy * dy <= r2) {
            setPixel(px, py, colour, alpha)
          }
        }
      }
    },

    toPng() {
      // One filter byte per scanline, always 0 (no filtering). Filtering would
      // shrink the file; at these sizes it is not worth the code.
      const stride = width * 4
      const raw = Buffer.alloc((stride + 1) * height)
      for (let y = 0; y < height; y += 1) {
        raw[y * (stride + 1)] = 0
        Buffer.from(pixels.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1)
      }

      const ihdr = Buffer.alloc(13)
      ihdr.writeUInt32BE(width, 0)
      ihdr.writeUInt32BE(height, 4)
      ihdr[8] = 8 // bit depth
      ihdr[9] = 6 // truecolour with alpha
      ihdr[10] = 0 // deflate
      ihdr[11] = 0 // adaptive filtering
      ihdr[12] = 0 // no interlace

      return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
      ])
    },
  }
}
