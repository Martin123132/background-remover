import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const contractPath = path.join(projectRoot, "scripts", "qa-contract.json");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

export const QA_QUERY_PARAM_KEY = contract.qa.queryParamKey;
export const QA_QUERY_PARAM_VALUE = contract.qa.queryParamValue;
export const QA_SETTINGS_STORAGE_KEY = contract.ui.settingsStorageKey;
export const QA_UI_DEFAULTS = contract.ui.defaults;
export const QA_SHADOW_SLIDERS = contract.ui.sliders;
export const QA_PREVIEW_MAX_DIMENSION = contract.preview.maxDimension;
export const QA_PREVIEW_RENDER_DEBOUNCE_MS = contract.preview.renderDebounceMs;
export const QA_PREVIEW_ZOOM = contract.preview.zoom;
