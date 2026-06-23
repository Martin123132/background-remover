/* global HTMLImageElement, console, document, process */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const artifactDir = path.join(projectRoot, ".tmp", "qa-preview-export");
const downloadDir = path.join(artifactDir, "downloads");
const screenshotPath = path.join(artifactDir, "preview-performance-result.png");
const browserExecutablePath = process.env.BROWSER_EXECUTABLE_PATH;
const inputImage =
  process.env.BACKGROUND_REMOVER_TEST_IMAGE ||
  path.join(projectRoot, "test-fixtures", "safe-product-mug.png");
const inputBaseName = path.parse(inputImage).name;
const selectedPath = path.join(artifactDir, `${inputBaseName}-marketplace-2000.png`);
const zipPath = path.join(artifactDir, "background-remover-marketplace-2000-1-image.zip");
const expectedZipEntry = `${inputBaseName}-marketplace-2000.png`;
const url = process.env.BACKGROUND_REMOVER_QA_URL || "http://127.0.0.1:5175/";

for (const dir of [artifactDir, downloadDir]) fs.mkdirSync(dir, { recursive: true });
for (const filePath of [screenshotPath, selectedPath, zipPath]) {
  if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pngDimensions(buffer) {
  assert(buffer.subarray(1, 4).toString("ascii") === "PNG", "File is not a PNG.");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function imageInfo(page, selector) {
  return page.locator(selector).evaluate(async (img) => {
    if (!img.complete) {
      await new Promise((resolve, reject) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", reject, { once: true });
      });
    }

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(img, 0, 0);
    const corner = Array.from(context.getImageData(12, 12, 1, 1).data);

    return {
      src: img.currentSrc,
      width: img.naturalWidth,
      height: img.naturalHeight,
      corner,
    };
  });
}

async function main() {
  assert(projectRoot.startsWith("D:\\"), `Project root must be on D:. Current root: ${projectRoot}`);
  if (browserExecutablePath) {
    assert(fs.existsSync(browserExecutablePath), `Browser executable not found: ${browserExecutablePath}`);
  }
  assert(fs.existsSync(inputImage), `Missing test image: ${inputImage}`);

  const errors = [];
  const warnings = [];
  const failedRequests = [];
  const browser = await chromium.launch({
    ...(browserExecutablePath ? { executablePath: browserExecutablePath } : { channel: "msedge" }),
    headless: true,
    downloadsPath: downloadDir,
  });

  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();

    page.on("console", (message) => {
      const entry = `${message.text()} @ ${message.location().url}`;
      if (message.type() === "error") errors.push(entry);
      if (message.type() === "warning") warnings.push(entry);
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => {
      failedRequests.push({
        url: request.url(),
        failure: request.failure()?.errorText,
        resourceType: request.resourceType(),
      });
    });

    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    const identity = {
      title: await page.title(),
      sceneCards: await page.locator(".scene-card").count(),
      presetCards: await page.locator(".preset-card").count(),
      queueTools: await page.locator(".queue-tool").count(),
      rangeFields: await page.locator(".range-field input").count(),
      overlayText: await page.getByText("Failed to compile").count(),
    };
    assert(identity.title === "Background Remover", `Unexpected title: ${identity.title}`);
    assert(identity.sceneCards === 5, `Unexpected scene count: ${identity.sceneCards}`);
    assert(identity.presetCards === 4, `Unexpected preset count: ${identity.presetCards}`);
    assert(identity.queueTools === 3, `Unexpected queue tool count: ${identity.queueTools}`);
    assert(identity.rangeFields === 3, `Unexpected range field count: ${identity.rangeFields}`);
    assert(identity.overlayText === 0, "Framework error overlay detected.");

    await page.locator('input[type="file"]').setInputFiles(inputImage);
    await page.getByRole("button", { name: "Remove backgrounds" }).click();
    await page.locator(".comparison-output").waitFor({ state: "visible", timeout: 180000 });
    await page.locator(".quality-badge").waitFor({
      state: "visible",
      timeout: 10000,
    });

    await page.locator(".preset-card", { hasText: "Marketplace square" }).click();
    await page.locator(".scene-card", { hasText: "Warm sweep" }).click();
    await page.locator(".toggle-row input").check();
    const sliders = page.locator(".range-field input");
    await sliders.nth(0).fill("72");
    await sliders.nth(1).fill("42");
    await sliders.nth(2).fill("36");

    await page.waitForFunction(() => {
      const image = document.querySelector(".comparison-output");
      if (!(image instanceof HTMLImageElement) || image.naturalWidth !== 900 || image.naturalHeight !== 900) {
        return false;
      }
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return false;
      context.drawImage(image, 0, 0);
      return context.getImageData(12, 12, 1, 1).data[3] === 255;
    }, null, { timeout: 30000 });

    const previewInfo = await imageInfo(page, ".comparison-output");
    assert(previewInfo.width === 900, `Preview width ${previewInfo.width}`);
    assert(previewInfo.height === 900, `Preview height ${previewInfo.height}`);
    assert(previewInfo.corner[3] === 255, "Preview scene corner should be opaque.");

    const [selectedDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 30000 }),
      page.locator(".preview-toolbar .secondary-button").click(),
    ]);
    await selectedDownload.saveAs(selectedPath);
    const selectedBuffer = fs.readFileSync(selectedPath);
    const selectedDimensions = pngDimensions(selectedBuffer);
    assert(selectedDimensions.width === 2000, `Export width ${selectedDimensions.width}`);
    assert(selectedDimensions.height === 2000, `Export height ${selectedDimensions.height}`);

    const [zipDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 30000 }),
      page.locator(".action-row .secondary-button").click(),
    ]);
    const zipSuggestedFilename = zipDownload.suggestedFilename();
    assert(
      zipSuggestedFilename === "background-remover-marketplace-2000-1-image.zip",
      `Unexpected ZIP filename: ${zipSuggestedFilename}`
    );
    await zipDownload.saveAs(zipPath);
    const zipBuffer = fs.readFileSync(zipPath);
    const zip = await JSZip.loadAsync(zipBuffer);
    const entries = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
    assert(entries.length === 1, `Unexpected ZIP entries: ${entries.join(", ")}`);
    assert(entries[0] === expectedZipEntry, `Unexpected ZIP entry: ${entries[0]}`);
    const zippedPng = await zip.files[entries[0]].async("nodebuffer");
    const zippedDimensions = pngDimensions(zippedPng);
    assert(zippedDimensions.width === 2000, `Zipped width ${zippedDimensions.width}`);
    assert(zippedDimensions.height === 2000, `Zipped height ${zippedDimensions.height}`);

    await page.screenshot({ path: screenshotPath, fullPage: false });

    const relevantErrors = errors.filter((text) => !text.includes("favicon"));
    assert(relevantErrors.length === 0, `Console errors: ${relevantErrors.join(" | ")}`);
    assert(failedRequests.length === 0, `Failed requests: ${JSON.stringify(failedRequests)}`);

    console.log(JSON.stringify({
      ok: true,
      url,
      inputImage,
      identity,
      previewInfo,
      selectedDimensions,
      selectedSize: selectedBuffer.length,
      zipSuggestedFilename,
      zipEntries: entries,
      zippedDimensions,
      zipSize: zipBuffer.length,
      artifacts: {
        screenshotPath,
        selectedPath,
        zipPath,
      },
      consoleErrors: errors,
      consoleWarnings: warnings,
      failedRequests,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
