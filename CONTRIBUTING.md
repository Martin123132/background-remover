# Contributing

Thanks for helping make background removal boringly free.

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
npm.cmd run lint
npm.cmd run build
```

For browser-level export coverage, run:

```powershell
npm.cmd run qa:preview-export
```

The QA command writes artifacts under `D:\open-source\background-remover\.tmp\qa-preview-export\`. Clean them with:

```powershell
npm.cmd run clean:qa-artifacts
```

## Contribution guidelines

- Keep source images local; do not add upload-based workflows.
- Keep generated files, caches, screenshots, model blobs, and temporary exports out of Git.
- Preserve the AGPL-3.0-or-later license posture.
- Prefer small pull requests with one clear product or maintenance improvement.
- Include notes about manual QA when touching image processing, export presets, or browser interactions.

## Issue reports

Useful bug reports include:

- Browser and operating system.
- Input image type and rough dimensions.
- The selected model, background mode, export preset, and shadow settings.
- Whether `npm.cmd run qa:preview-export` passes locally.
