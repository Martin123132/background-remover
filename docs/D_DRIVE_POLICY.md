# D-Drive Storage Policy

This project is developed from:

```text
D:\open-source\background-remover
```

The local machine has a small system drive, so project files, caches, temporary files, QA artifacts, downloaded model assets, build outputs, and generated exports must stay on `D:`.

## Required local paths

- Project root: `D:\open-source\background-remover`
- npm cache from project scripts: `D:\open-source\background-remover\.cache\npm`
- temp files from project scripts: `D:\open-source\background-remover\.tmp`
- model download cache: `D:\open-source\background-remover\.cache\models`
- QA artifacts: `D:\open-source\background-remover\.tmp\qa-preview-export`
- manual/generated exports: `D:\open-source\background-remover\outputs`

## Guardrails

- Use the PowerShell wrapper scripts for local setup and development.
- Do not add project caches, generated assets, or test artifacts under `C:`.
- Do not hard-code Codex runtime paths, AppData cache paths, or other C-drive storage locations.
- Browser executable paths may point to installed software, but downloads and generated artifacts must stay under the D-drive project paths.
- Keep `.cache/`, `.tmp/`, `dist/`, `outputs/`, `node_modules/`, and downloaded model blobs out of Git.

## Commands

```powershell
cd D:\open-source\background-remover
.\scripts\bootstrap.ps1
.\scripts\dev.ps1
npm.cmd run qa:preview-export
npm.cmd run clean:qa-artifacts
```
