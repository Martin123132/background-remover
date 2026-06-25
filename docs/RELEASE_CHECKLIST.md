# Release Checklist

Use this before tagging, publishing a GitHub release, or announcing a public demo.

## Required checks

- `npm.cmd run fixtures:generate`
- `npm.cmd run capture:demo`
- `npm.cmd run capture:preset-gallery`
- `npm.cmd run check:docs-assets`
- `npm.cmd run build:github-pages`
- `npm.cmd run check`
- `npm.cmd run qa`

## Public surface

- README demo image uses only repo-safe fixtures.
- Preset gallery images are regenerated from repo-safe fixtures.
- GitHub Pages deployment workflow passes.
- Live demo opens at `https://martin123132.github.io/background-remover/`.
- Live demo can fetch model assets under `/background-remover/models/background-removal/`.
- App footer, README, `LICENSE`, `NOTICE.md`, and `COMMERCIAL-LICENSE.md` keep the PolyForm Noncommercial posture.
- Commercial licensing and enquiries point to Glyn at `glyn@twohandsnetwork.co.uk`.

## Storage and artifacts

- Project work stays under `D:\open-source\background-remover`.
- No durable project outputs are written to `C:`.
- `dist/`, `.tmp/`, `.cache/`, `outputs/`, `node_modules/`, and downloaded model blobs are not committed.
- QA artifacts stay under `D:\open-source\background-remover\.tmp\qa-preview-export`.

## GitHub

- Latest `CI` workflow passes on `master`.
- Latest `Deploy GitHub Pages` workflow passes on `master`.
- Repo visibility, branch protection, secrets, and permissions are unchanged unless explicitly approved.
- No release tag is created until the release version and notes are approved.
