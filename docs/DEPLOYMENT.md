# Static Deployment

Background Remover can be built as a static app. The app still runs background removal in the browser and still expects model assets to be served from the same deployed site.

## Local production build

```powershell
cd D:\open-source\background-remover
npm.cmd run build
```

The build output is written to:

```text
D:\open-source\background-remover\dist\
```

## GitHub Pages build

For the repository path `https://martin123132.github.io/background-remover/`, build with:

```powershell
npm.cmd run build:github-pages
```

This runs Vite with:

```text
--base=/background-remover/
```

The background-removal model path follows Vite's base path by default, so static hosts under a subdirectory can serve:

```text
/background-remover/models/background-removal/
```

## GitHub Pages deployment

The repository includes `.github/workflows/pages.yml`, which deploys the static app from GitHub Actions when `master` changes or when the workflow is run manually. It:

- installs dependencies with `npm ci`;
- runs `npm run build:github-pages`;
- uploads `dist/` as a Pages artifact;
- deploys through GitHub Pages in workflow mode.

## Custom static host path

For a different subpath, call Vite directly with the right base:

```powershell
npm.cmd run build -- --base=/your-path/
```

If model assets are hosted somewhere else on the same origin, override the asset path:

```powershell
$env:VITE_BG_ASSET_PATH="/your-model-path/"
npm.cmd run build -- --base=/your-path/
```

## Notes

- Do not commit `dist/`; it is generated output.
- Do not commit downloaded model blobs under `public/models/background-removal/`.
- Keep static hosting consistent with the PolyForm Noncommercial public license and required notices.
- Direct commercial licensing, collaboration, information on existing products, and other enquiries to Glyn via email at glyn@twohandsnetwork.co.uk.
- GitHub Pages must be set to GitHub Actions/workflow mode before the static build is publicly served.
