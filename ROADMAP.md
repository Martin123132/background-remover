# Roadmap

This roadmap favors local-first workflows that can replace credit-based background removal subscriptions without uploading source images.

## Now

- Keep CI, contributor docs, and security posture healthy.
- Preserve the D-drive storage rule for local development and QA artifacts.
- Keep batch processing easy to trust with clear queue state and export feedback.
- Keep zoom, pan, mask, and edge preview review practical for edge-quality checks before export.
- Keep the GitHub Pages demo, public sample image, and demo captures reproducible from safe repo fixtures.
- Keep the live demo covered by `npm.cmd run qa:live` before release announcements.

## Next

- Keep release notes and changelog aligned before future tags.
- Do a focused manual browser pass across current Chromium, Edge, and Firefox.
- Add more marketplace and creator preset packs based on real repeated workflows.

## Later

- Add optional local desktop packaging.
- Add platform-specific preset packs once the generic presets are stable.
- Add mask-editing affordances for edge cleanup.
- Add performance profiling for very large images and long queues.

## Non-goals

- No credit-based hosted processing.
- No default source-image upload path.
- No generated assets that require proprietary cloud access to reproduce the app.
