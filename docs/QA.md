# QA and Regression Checks

Background Remover uses a browser-driven regression check for critical behavior that should stay stable as the product evolves.

## Preview/export check

Run:

```powershell
cd D:\open-source\background-remover
npm.cmd run qa
```

This executes:

- `scripts/qa-preview-export.ps1` (PowerShell runner)
- `scripts/qa-preview-export.mjs` (Playwright checks)

Checks performed:

- Verifies app identity and required UI controls exist.
- Loads `test-fixtures/safe-product-mug.png` into the queue.
- Runs background removal.
- Applies the marketplace preset + warm sweep scene + shadow controls.
- Verifies live preview compositing remains capped at `900x900`.
- Verifies selected export PNG is `2000x2000`.
- Verifies ZIP export filename is `background-remover-marketplace-2000-1-image.zip`.
- Verifies ZIP contains only the processed image with the same `2000x2000` dimensions.
- Verifies reset-preference flow restores defaults and disables shadow controls on transparent scene.
- Fails the run on console errors or failed network requests.

Artifacts are written to:

- `D:\open-source\background-remover\.tmp\qa-preview-export\preview-performance-result.png`
- `D:\open-source\background-remover\.tmp\qa-preview-export\safe-product-mug-marketplace-2000.png`
- `D:\open-source\background-remover\.tmp\qa-preview-export\background-remover-marketplace-2000-1-image.zip`

Server logs for QA-run launched dev servers are written to:

- `D:\open-source\background-remover\.tmp\qa-preview-export-server.log`
- `D:\open-source\background-remover\.tmp\qa-preview-export-server.err.log`

## Demo capture

Generate the public README screenshot with:

```powershell
npm.cmd run capture:demo
```

Artifacts go to:

- `D:\open-source\background-remover\docs\assets\background-remover-demo.png`

## Environment overrides

Useful for custom fixtures/scenes or browser setup:

- `BACKGROUND_REMOVER_QA_URL`
- `BACKGROUND_REMOVER_TEST_IMAGE`
- `BROWSER_EXECUTABLE_PATH`
- `BACKGROUND_REMOVER_DEMO_PRESET`
- `BACKGROUND_REMOVER_DEMO_SCENE`
- `BACKGROUND_REMOVER_DEMO_SHADOW`
- `BACKGROUND_REMOVER_DEMO_SHADOW_STRENGTH`
- `BACKGROUND_REMOVER_DEMO_SHADOW_BLUR`
- `BACKGROUND_REMOVER_DEMO_SHADOW_OFFSET`

## Cleanup

Remove generated QA artifacts with:

```powershell
npm.cmd run clean:qa-artifacts
```
