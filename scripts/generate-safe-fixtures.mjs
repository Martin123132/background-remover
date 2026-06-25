import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.join(projectRoot, "test-fixtures", "safe-studio-product.png");
const width = 900;
const height = 900;
const pixels = new Uint8ClampedArray(width * height * 4);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function color(hex) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function blendPixel(x, y, [r, g, b], alpha = 1) {
  if (x < 0 || y < 0 || x >= width || y >= height || alpha <= 0) return;

  const index = (Math.floor(y) * width + Math.floor(x)) * 4;
  const nextAlpha = clamp(alpha, 0, 1);
  const previousAlpha = pixels[index + 3] / 255;
  const outAlpha = nextAlpha + previousAlpha * (1 - nextAlpha);

  if (outAlpha === 0) return;

  pixels[index] = Math.round((r * nextAlpha + pixels[index] * previousAlpha * (1 - nextAlpha)) / outAlpha);
  pixels[index + 1] = Math.round((g * nextAlpha + pixels[index + 1] * previousAlpha * (1 - nextAlpha)) / outAlpha);
  pixels[index + 2] = Math.round((b * nextAlpha + pixels[index + 2] * previousAlpha * (1 - nextAlpha)) / outAlpha);
  pixels[index + 3] = Math.round(outAlpha * 255);
}

function drawRect(x, y, rectWidth, rectHeight, fill) {
  const endX = Math.min(width, Math.ceil(x + rectWidth));
  const endY = Math.min(height, Math.ceil(y + rectHeight));
  for (let row = Math.max(0, Math.floor(y)); row < endY; row += 1) {
    for (let column = Math.max(0, Math.floor(x)); column < endX; column += 1) {
      blendPixel(column, row, fill, 1);
    }
  }
}

function roundedRectAlpha(px, py, x, y, rectWidth, rectHeight, radius) {
  const centerX = x + rectWidth / 2;
  const centerY = y + rectHeight / 2;
  const qx = Math.abs(px - centerX) - (rectWidth / 2 - radius);
  const qy = Math.abs(py - centerY) - (rectHeight / 2 - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  const distance = outside + inside - radius;
  return clamp(0.5 - distance, 0, 1);
}

function drawRoundedRect(x, y, rectWidth, rectHeight, radius, fill, alpha = 1) {
  const endX = Math.min(width, Math.ceil(x + rectWidth + 1));
  const endY = Math.min(height, Math.ceil(y + rectHeight + 1));
  for (let row = Math.max(0, Math.floor(y - 1)); row < endY; row += 1) {
    for (let column = Math.max(0, Math.floor(x - 1)); column < endX; column += 1) {
      const coverage = roundedRectAlpha(column + 0.5, row + 0.5, x, y, rectWidth, rectHeight, radius);
      blendPixel(column, row, fill, coverage * alpha);
    }
  }
}

function ellipseAlpha(px, py, centerX, centerY, radiusX, radiusY) {
  const nx = (px - centerX) / radiusX;
  const ny = (py - centerY) / radiusY;
  const distance = Math.sqrt(nx * nx + ny * ny);
  return clamp((1 - distance) * Math.min(radiusX, radiusY), 0, 1);
}

function drawEllipse(centerX, centerY, radiusX, radiusY, fill, alpha = 1) {
  const endX = Math.min(width, Math.ceil(centerX + radiusX + 1));
  const endY = Math.min(height, Math.ceil(centerY + radiusY + 1));
  for (let row = Math.max(0, Math.floor(centerY - radiusY - 1)); row < endY; row += 1) {
    for (let column = Math.max(0, Math.floor(centerX - radiusX - 1)); column < endX; column += 1) {
      const coverage = ellipseAlpha(column + 0.5, row + 0.5, centerX, centerY, radiusX, radiusY);
      blendPixel(column, row, fill, coverage * alpha);
    }
  }
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

let crcTable;
function crc32(buffer) {
  crcTable ??= Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });

  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodePng() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let row = 0; row < height; row += 1) {
    const targetStart = row * (width * 4 + 1);
    const sourceStart = row * width * 4;
    scanlines[targetStart] = 0;
    Buffer.from(pixels.buffer, sourceStart, width * 4).copy(scanlines, targetStart + 1);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk("IHDR", header),
    makeChunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

drawRect(0, 0, width, height, color("#ffffff"));

drawRoundedRect(324, 244, 252, 420, 84, color("#1f777a"));
drawEllipse(450, 244, 126, 42, color("#1f777a"));
drawEllipse(450, 244, 86, 22, color("#fffaf3"));
drawEllipse(450, 244, 56, 13, color("#151515"));
drawRect(324, 340, 252, 58, color("#e25135"));
drawRoundedRect(372, 444, 156, 126, 24, color("#fffaf3"));
drawRoundedRect(398, 486, 104, 16, 8, color("#1f777a"));
drawRoundedRect(412, 522, 76, 12, 6, color("#e25135"));
drawRoundedRect(365, 310, 44, 230, 26, color("#ffffff"), 0.2);
drawRoundedRect(352, 198, 196, 62, 22, color("#101820"));
drawEllipse(450, 198, 98, 22, color("#2b3338"));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, encodePng());

console.log(JSON.stringify({ ok: true, outputPath, width, height }, null, 2));
