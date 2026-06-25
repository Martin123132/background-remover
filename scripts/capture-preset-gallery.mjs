/* global HTMLImageElement, document, process */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import {
  QA_QUERY_PARAM_KEY,
  QA_QUERY_PARAM_VALUE,
  QA_SHADOW_SLIDERS,
  QA_UI_DEFAULTS,
} from "./qa-contract.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const browserExecutablePath = process.env.BROWSER_EXECUTABLE_PATH;
const inputImage =
  process.env.BACKGROUND_REMOVER_TEST_IMAGE ||
  path.join(projectRoot, "test-fixtures", "safe-studio-product.png");
const outputDir = path.join(projectRoot, "docs", "assets");
const rawUrl = process.env.BACKGROUND_REMOVER_QA_URL || "http://127.0.0.1:5175/";
const demoUrl = (() => {
  const parsed = new URL(rawUrl);
  parsed.searchParams.set(QA_QUERY_PARAM_KEY, QA_QUERY_PARAM_VALUE);
  return parsed.toString();
})();

const captures = [
  {
    file: "preset-transparent-png.png",
    preset: "Transparent PNG",
    scene: "Cutout",
    shadow: false,
  },
  {
    file: "preset-marketplace-square.png",
    preset: "Marketplace square",
    scene: "Warm sweep",
    shadow: true,
  },
  {
    file: "preset-listing-square.png",
    preset: "Listing square",
    scene: "Studio white",
    shadow: true,
    shadowStrength: 45,
    shadowBlur: 30,
    shadowOffset: 20,
  },
  {
    file: "preset-storefront-card.png",
    preset: "Storefront card",
    scene: "Cool grey",
    shadow: true,
    shadowStrength: 50,
    shadowBlur: 34,
    shadowOffset: 24,
  },
  {
    file: "preset-social-avatar.png",
    preset: "Social avatar",
    scene: "Cool grey",
    shadow: true,
    shadowStrength: 55,
    shadowBlur: 32,
    shadowOffset: 22,
  },
  {
    file: "preset-video-thumbnail.png",
    preset: "Video thumbnail",
    scene: "Graphite",
    shadow: true,
    shadowStrength: 58,
    shadowBlur: 36,
    shadowOffset: 26,
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

async function setSliderValueByLabel(page, label, value) {
  const slider = page.locator(".range-field", { hasText: label }).locator('input[type="range"]');
  await slider.scrollIntoViewIfNeeded();
  await slider.evaluate((node, next) => {
    node.value = String(next);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function chooseCard(page, selector, label) {
  const chosen = page.locator(selector, { hasText: label });
  const count = await chosen.count();
  assert(count > 0, `Missing ${label} card.`);
  await chosen.first().click();
}

async function waitForPreview(page, previousSrc) {
  await page.locator(".comparison-output").waitFor({ state: "visible", timeout: 120000 });
  await page.waitForFunction((oldSrc) => {
    const img = document.querySelector(".comparison-output");
    const rendering = document.querySelector(".preview-rendering");
    return (
      img instanceof HTMLImageElement &&
      img.complete &&
      img.naturalWidth > 0 &&
      !rendering &&
      (!oldSrc || img.currentSrc !== oldSrc)
    );
  }, previousSrc ?? null);
}

async function applyCaptureState(page, capture) {
  const previousSrc = await page.locator(".comparison-output").evaluate((node) => {
    return node instanceof HTMLImageElement ? node.currentSrc : "";
  }).catch(() => "");

  await chooseCard(page, ".preset-card", capture.preset);
  await chooseCard(page, ".scene-card", capture.scene);

  const shadowToggle = page.locator(".toggle-row input");
  if (capture.shadow) {
    await shadowToggle.check();
    await setSliderValueByLabel(
      page,
      "Shadow strength",
      clampNumber(
        capture.shadowStrength ?? QA_UI_DEFAULTS.shadowIntensity,
        QA_SHADOW_SLIDERS.intensity.min,
        QA_SHADOW_SLIDERS.intensity.max,
        QA_UI_DEFAULTS.shadowIntensity
      )
    );
    await setSliderValueByLabel(
      page,
      "Blur",
      clampNumber(
        capture.shadowBlur ?? QA_UI_DEFAULTS.shadowBlur,
        QA_SHADOW_SLIDERS.blur.min,
        QA_SHADOW_SLIDERS.blur.max,
        QA_UI_DEFAULTS.shadowBlur
      )
    );
    await setSliderValueByLabel(
      page,
      "Offset",
      clampNumber(
        capture.shadowOffset ?? QA_UI_DEFAULTS.shadowOffset,
        QA_SHADOW_SLIDERS.offset.min,
        QA_SHADOW_SLIDERS.offset.max,
        QA_UI_DEFAULTS.shadowOffset
      )
    );
  } else if (!(await shadowToggle.isDisabled()) && (await shadowToggle.isChecked())) {
    await shadowToggle.uncheck();
  }

  const expectsNewPreview = capture.preset !== "Transparent PNG" || capture.scene !== "Cutout";
  await waitForPreview(page, expectsNewPreview ? previousSrc : null);
}

async function main() {
  assert(projectRoot.startsWith("D:\\"), `Project root must be on D:. Current root: ${projectRoot}`);
  assert(fs.existsSync(inputImage), `Missing demo fixture: ${inputImage}`);
  if (browserExecutablePath) {
    assert(fs.existsSync(browserExecutablePath), `Browser executable not found: ${browserExecutablePath}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({
    ...(browserExecutablePath ? { executablePath: browserExecutablePath } : { channel: "msedge" }),
    headless: true,
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });

    await page.goto(demoUrl, { waitUntil: "networkidle", timeout: 30000 });
    assert((await page.title()) === "Background Remover", "Unexpected app title.");
    await page.addStyleTag({
      content: ".comparison-handle { display: none !important; }",
    });

    await page.locator('input[type="file"]').setInputFiles(inputImage);
    await page.locator(".source-only").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(() => {
      const image = document.querySelector(".source-only");
      return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
    });

    await page.locator(".queue-tool", { hasText: "Process queue" }).click();
    await waitForPreview(page);

    await page.locator(".comparison-quick-button", { hasText: "Cutout" }).click();

    const artifacts = [];
    for (const capture of captures) {
      await applyCaptureState(page, capture);
      await page.evaluate(() => window.scrollTo(0, 0));
      const screenshotPath = path.join(outputDir, capture.file);
      await page.locator(".comparison-output").screenshot({ path: screenshotPath });
      artifacts.push(screenshotPath);
    }

    console.log(JSON.stringify({
      ok: true,
      url: demoUrl,
      inputImage,
      artifacts,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
