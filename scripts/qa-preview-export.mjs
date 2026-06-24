/* global HTMLImageElement, console, document, process */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { chromium } from "playwright-core";
import {
  QA_PREVIEW_MAX_DIMENSION,
  QA_QUERY_PARAM_KEY,
  QA_QUERY_PARAM_VALUE,
  QA_SHADOW_SLIDERS,
  QA_UI_DEFAULTS,
} from "./qa-contract.mjs";

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
const qaInputImages = [inputImage, inputImage];
const selectedPresetSuffix = "marketplace-2000";
const selectedSceneId = "warm";
const selectedPath = path.join(artifactDir, `${inputBaseName}-${selectedPresetSuffix}.png`);
const zipFilename = `background-remover-${selectedPresetSuffix}-${selectedSceneId}-${qaInputImages.length}-images.zip`;
const zipPath = path.join(
  artifactDir,
  zipFilename
);
const expectedManifestFilename = `${zipFilename.replace(/\.zip$/, "")}-manifest.csv`;
function uniquifyFilenames(names) {
  const counts = new Map();
  return names.map((name) => {
    const count = counts.get(name) ?? 0;
    counts.set(name, count + 1);
    if (count === 0) return name;

    const dotIndex = name.lastIndexOf(".");
    const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
    const ext = dotIndex > 0 ? name.slice(dotIndex) : "";

    return `${base}-${count + 1}${ext}`;
  });
}

const expectedZipEntries = uniquifyFilenames(
  qaInputImages.map((fixturePath) => `${path.parse(fixturePath).name}-marketplace-2000.png`)
);
const expectedImageZipEntries = [...expectedZipEntries].sort();
const expectedZipEntriesWithManifest = [...expectedImageZipEntries, expectedManifestFilename].sort();
const rawUrl = process.env.BACKGROUND_REMOVER_QA_URL || "http://127.0.0.1:5175/";
const qaUrl = (() => {
  const parsed = new URL(rawUrl);
  parsed.searchParams.set(QA_QUERY_PARAM_KEY, QA_QUERY_PARAM_VALUE);
  return parsed.toString();
})();

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

async function waitForProcessingState(page, timeoutMs = 30000) {
  try {
    await page.waitForFunction(
      () => {
        const banner = document.querySelector(".queue-processing-banner");
        const status = document.querySelector(".queue-item-state");
        return !!(
          banner ||
          (status && status.textContent && status.textContent.trim() === "Processing")
        );
      },
      { timeout: timeoutMs }
    );
    return true;
  } catch {
    return false;
  }
}

async function waitForNoProcessingState(page, timeoutMs = 30000) {
  try {
    await page.waitForFunction(() => {
      const states = Array.from(document.querySelectorAll(".queue-item-state"));
      if (states.length === 0) return false;

      return states.every((state) => state.textContent?.trim() !== "Processing");
    }, { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function assertProcessingLocks(page, shouldBeLocked) {
  const controls = [
    [page.getByRole("button", { name: "Clear queue" }), "Clear queue"],
    [page.getByRole("button", { name: "Remove backgrounds" }), "topbar Remove backgrounds"],
    [page.locator('.action-row button', { hasText: "Retry failed" }), "topbar Retry failed"],
    [page.locator('.action-row .secondary-button'), "topbar Export processed ZIP"],
    [page.locator('.queue-tools .queue-tool', { hasText: "Process queue" }), "queue Process queue"],
    [page.locator('.queue-tools .queue-tool', { hasText: "Retry failed" }), "queue Retry failed"],
    [page.locator('.queue-tools .queue-tool', { hasText: "Export processed ZIP" }), "queue Export processed ZIP"],
    [page.locator('.queue-tools .queue-tool', { hasText: "Clear processed" }), "queue Clear processed"],
    [page.locator('.queue-tools .queue-tool', { hasText: "Clear failed" }), "queue Clear failed"],
  ];

  const queueBanner = page.locator(".queue-processing-banner").first();
  if (shouldBeLocked) {
    assert(await queueBanner.isVisible(), `Expected queue processing banner during processing.`);
    for (const [locator, name] of controls) {
      const disabled = await locator.isDisabled();
      assert(
        disabled === shouldBeLocked,
        `${name} should be disabled while processing`
      );
    }

    const perItemActionCount = await page.locator(".queue-action").count();
    for (let index = 0; index < perItemActionCount; index += 1) {
      const itemAction = page.locator(".queue-action").nth(index);
      const disabled = await itemAction.isDisabled();
      assert(
        disabled === shouldBeLocked,
        `Per-item queue action should be disabled while processing`
      );
    }
  } else {
    assert(!(await queueBanner.isVisible()), "Queue processing banner should not be visible when idle.");
  }
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

    await page.goto(qaUrl, { waitUntil: "networkidle", timeout: 30000 });
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
    assert(identity.queueTools >= 7, `Expected at least 7 queue tools, got ${identity.queueTools}`);
    assert(identity.rangeFields === 3, `Unexpected range field count: ${identity.rangeFields}`);
    assert(identity.overlayText === 0, "Framework error overlay detected.");
    assert(
      (await page.locator('button', { hasText: "Reset preferences" }).count()) > 0,
      "Reset preferences control missing."
    );

    const defaults = await page.evaluate(() => {
      const namespaced = window.__BACKGROUND_REMOVER_QA__?.uiDefaults;
      return namespaced ?? window.__BACKGROUND_REMOVER_UI_DEFAULTS;
    });
    assert(defaults, "Missing UI defaults export from app.");
    assert(defaults.exportPresetId, "Missing default export preset id.");
    assert(defaults.exportSceneId, "Missing default export scene id.");
    assert(defaults.shadowIntensity === QA_UI_DEFAULTS.shadowIntensity, "Default shadow intensity mismatch.");
    assert(defaults.shadowBlur === QA_UI_DEFAULTS.shadowBlur, "Default shadow blur mismatch.");
    assert(defaults.shadowOffset === QA_UI_DEFAULTS.shadowOffset, "Default shadow offset mismatch.");
    assert(defaults.sliders?.intensity?.min === QA_SHADOW_SLIDERS.intensity.min, "Missing shadow intensity slider min.");
    assert(defaults.sliders?.intensity?.max === QA_SHADOW_SLIDERS.intensity.max, "Missing shadow intensity slider max.");
    assert(defaults.sliders?.blur?.min === QA_SHADOW_SLIDERS.blur.min, "Missing shadow blur slider min.");
    assert(defaults.sliders?.blur?.max === QA_SHADOW_SLIDERS.blur.max, "Missing shadow blur slider max.");
    assert(defaults.sliders?.offset?.min === QA_SHADOW_SLIDERS.offset.min, "Missing shadow offset slider min.");
    assert(defaults.sliders?.offset?.max === QA_SHADOW_SLIDERS.offset.max, "Missing shadow offset slider max.");

    await page.locator('input[type="file"]').setInputFiles(qaInputImages);
    const processButton = page.getByRole("button", { name: "Remove backgrounds" });
    await processButton.click();
    const processingStarted = await waitForProcessingState(page, 5000);
    if (processingStarted) {
      await assertProcessingLocks(page, true);
    }

    await page.locator(".comparison-output").waitFor({ state: "visible", timeout: 180000 });
    await page.locator(".quality-badge").waitFor({
      state: "visible",
      timeout: 10000,
    });
    const processingFinished = await waitForNoProcessingState(page, 30000);
    assert(processingFinished, "Queue processing should finish before continuing.");
    const queueBanner = page.locator(".queue-processing-banner").first();
    if ((await queueBanner.count()) > 0) {
      await queueBanner.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    }
    assert(!(await queueBanner.isVisible()), "Queue processing banner should clear after processing.");

    await page.locator(".preset-card", { hasText: "Marketplace square" }).click();
    await page.locator(".scene-card", { hasText: "Warm sweep" }).click();
    await page.locator(".toggle-row input").check();
    const sliders = page.locator(".range-field input");
    const shadowValues = [
      Math.floor((QA_SHADOW_SLIDERS.intensity.min + QA_SHADOW_SLIDERS.intensity.max) * 0.72),
      Math.floor((QA_SHADOW_SLIDERS.blur.min + QA_SHADOW_SLIDERS.blur.max) * 0.72),
      Math.floor((QA_SHADOW_SLIDERS.offset.min + QA_SHADOW_SLIDERS.offset.max) * 0.72),
    ];

    await sliders.nth(0).fill(String(shadowValues[0]));
    await sliders.nth(1).fill(String(shadowValues[1]));
    await sliders.nth(2).fill(String(shadowValues[2]));

    await page.waitForFunction((maxDimension) => {
      const image = document.querySelector(".comparison-output");
      if (
        !(image instanceof HTMLImageElement) ||
        image.naturalWidth !== maxDimension ||
        image.naturalHeight !== maxDimension
      ) {
        return false;
      }
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return false;
      context.drawImage(image, 0, 0);
      return context.getImageData(12, 12, 1, 1).data[3] === 255;
    }, QA_PREVIEW_MAX_DIMENSION, { timeout: 30000 });

    const previewInfo = await imageInfo(page, ".comparison-output");
    assert(previewInfo.width === QA_PREVIEW_MAX_DIMENSION, `Preview width ${previewInfo.width}`);
    assert(previewInfo.height === QA_PREVIEW_MAX_DIMENSION, `Preview height ${previewInfo.height}`);
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
      zipSuggestedFilename === zipFilename,
      `Unexpected ZIP filename: ${zipSuggestedFilename}`
    );
    await zipDownload.saveAs(zipPath);
    const zipBuffer = fs.readFileSync(zipPath);
    const zip = await JSZip.loadAsync(zipBuffer);
    const entries = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
    const sortedEntries = entries.sort();
    const sortedExpectedZipEntries = expectedZipEntriesWithManifest;
    assert(sortedEntries.length === sortedExpectedZipEntries.length, `Unexpected ZIP entries: ${sortedEntries.join(", ")}`);
    assert(
      sortedEntries.every((entry, index) => entry === sortedExpectedZipEntries[index]),
      `Unexpected ZIP entries: ${sortedEntries.join(", ")}`
    );

    const zippedDimensions = [];
    const imageEntries = sortedEntries.filter((entry) => entry.toLowerCase().endsWith(".png"));
    assert(imageEntries.length === expectedImageZipEntries.length, `Unexpected image count in ZIP: ${sortedEntries.join(", ")}`);
    assert(
      imageEntries.every((entry, index) => entry === expectedImageZipEntries[index]),
      `Unexpected image entries in ZIP: ${imageEntries.join(", ")}`
    );
    for (const entry of imageEntries) {
      const zippedPng = await zip.files[entry].async("nodebuffer");
      const dimensions = pngDimensions(zippedPng);
      assert(dimensions.width === 2000, `Zipped width ${dimensions.width}`);
      assert(dimensions.height === 2000, `Zipped height ${dimensions.height}`);
      zippedDimensions.push(dimensions);
    }

    const manifestText = await zip.files[expectedManifestFilename].async("string");
    const manifestLines = manifestText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    assert(manifestLines[0]?.startsWith("run_id"), "Manifest should include a CSV header.");
    const manifestLineSet = new Set(manifestLines.slice(1));
    assert(manifestLineSet.size === expectedImageZipEntries.length, "Manifest should include one row per image.");
    for (const entry of expectedImageZipEntries) {
      assert(
        manifestLines.some((line) => line.includes(entry)),
        `Manifest missing output file: ${entry}`
      );
    }

    const exportLog = await page.evaluate(() => {
      const raw = window.localStorage.getItem("background-remover-export-log-v1");
      return raw ? JSON.parse(raw) : null;
    });
    assert(Array.isArray(exportLog), "Export log should be present in local storage.");
    assert(exportLog.length > 0, "Expected at least one export log entry.");
    const latestLog = exportLog[0];
    assert(latestLog.zipFile === zipSuggestedFilename, "Latest log entry should match downloaded ZIP filename.");
    assert(Array.isArray(latestLog.items), "Log entry should include exported items.");
    const loggedOutputNames = latestLog.items.map((item) => item.outputFile).sort();
    assert(
      expectedImageZipEntries.every((name) => loggedOutputNames.includes(name)),
      `Log output names should match ZIP output names: ${loggedOutputNames.join(", ")}`
    );

    assert(
      (await page.locator('.export-history-action', { hasText: "Download manifest" }).count()) === 1,
      "Expected exactly one visible per-run manifest download action."
    );
    const historyDownloadPath = path.join(downloadDir, expectedManifestFilename);
    if (fs.existsSync(historyDownloadPath)) fs.rmSync(historyDownloadPath, { force: true });
    const [historyManifestDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 30000 }),
      page.locator('.export-history-action', { hasText: "Download manifest" }).click(),
    ]);
    const manifestFile = historyManifestDownload.suggestedFilename();
    assert(manifestFile === expectedManifestFilename, `Unexpected history manifest filename: ${manifestFile}`);
    await historyManifestDownload.saveAs(historyDownloadPath);
    const manifestFromHistory = fs.readFileSync(historyDownloadPath, "utf8");
    const historyManifestLines = manifestFromHistory
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    assert(historyManifestLines[0]?.startsWith("run_id"), "History manifest should include a CSV header.");
    for (const entry of expectedImageZipEntries) {
      assert(
        historyManifestLines.some((line) => line.includes(entry)),
        `History manifest missing output file: ${entry}`
      );
    }

    await page.screenshot({ path: screenshotPath, fullPage: false });

    const clearExportLogButton = page.locator('.queue-tools .queue-tool', { hasText: "Clear export log" });
    assert(await clearExportLogButton.count() === 1, "Expected clear export log control.");
    let dialogAccepted = false;
    const onDialog = (dialog) => {
      dialogAccepted = true;
      void dialog.accept();
    };
    page.on("dialog", onDialog);
    await clearExportLogButton.click();
    try {
      const clearedLog = await page.waitForFunction(() => {
        const raw = window.localStorage.getItem("background-remover-export-log-v1");
        return raw === "[]";
      }, { timeout: 10000 });
      assert(clearedLog !== null, "Export log should be empty after clear.");
    } finally {
      page.off("dialog", onDialog);
    }
    assert(dialogAccepted, "Expected clear export log confirmation dialog.");
    assert(
      (await page.locator(".export-history-empty").count()) === 1,
      "Export history empty state should be visible after clear."
    );
    assert(
      (await page.locator('.export-history-action', { hasText: "Download manifest" }).count()) === 0,
      "Manifest action buttons should disappear after clearing export log."
    );

    await page.locator('button', { hasText: "Reset preferences" }).click();
    await assertSelectedCardHasId(page, ".preset-card", `data-preset-id=${defaults.exportPresetId}`, 30000);
    await assertSelectedCardHasId(page, ".scene-card", `data-scene-id=${defaults.exportSceneId}`, 30000);
    const shadowInput = page.locator(".toggle-row input");
    const shadowChecked = await shadowInput.isChecked();
    const shadowDisabled = await shadowInput.isDisabled();
    const firstSlider = page.locator(".range-field input").nth(0);
    const secondSlider = page.locator(".range-field input").nth(1);
    const thirdSlider = page.locator(".range-field input").nth(2);
    assert(await firstSlider.isDisabled(), "Shadow controls should be disabled for transparent scene after reset.");
    assert(await secondSlider.isDisabled(), "Shadow blur should be disabled for transparent scene after reset.");
    assert(await thirdSlider.isDisabled(), "Shadow offset should be disabled for transparent scene after reset.");
    assert((await firstSlider.inputValue()) === String(defaults.shadowIntensity), "Shadow strength should reset to default.");
    assert((await secondSlider.inputValue()) === String(defaults.shadowBlur), "Shadow blur should reset to default.");
    assert((await thirdSlider.inputValue()) === String(defaults.shadowOffset), "Shadow offset should reset to default.");
    assert(!shadowChecked, "Reset preferences should disable and clear product shadow.");
    assert(shadowDisabled, "Shadow control should be disabled for transparent scene after reset.");

    const relevantErrors = errors.filter((text) => !text.includes("favicon"));
    assert(relevantErrors.length === 0, `Console errors: ${relevantErrors.join(" | ")}`);
    assert(failedRequests.length === 0, `Failed requests: ${JSON.stringify(failedRequests)}`);

    console.log(JSON.stringify({
      ok: true,
      url: qaUrl,
      inputImage,
      identity,
      previewInfo,
      selectedDimensions,
      selectedSize: selectedBuffer.length,
      manifestFilename: expectedManifestFilename,
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

async function assertSelectedCardHasId(page, selector, attributeSelector, timeout = 10000) {
  const found = await page.waitForFunction(
    (args) => {
      const [selector, attributeSelector] = args;
      const cards = Array.from(document.querySelectorAll(selector));

      return cards.some(
        (card) =>
          card instanceof HTMLElement &&
          card.classList.contains("selected") &&
          card.matches(`[${attributeSelector}]`)
      );
    },
    [selector, attributeSelector],
    { timeout }
  );
  assert(found !== null, `Expected selected ${selector} with selector [${attributeSelector}].`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
