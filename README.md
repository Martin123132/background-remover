# Background Remover

[![CI](https://github.com/Martin123132/background-remover/actions/workflows/ci.yml/badge.svg)](https://github.com/Martin123132/background-remover/actions/workflows/ci.yml)

An AGPL local-first background remover aimed at replacing credit-based background removal subscriptions for everyday product, creator, and marketplace workflows.

![Background Remover demo](docs/assets/background-remover-demo.png)

The demo above is a real processed output generated from the repo-local fixture at `test-fixtures/safe-product-mug.png`, with marketplace composition and product shadow enabled. No private images are used.

## What it does

- Removes image backgrounds in the browser.
- Keeps source images local; there is no upload step.
- Exports transparent PNGs with no watermark.
- Adds product-photo backgrounds, marketplace export presets, shadows, and ZIP export.
- Exports completed batch items separately from pending or failed queue items.
- Names ZIP exports with the selected preset and processed image count.
- Remembers export, scene, and shadow preferences across browser reloads, with a top-right reset action.
- Uses self-hosted model/WASM assets from `public/models/background-removal`.

More on presets and composition scenes is in [Export presets and scenes](docs/EXPORT_PRESETS.md).

## Queue workflow

- Add multiple files to the queue at once with the dropzone.
- Use **To process** to remove backgrounds from ready and failed jobs.
- Use **Retry failed** when failures remain after a batch run.
- Filter queue items by status with the filter controls:
  - All
  - Ready
  - Working
  - Done
  - Failed
- Export processed items with **Export processed ZIP**.
- Clear completed/failed workflow noise with **Clear processed** and **Clear failed**.
- Remove individual items from the queue with the per-item remove action.

## Requirements

- Windows PowerShell
- Node.js 18 or newer
- npm
- Git

## Quick start

For first-run setup and local development, use the PowerShell wrappers instead of calling npm directly. They keep npm, temp, and model caches under this repository:

```powershell
cd D:\open-source\background-remover
.\scripts\bootstrap.ps1
.\scripts\dev.ps1
```

Open the local app at:

```text
http://127.0.0.1:5173/
```

If Vite chooses another port because one is busy, use the URL printed in the terminal.

## Common commands

After bootstrap, these package scripts are available:

```powershell
npm.cmd run dev
npm.cmd run lint
npm.cmd run build
npm.cmd run check
npm.cmd run qa
npm.cmd run capture:demo
npm.cmd run clean:qa-artifacts
```

`npm.cmd run check` runs lint followed by the production build. There is no separate unit-test suite yet; the browser regression check below is the current end-to-end QA path documented in [QA.md](docs/QA.md).

## Storage rule

This repo is intentionally rooted on `D:\open-source\background-remover`. The PowerShell scripts set npm, temp, and model cache paths inside this repo so development artifacts do not spill onto `C:`.

Generated folders and build outputs are intentionally ignored by Git: `.cache/`, `.tmp/`, `dist/`, `outputs/`, `node_modules/`, and downloaded files under `public/models/background-removal/`.

See `docs/D_DRIVE_POLICY.md` for the full local storage policy.

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
- `safe-product-mug-marketplace-2000.png`
- `background-remover-marketplace-2000-1-image.zip`

Server logs for a QA-started dev server are written to:

- `D:\open-source\background-remover\.tmp\qa-preview-export-server.log`
- `D:\open-source\background-remover\.tmp\qa-preview-export-server.err.log`

Supported overrides:

- `BACKGROUND_REMOVER_QA_URL`: run against a different local app URL.
- `BACKGROUND_REMOVER_TEST_IMAGE`: use a different local fixture image. By default QA uses `test-fixtures/safe-product-mug.png`.
- `BROWSER_EXECUTABLE_PATH`: use a different Chromium-family browser executable. This path is only used to launch the browser; QA downloads and artifacts still stay under this repo on `D:`.

Clean QA artifacts with:

```powershell
npm.cmd run clean:qa-artifacts
```

Regenerate the README screenshot with:

```powershell
npm.cmd run capture:demo
```

You can use these optional environment overrides to capture a different demo state:

```powershell
$env:BACKGROUND_REMOVER_DEMO_PRESET="Social avatar"
$env:BACKGROUND_REMOVER_DEMO_SCENE="Cool grey"
$env:BACKGROUND_REMOVER_DEMO_SHADOW="true"
$env:BACKGROUND_REMOVER_DEMO_SHADOW_STRENGTH="60"
$env:BACKGROUND_REMOVER_DEMO_SHADOW_BLUR="34"
$env:BACKGROUND_REMOVER_DEMO_SHADOW_OFFSET="24"
```

## Project layout

```text
src/                              React app and image workflow
src/lib/                          Background removal, file, and export helpers
scripts/                          D-drive-safe setup, dev, model, and QA scripts
public/models/background-removal/ Downloaded model and WASM assets, ignored except .gitkeep
```

## Contributing and security

See `CONTRIBUTING.md` for setup, QA, and pull request guidance. See `SECURITY.md` for vulnerability reporting and the project security goals.

See `ROADMAP.md` for planned work and `CHANGELOG.md` for release history.

## License

AGPL-3.0-or-later. See `LICENSE`; hosted modified versions should publish their corresponding source code.
