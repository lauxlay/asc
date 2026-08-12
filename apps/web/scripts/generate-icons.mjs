import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

/**
 * Génère les icônes PNG du manifeste PWA à partir du même dessin que
 * `public/favicon.svg` : une cabine, deux flèches.
 *
 * Un encodeur PNG de 40 lignes évite d'ajouter une dépendance de traitement
 * d'images au monorepo pour trois fichiers qui ne changeront jamais.
 *
 *   node scripts/generate-icons.mjs
 */

const BACKGROUND = [15, 23, 42, 255]; // #0f172a
const FOREGROUND = [248, 250, 252, 255]; // #f8fafc

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0; // filtre « none »
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixelAt(x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
      offset += 4;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 8 bits par canal
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Dessin normalisé sur une grille 64×64, comme le SVG. */
function glyph(u, v) {
  const inRect = (x, y, w, h) => u >= x && u < x + w && v >= y && v < y + h;
  const onCabinOutline =
    inRect(16, 14, 32, 36) && !inRect(19, 17, 26, 30) ? true : inRect(31, 14, 2, 36);
  const inDownArrow = v >= 30 && v <= 36 && Math.abs(u - 24) <= (36 - v) * 0.7;
  const inUpArrow = v >= 28 && v <= 34 && Math.abs(u - 40) <= (v - 28) * 0.7;
  return onCabinOutline || inDownArrow || inUpArrow;
}

function draw(size, { padding, background }) {
  const inner = size * (1 - 2 * padding);
  return (x, y) => {
    const u = ((x - size * padding) / inner) * 64;
    const v = ((y - size * padding) / inner) * 64;
    if (u < 0 || u >= 64 || v < 0 || v >= 64) {
      return background;
    }
    return glyph(u, v) ? FOREGROUND : background;
  };
}

const outputDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outputDir, { recursive: true });

const icons = [
  ["icon-192.png", 192, { padding: 0, background: BACKGROUND }],
  ["icon-512.png", 512, { padding: 0, background: BACKGROUND }],
  // « maskable » : le système peut rogner jusqu'à 20 % sur chaque bord, donc
  // le dessin est réduit au centre.
  ["icon-512-maskable.png", 512, { padding: 0.14, background: BACKGROUND }],
];

for (const [name, size, options] of icons) {
  writeFileSync(join(outputDir, name), encodePng(size, draw(size, options)));
  process.stdout.write(`${name} (${size}×${size})\n`);
}
