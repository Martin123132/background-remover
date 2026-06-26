# Known Limitations

Background Remover is local-first and browser-based, so a few constraints are expected.

## Live demo performance

The GitHub Pages demo is not cross-origin isolated, so ONNX Runtime falls back to single-threaded WebAssembly there. Background removal still works, but processing can be slower than a local deployment with cross-origin isolation headers.

## First run model load

The first background-removal run downloads model and WASM assets from the deployed site into the browser cache. The first run is slower than later runs.

## Large images

Very large images can take longer and may use significant browser memory. If processing fails, try a smaller source image or use the Quality model on a machine with more available memory.

## Edge refinement

The app includes mask and edge review overlays, but it does not yet include manual brush-based mask editing. Fine hair, glass, motion blur, and low-contrast product edges can still need a second pass in another editor.

## Browser support

Modern Chromium-family browsers are the best-tested path. GPU mode is experimental and automatically falls back to CPU when the output is unusable.
