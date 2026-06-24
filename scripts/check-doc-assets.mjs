import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const expectedAssets = [
  ["docs/assets/background-remover-demo.png", 1440, 1000],
  ["docs/assets/preset-transparent-png.png", 600, 600],
  ["docs/assets/preset-marketplace-square.png", 600, 600],
  ["docs/assets/preset-listing-square.png", 600, 600],
  ["docs/assets/preset-storefront-card.png", 600, 450],
  ["docs/assets/preset-social-avatar.png", 600, 600],
  ["docs/assets/preset-video-thumbnail.png", 600, 338],
];

function readPngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error(`${filePath} is not a PNG file.`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

const failures = [];

for (const [relativePath, expectedWidth, expectedHeight] of expectedAssets) {
  const absolutePath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath} is missing.`);
    continue;
  }

  try {
    const { width, height } = readPngDimensions(absolutePath);
    if (width !== expectedWidth || height !== expectedHeight) {
      failures.push(
        `${relativePath} is ${width}x${height}; expected ${expectedWidth}x${expectedHeight}.`
      );
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

if (failures.length > 0) {
  console.error("Documentation asset check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Documentation asset check passed for ${expectedAssets.length} PNG files.`);
