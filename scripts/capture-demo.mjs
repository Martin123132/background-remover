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
  path.join(projectRoot, "test-fixtures", "safe-product-mug.png");
const screenshotPath =
  process.env.BACKGROUND_REMOVER_DEMO_SCREENSHOT ||
  path.join(projectRoot, "docs", "assets", "background-remover-demo.png");
const rawUrl = process.env.BACKGROUND_REMOVER_QA_URL || "http://127.0.0.1:5175/";
const selectedPreset = process.env.BACKGROUND_REMOVER_DEMO_PRESET || "Marketplace square";
const selectedScene = process.env.BACKGROUND_REMOVER_DEMO_SCENE || "Warm sweep";
const enableShadow = process.env.BACKGROUND_REMOVER_DEMO_SHADOW === "false" ? false : true;
const shadowStrength = Number(process.env.BACKGROUND_REMOVER_DEMO_SHADOW_STRENGTH || String(QA_UI_DEFAULTS.shadowIntensity));
const shadowBlur = Number(process.env.BACKGROUND_REMOVER_DEMO_SHADOW_BLUR || String(QA_UI_DEFAULTS.shadowBlur));
const shadowOffset = Number(process.env.BACKGROUND_REMOVER_DEMO_SHADOW_OFFSET || String(QA_UI_DEFAULTS.shadowOffset));

const demoUrl = (() => {
  const parsed = new URL(rawUrl);
  parsed.searchParams.set(QA_QUERY_PARAM_KEY, QA_QUERY_PARAM_VALUE);
  return parsed.toString();
})();

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

async function choosePreset(page, presetLabel, fallback) {
  const chosen = page.locator(".preset-card", { hasText: presetLabel });
  if ((await chosen.count()) > 0) {
    await chosen.first().click();
    return;
  }

  const fallbackPreset = page.locator(".preset-card", { hasText: fallback });
  await fallbackPreset.first().click();
}

async function chooseScene(page, sceneLabel, fallback) {
  const chosen = page.locator(".scene-card", { hasText: sceneLabel });
  if ((await chosen.count()) > 0) {
    await chosen.first().click();
    return;
  }

  const fallbackScene = page.locator(".scene-card", { hasText: fallback });
  await fallbackScene.first().click();
}

async function main() {
  assert(projectRoot.startsWith("D:\\"), `Project root must be on D:. Current root: ${projectRoot}`);
  assert(fs.existsSync(inputImage), `Missing demo fixture: ${inputImage}`);
  if (browserExecutablePath) {
    assert(fs.existsSync(browserExecutablePath), `Browser executable not found: ${browserExecutablePath}`);
  }

  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

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

    await page.locator('input[type="file"]').setInputFiles(inputImage);
    await page.locator(".source-only").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(() => {
      const image = document.querySelector(".source-only");
      return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
    });

    await choosePreset(page, selectedPreset, "Marketplace square");
    await chooseScene(page, selectedScene, "Warm sweep");
    const shadowToggle = page.locator(".toggle-row input");
    if (enableShadow) {
      await shadowToggle.check();
      await setSliderValueByLabel(
        page,
        "Shadow strength",
        clampNumber(
          shadowStrength,
          QA_SHADOW_SLIDERS.intensity.min,
          QA_SHADOW_SLIDERS.intensity.max,
          QA_UI_DEFAULTS.shadowIntensity
        )
      );
      await setSliderValueByLabel(
        page,
        "Blur",
        clampNumber(
          shadowBlur,
          QA_SHADOW_SLIDERS.blur.min,
          QA_SHADOW_SLIDERS.blur.max,
          QA_UI_DEFAULTS.shadowBlur
        )
      );
      await setSliderValueByLabel(
        page,
        "Offset",
        clampNumber(
          shadowOffset,
          QA_SHADOW_SLIDERS.offset.min,
          QA_SHADOW_SLIDERS.offset.max,
          QA_UI_DEFAULTS.shadowOffset
        )
      );
    } else if (await shadowToggle.isChecked()) {
      await shadowToggle.uncheck();
    }

    await page.locator(".queue-tool", { hasText: "To process" }).click();
    await page.locator(".comparison-output").waitFor({ state: "visible", timeout: 120000 });
    await page.waitForFunction(() => {
      const img = document.querySelector(".comparison-output");
      const rendering = document.querySelector(".preview-rendering");
      return (
        img instanceof HTMLImageElement &&
        img.complete &&
        img.naturalWidth > 0 &&
        !rendering
      );
    });

    const compareSlider = page.locator('input[aria-label="Before and after comparison split"]');
    await compareSlider.evaluate((node) => {
      node.value = "100";
      node.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: screenshotPath, fullPage: false });

    console.log(JSON.stringify({
      ok: true,
      url: demoUrl,
      inputImage,
      screenshotPath,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
