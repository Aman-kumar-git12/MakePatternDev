// Generates public/icon/{16,32,48,128}.png — a rounded gradient tile with a white "</>".
// Run: node scripts/gen-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const segDist = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

// Glyph in a 0..1 unit square.
const SEGMENTS = [
  [[0.36, 0.33], [0.2, 0.5]], [[0.2, 0.5], [0.36, 0.67]], // <
  [[0.64, 0.33], [0.8, 0.5]], [[0.8, 0.5], [0.64, 0.67]], // >
  [[0.555, 0.28], [0.445, 0.72]], // /
];
const FROM = [42, 120, 214]; // #2a78d6
const TO = [98, 80, 214]; // #6250d6

function render(size) {
  const S = 4; // supersampling
  const buf = Buffer.alloc(size * size * 4);
  const radius = 0.22, stroke = size <= 16 ? 0.11 : 0.085;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0, fg = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const u = (x + (sx + 0.5) / S) / size, v = (y + (sy + 0.5) / S) / size;
        const qx = Math.max(Math.abs(u - 0.5) - (0.5 - radius), 0), qy = Math.max(Math.abs(v - 0.5) - (0.5 - radius), 0);
        if (Math.hypot(qx, qy) <= radius) {
          bg++;
          if (SEGMENTS.some(([a, b]) => segDist(u, v, a, b) <= stroke / 2)) fg++;
        }
      }
      const a = bg / (S * S), f = bg ? fg / bg : 0, t = (x + y) / (2 * size);
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) buf[i + c] = Math.round((FROM[c] + (TO[c] - FROM[c]) * t) * (1 - f) + 255 * f);
      buf[i + 3] = Math.round(a * 255);
    }
  }
  return png(size, buf);
}

mkdirSync(new URL('../public/icon/', import.meta.url), { recursive: true });
for (const size of [16, 32, 48, 128]) writeFileSync(new URL(`../public/icon/${size}.png`, import.meta.url), render(size));
console.log('icons written');
