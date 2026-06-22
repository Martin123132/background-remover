# Background Remover

An AGPL local-first background remover aimed at replacing credit-based background removal subscriptions for everyday product, creator, and marketplace workflows.

## Storage rule

This repo is intentionally rooted on `D:\open-source\background-remover`. The PowerShell scripts set npm, temp, and model cache paths inside this repo so development artifacts do not spill onto `C:`.

For first-run setup and local development, use the PowerShell wrappers instead of calling npm directly. They keep npm, temp, and model caches under this repository:

```powershell
cd D:\open-source\background-remover
.\scripts\bootstrap.ps1
.\scripts\dev.ps1
```

After bootstrap, package scripts are available for repeatable checks:

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run check
```

`npm.cmd run check` runs lint followed by the production build. There is no separate unit-test suite yet; the browser regression check below is the current end-to-end QA path.

## MVP

- Runs background removal in the browser.
- Uses self-hosted model/WASM assets from `public/models/background-removal`.
- Does not upload source images to a server.
- Exports transparent PNGs with no watermark.

## Testing

Run the preview/export regression check with:

```powershell
cd D:\open-source\background-remover
npm.cmd run qa:preview-export
```

The command starts the local Vite app on `http://127.0.0.1:5175/` when one is not already running, uploads the existing fixture image, applies the marketplace export preset with a product-photo background and shadow, then verifies two things:

- The live composed preview stays capped at `900x900` so slider changes do not repeatedly render full-size output.
- The selected PNG export and ZIP export remain full preset quality at `2000x2000`.

QA artifacts are written under `D:\open-source\background-remover\.tmp\qa-preview-export\`, including:

- `preview-performance-result.png`
- `download-marketplace-2000.png`
- `background-remover-marketplace-2000.zip`

Server logs for a QA-started dev server are written to:

- `D:\open-source\background-remover\.tmp\qa-preview-export-server.log`
- `D:\open-source\background-remover\.tmp\qa-preview-export-server.err.log`

Supported overrides:

- `BACKGROUND_REMOVER_QA_URL`: run against a different local app URL.
- `BACKGROUND_REMOVER_TEST_IMAGE`: use a different local fixture image.
- `BROWSER_EXECUTABLE_PATH`: use a different Chromium-family browser executable.
- `PLAYWRIGHT_MODULE_PATH`: use a different local Playwright module path.

Clean QA artifacts with:

```powershell
npm.cmd run clean:qa-artifacts
```

Generated folders and build outputs are intentionally ignored by Git: `.cache/`, `.tmp/`, `dist/`, `outputs/`, `node_modules/`, and downloaded files under `public/models/background-removal/`.

## License

AGPL-3.0-or-later. See `LICENSE`; hosted modified versions should publish their corresponding source code.
