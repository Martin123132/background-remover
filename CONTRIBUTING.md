# Contributing

Thanks for helping make background removal boringly available for personal and non-commercial workflows.

## Local setup

This project is developed from `D:\open-source\background-remover`. Use the PowerShell wrappers for setup and local development because they keep npm, temp, model, and output artifacts under the D-drive project tree.

```powershell
cd D:\open-source\background-remover
.\scripts\bootstrap.ps1
.\scripts\dev.ps1
```

## Before opening a pull request

Run the standard checks:

```powershell
npm.cmd run check
```

For browser-level export coverage, run:

```powershell
npm.cmd run qa:preview-export
```

For deployed GitHub Pages coverage, run:

```powershell
npm.cmd run qa:live
```

The QA command writes artifacts under `D:\open-source\background-remover\.tmp\qa-preview-export\`. Clean them with:

```powershell
npm.cmd run clean:qa-artifacts
```

## Contribution guidelines

- Keep source images local; do not add upload-based workflows.
- Keep generated files, caches, screenshots, model blobs, and temporary exports out of Git.
- Public demo screenshots should use repo-safe fixtures such as `test-fixtures/safe-studio-product.png` or `test-fixtures/safe-product-mug.png`.
- Preserve the PolyForm Noncommercial source-available license posture.
- Keep commercial-use wording pointed to TWO HANDS NETWORK LTD and the public Glyn contact email.
- Prefer small pull requests with one clear product or maintenance improvement.
- Include notes about manual QA when touching image processing, export presets, or browser interactions.
- Run `npm.cmd run build:github-pages` when changing asset paths, model public paths, or static deployment behavior.

## Issue reports

Useful bug reports include:

- Browser and operating system.
- Input image type and rough dimensions.
- The selected model, background mode, export preset, and shadow settings.
- Review overlay, export history action, or static hosting path if relevant.
- Whether `npm.cmd run qa:preview-export` passes locally.
