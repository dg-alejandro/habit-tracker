/*
 * Genera los iconos de la PWA sin ninguna dependencia.
 *
 * iOS no acepta SVG en `apple-touch-icon`: si no hay PNG, pone una captura de
 * la página como icono de la pantalla de inicio. Y añadir `sharp` o
 * `@vite-pwa/assets-generator` solo para pintar un rectángulo y un tick sería
 * una dependencia nueva sin justificar (CLAUDE.md §2), así que se rasteriza a
 * mano y se codifica el PNG con `node:zlib`, que es nativo.
 *
 * Se ejecuta a mano (`npm run icons`) y los PNG se comitean: son contenido
 * determinista, no artefactos de build, y Vercel Hobby solo da 100 minutos de
 * build al mes (§9).
 *
 * Uso:  node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, readFileSync } from 'node:fs'

/* ── Tokens ────────────────────────────────────────────────────────────────
 * Copiados de src/styles/tokens.css. Si cambian allí, cambian aquí — y por eso
 * este script emite también el favicon.svg, para que no puedan divergir.
 */
const PAPER = [0x0f, 0x0f, 0x0f]
const INK = [0xf0, 0xf0, 0xf0]

/* ── Geometría, en unidades 0–1 (el favicon original es un viewBox 0 0 100 100) ── */
const RADIUS = 0.22 // rx="22"
const STROKE = 0.1 // stroke-width="10"
const CHECK = [
  [0.28, 0.52],
  [0.44, 0.68],
  [0.74, 0.34],
]
/** Submuestras por lado y píxel: 4×4 = 16 muestras. */
const SS = 4

/* ── Geometría ─────────────────────────────────────────────────────────────── */

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

/**
 * El tick, escalado sobre el centro. Como el test es por DISTANCIA a los
 * segmentos, los extremos y el vértice salen redondeados gratis: es justo lo
 * que hacen stroke-linecap y stroke-linejoin en el SVG.
 */
function insideCheck(x, y, scale) {
  const px = 0.5 + (x - 0.5) / scale
  const py = 0.5 + (y - 0.5) / scale
  const half = STROKE / 2
  for (let i = 0; i < CHECK.length - 1; i += 1) {
    const [ax, ay] = CHECK[i]
    const [bx, by] = CHECK[i + 1]
    if (distanceToSegment(px, py, ax, ay, bx, by) <= half) return true
  }
  return false
}

/** Rectángulo de esquinas redondeadas: el cuadrado menos los cuatro cuartos. */
function insideRoundedRect(x, y) {
  const r = RADIUS
  const cx = x < r ? r : x > 1 - r ? 1 - r : x
  const cy = y < r ? r : y > 1 - r ? 1 - r : y
  if (cx === x || cy === y) return true // fuera de las zonas de esquina
  return Math.hypot(x - cx, y - cy) <= r
}

/* ── Rasterizado ───────────────────────────────────────────────────────────── */

function renderIcon(size, { rounded, scale }) {
  const out = new Uint8Array(size * size * 4)

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      // Acumulación PREMULTIPLICADA: sin esto, las esquinas redondeadas salen
      // con una orla oscura al mezclarse con el fondo transparente.
      let sumR = 0
      let sumG = 0
      let sumB = 0
      let sumA = 0

      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const x = (px + (sx + 0.5) / SS) / size
          const y = (py + (sy + 0.5) / SS) / size
          if (rounded && !insideRoundedRect(x, y)) continue
          const color = insideCheck(x, y, scale) ? INK : PAPER
          sumR += color[0]
          sumG += color[1]
          sumB += color[2]
          sumA += 1
        }
      }

      const samples = SS * SS
      const index = (py * size + px) * 4
      if (sumA === 0) {
        out[index] = 0
        out[index + 1] = 0
        out[index + 2] = 0
        out[index + 3] = 0
        continue
      }
      out[index] = Math.round(sumR / sumA)
      out[index + 1] = Math.round(sumG / sumA)
      out[index + 2] = Math.round(sumB / sumA)
      out[index + 3] = Math.round((sumA / samples) * 255)
    }
  }

  return out
}

/* ── PNG ───────────────────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // profundidad de bit
  ihdr[9] = 6 // color type 6 = RGBA
  ihdr[10] = 0 // compresión deflate
  ihdr[11] = 0 // filtrado estándar
  ihdr[12] = 0 // sin entrelazado

  // Cada línea lleva delante su byte de filtro. 0 = None: con dos colores
  // planos, deflate ya deja el archivo en unos pocos KB.
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y += 1) {
    const offset = y * (1 + width * 4)
    raw[offset] = 0
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, offset + 1)
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/* ── Salidas ───────────────────────────────────────────────────────────────── */

const OUTPUTS = [
  // purpose 'any': con el redondeo del favicon, para escritorio y Android,
  // donde no siempre hay una máscara del sistema.
  { file: 'public/icon-192.png', size: 192, rounded: true, scale: 1 },
  { file: 'public/icon-512.png', size: 512, rounded: true, scale: 1 },
  // maskable: a sangre y con el glifo encogido. La zona segura es el círculo
  // central del 80 %, o sea radio 0,40; la semidiagonal del tick es 0,356, así
  // que ya cabía — el 0,9 solo le da aire. Redondear aquí sería un error: el
  // sistema aplica su propia máscara encima.
  { file: 'public/icon-maskable-512.png', size: 512, rounded: false, scale: 0.9 },
  // iOS aplica su squircle: un icono ya redondeado enseñaría esquinas negras
  // DENTRO de la máscara.
  { file: 'public/apple-touch-icon.png', size: 180, rounded: false, scale: 1 },
]

const hex = (color) => `#${color.map((c) => c.toString(16).padStart(2, '0')).join('')}`

/** El favicon sale de las MISMAS constantes, para que no puedan divergir. */
function writeFaviconSvg() {
  const points = CHECK.map(([x, y]) => `${x * 100} ${y * 100}`)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${RADIUS * 100}" fill="${hex(PAPER)}" />
  <path d="M${points[0]} L${points[1]} L${points[2]}" stroke="${hex(INK)}" stroke-width="${STROKE * 100}" fill="none" stroke-linecap="round" stroke-linejoin="round" />
</svg>
`
  writeFileSync('public/favicon.svg', svg)
  console.log(`public/favicon.svg  ${svg.length} bytes`)
}

/** Reabre lo escrito y comprueba su cabecera. Sin infraestructura de tests. */
function verify(file, size) {
  const buffer = readFileSync(file)
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  for (let i = 0; i < signature.length; i += 1) {
    if (buffer[i] !== signature[i]) throw new Error(`${file}: no es un PNG`)
  }
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') throw new Error(`${file}: falta el IHDR`)
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  const colorType = buffer[25]
  if (width !== size || height !== size) {
    throw new Error(`${file}: mide ${width}×${height} y debería medir ${size}×${size}`)
  }
  if (colorType !== 6) throw new Error(`${file}: color type ${colorType}, se esperaba 6 (RGBA)`)
  console.log(`${file}  ${width}×${height}  ${buffer.length} bytes`)
}

writeFaviconSvg()
for (const { file, size, rounded, scale } of OUTPUTS) {
  writeFileSync(file, encodePng(size, size, renderIcon(size, { rounded, scale })))
  verify(file, size)
}
console.log('Iconos generados.')
