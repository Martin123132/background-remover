# Draft Release Notes

These notes are a working draft for the next public release. Do not tag, publish, or announce a release until the final version number and notes are approved.

## Background Remover 0.2.0 draft

Background Remover is a local-first, browser-based background remover for personal and non-commercial product, creator, and marketplace workflows. It removes backgrounds, composes product-photo outputs, and exports clean PNG/ZIP results without uploading source images or adding watermarks.

### Highlights

- Live GitHub Pages demo at `https://martin123132.github.io/background-remover/`.
- Repo-safe sample image button so visitors can try the app immediately.
- Product-photo composition scenes with shadows and marketplace-ready export presets.
- Batch queue controls for processing, retrying failed items, clearing processed or failed items, and exporting processed items only.
- ZIP export names include the chosen preset, scene, and processed image count.
- Per-run manifest CSV files and persistent export history with settings restore.
- Review tools for source, split, cutout, mask, edge, zoom, pan, backdrop, fit, and center checks.
- Repeatable local and live QA commands that prove previews stay capped while PNG/ZIP exports remain full preset quality.

### Public demo and assets

The README screenshot, preset gallery, and public sample image are generated from safe repo-local fixtures. No private or personal source images are required for the public demo.

### Validation before release

Run these from `D:\open-source\background-remover`:

```powershell
npm.cmd run fixtures:generate
npm.cmd run capture:demo
npm.cmd run capture:preset-gallery
npm.cmd run check:docs-assets
npm.cmd run build:github-pages
npm.cmd run check
npm.cmd run qa
npm.cmd run qa:live
```

GitHub Actions should also show passing `CI` and `Deploy GitHub Pages` runs on `master`.

### Known limitations

- GitHub Pages does not provide cross-origin isolation headers, so the live demo can fall back to single-threaded WebAssembly.
- Very large images can take longer and may use significant browser memory.
- Manual brush-based mask editing is not included yet.
- Modern Chromium-family browsers are the best-tested path; Firefox and Edge should receive a manual pass before a public announcement.

### Licensing

The project uses the PolyForm Noncommercial 1.0.0 license. Personal and non-commercial use is permitted. Commercial use requires a separate written license from TWO HANDS NETWORK LTD. Commercial licensing, collaboration, information on existing products, and other enquiries should go to Glyn via email at glyn@twohandsnetwork.co.uk.
