/* global HTMLImageElement, document, process */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const browserExecutablePath = process.env.BROWSER_EXECUTABLE_PATH;
const inputImage =
  process.env.BACKGROUND_REMOVER_TEST_IMAGE ||
  path.join(projectRoot, "test-fixtures", "safe-product-mug.png");
const screenshotPath =
  process.env.BACKGROUND_REMOVER_DEMO_SCREENSHOT ||
  path.join(projectRoot, "docs", "assets", "background-remover-demo.png");
const url = process.env.BACKGROUND_REMOVER_QA_URL || "http://127.0.0.1:5175/";

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    assert((await page.title()) === "Background Remover", "Unexpected app title.");

    await page.locator('input[type="file"]').setInputFiles(inputImage);
    await page.locator(".source-only").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(() => {
      const image = document.querySelector(".source-only");
      return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
    });

    await page.locator(".preset-card", { hasText: "Marketplace square" }).click();
    await page.locator(".scene-card", { hasText: "Warm sweep" }).click();
    await page.locator(".toggle-row input").check();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: screenshotPath, fullPage: false });

    console.log(JSON.stringify({
      ok: true,
      url,
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
