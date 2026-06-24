import rawContract from "../../scripts/qa-contract.json";

type SliderValue = {
  min: number;
  max: number;
  default: number;
  step?: number;
};

export interface QAContract {
  qa: {
    queryParamKey: string;
    queryParamValue: string;
  };
  ui: {
    settingsStorageKey: string;
    defaults: {
      mode: "balanced" | "fast" | "quality" | "mask";
      executionDevice: "cpu" | "gpu";
      background: "checker" | "white" | "black" | "brand" | "custom";
      customBackground: string;
      exportPresetId: "transparent" | "marketplace" | "avatar" | "thumbnail";
      exportSceneId: "transparent" | "white" | "warm" | "cool" | "graphite";
      exportShadow: boolean;
      shadowIntensity: number;
      shadowBlur: number;
      shadowOffset: number;
    };
    sliders: {
      intensity: SliderValue;
      blur: SliderValue;
      offset: SliderValue;
    };
  };
  preview: {
    maxDimension: number;
    renderDebounceMs: number;
    zoom: SliderValue;
  };
}

export const QA_CONTRACT = rawContract as QAContract;

export const QA_QUERY_PARAM_KEY = QA_CONTRACT.qa.queryParamKey;
export const QA_QUERY_PARAM_VALUE = QA_CONTRACT.qa.queryParamValue;
export const QA_SETTINGS_STORAGE_KEY = QA_CONTRACT.ui.settingsStorageKey;
export const QA_UI_DEFAULTS = QA_CONTRACT.ui.defaults;
export const QA_PREVIEW_MAX_DIMENSION = QA_CONTRACT.preview.maxDimension;
export const QA_PREVIEW_RENDER_DEBOUNCE_MS = QA_CONTRACT.preview.renderDebounceMs;
export const QA_PREVIEW_ZOOM = QA_CONTRACT.preview.zoom;
export const QA_SHADOW_SLIDERS = QA_CONTRACT.ui.sliders;
