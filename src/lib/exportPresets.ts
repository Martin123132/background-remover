export type ExportPresetId = "transparent" | "marketplace" | "avatar" | "thumbnail";
export type ExportSceneId = "transparent" | "white" | "warm" | "cool" | "graphite";

export type ExportPreset = {
  id: ExportPresetId;
  label: string;
  detail: string;
  suffix: string;
  width?: number;
  height?: number;
  background?: string;
  paddingRatio?: number;
};

export type ExportScene = {
  id: ExportSceneId;
  label: string;
  detail: string;
  preview: string;
};

export type ExportComposition = {
  sceneId: ExportSceneId;
  shadow: boolean;
  shadowIntensity: number;
  shadowBlur: number;
  shadowOffset: number;
};

export type ReviewOverlayMode = "mask" | "edge";

export type RenderExportOptions = {
  maxDimension?: number;
};

export const exportPresets: ExportPreset[] = [
  {
    id: "transparent",
    label: "Transparent PNG",
    detail: "Original size cutout for editors and design tools.",
    suffix: "cutout",
  },
  {
    id: "marketplace",
    label: "Marketplace square",
    detail: "2000 x 2000 white canvas for shops and catalogues.",
    suffix: "marketplace-2000",
    width: 2000,
    height: 2000,
    background: "#ffffff",
    paddingRatio: 0.1,
  },
  {
    id: "avatar",
    label: "Social avatar",
    detail: "1080 x 1080 soft background for profile images.",
    suffix: "avatar-1080",
    width: 1080,
    height: 1080,
    background: "#f4f1ec",
    paddingRatio: 0.06,
  },
  {
    id: "thumbnail",
    label: "Video thumbnail",
    detail: "1280 x 720 warm canvas for channel thumbnails.",
    suffix: "thumbnail-1280x720",
    width: 1280,
    height: 720,
    background: "#f7eee2",
    paddingRatio: 0.08,
  },
];

export const exportScenes: ExportScene[] = [
  {
    id: "transparent",
    label: "Cutout",
    detail: "Keep the background transparent.",
    preview: "checker",
  },
  {
    id: "white",
    label: "Studio white",
    detail: "Clean white product canvas.",
    preview: "#ffffff",
  },
  {
    id: "warm",
    label: "Warm sweep",
    detail: "Soft catalogue backdrop.",
    preview: "linear-gradient(145deg, #fff7ed, #ead8c3)",
  },
  {
    id: "cool",
    label: "Cool grey",
    detail: "Neutral tech-store backdrop.",
    preview: "linear-gradient(145deg, #f8fafc, #dbe7e6)",
  },
  {
    id: "graphite",
    label: "Graphite",
    detail: "Dark premium product stage.",
    preview: "linear-gradient(145deg, #303238, #111317)",
  },
];

export function getExportPreset(id: ExportPresetId): ExportPreset {
  return exportPresets.find((preset) => preset.id === id) ?? exportPresets[0];
}

export function getExportScene(id: ExportSceneId): ExportScene {
  return exportScenes.find((scene) => scene.id === id) ?? exportScenes[0];
}

function exportRenderGeometry(bitmap: ImageBitmap, preset: ExportPreset, options: RenderExportOptions) {
  const baseWidth = preset.width ?? bitmap.width;
  const baseHeight = preset.height ?? bitmap.height;
  const previewScale = options.maxDimension
    ? Math.min(1, options.maxDimension / Math.max(baseWidth, baseHeight))
    : 1;
  const canvasWidth = Math.max(1, Math.round(baseWidth * previewScale));
  const canvasHeight = Math.max(1, Math.round(baseHeight * previewScale));
  const padding = Math.round(Math.min(canvasWidth, canvasHeight) * (preset.paddingRatio ?? 0));
  const availableWidth = canvasWidth - padding * 2;
  const availableHeight = canvasHeight - padding * 2;
  const scale = Math.min(availableWidth / bitmap.width, availableHeight / bitmap.height);
  const drawWidth = Math.round(bitmap.width * scale);
  const drawHeight = Math.round(bitmap.height * scale);

  return {
    canvasHeight,
    canvasWidth,
    drawHeight,
    drawWidth,
    previewScale,
    x: Math.round((canvasWidth - drawWidth) / 2),
    y: Math.round((canvasHeight - drawHeight) / 2),
  };
}

export async function renderExportPreset(
  blob: Blob,
  preset: ExportPreset,
  composition: ExportComposition = {
    sceneId: "transparent",
    shadow: false,
    shadowIntensity: 45,
    shadowBlur: 28,
    shadowOffset: 24,
  },
  options: RenderExportOptions = {}
): Promise<Blob> {
  if (
    preset.id === "transparent" &&
    composition.sceneId === "transparent" &&
    !composition.shadow &&
    !options.maxDimension
  ) {
    return blob;
  }

  const bitmap = await createImageBitmap(blob);

  try {
    const geometry = exportRenderGeometry(bitmap, preset, options);
    const canvas = document.createElement("canvas");
    canvas.width = geometry.canvasWidth;
    canvas.height = geometry.canvasHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not render export preset.");
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    paintScene(context, canvas.width, canvas.height, composition.sceneId, preset.background);

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    if (composition.shadow && composition.sceneId !== "transparent") {
      paintShadow(
        context,
        bitmap,
        geometry.x,
        geometry.y,
        geometry.drawWidth,
        geometry.drawHeight,
        composition,
        geometry.previewScale
      );
    }
    context.drawImage(bitmap, geometry.x, geometry.y, geometry.drawWidth, geometry.drawHeight);

    const output = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png", 1);
    });

    if (!output) {
      throw new Error("Could not encode export preset.");
    }

    return output;
  } finally {
    bitmap.close();
  }
}

export async function renderExportReviewOverlay(
  blob: Blob,
  preset: ExportPreset,
  mode: ReviewOverlayMode,
  options: RenderExportOptions = {}
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);

  try {
    const geometry = exportRenderGeometry(bitmap, preset, options);
    const canvas = document.createElement("canvas");
    canvas.width = geometry.canvasWidth;
    canvas.height = geometry.canvasHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not render review overlay.");
    }

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = geometry.drawWidth;
    maskCanvas.height = geometry.drawHeight;
    const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
    if (!maskContext) {
      throw new Error("Could not render review mask.");
    }

    maskContext.drawImage(bitmap, 0, 0, geometry.drawWidth, geometry.drawHeight);
    const source = maskContext.getImageData(0, 0, geometry.drawWidth, geometry.drawHeight);
    const overlay = maskContext.createImageData(geometry.drawWidth, geometry.drawHeight);
    paintReviewOverlayPixels(source, overlay, mode, geometry.drawWidth, geometry.drawHeight);
    maskContext.putImageData(overlay, 0, 0);
    context.drawImage(maskCanvas, geometry.x, geometry.y);

    const output = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png", 1);
    });

    if (!output) {
      throw new Error("Could not encode review overlay.");
    }

    return output;
  } finally {
    bitmap.close();
  }
}

function paintScene(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sceneId: ExportSceneId,
  fallbackBackground?: string
) {
  if (sceneId === "transparent") return;

  if (sceneId === "white") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    return;
  }

  if (sceneId === "graphite") {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#303238");
    gradient.addColorStop(0.58, "#191b1f");
    gradient.addColorStop(1, "#101115");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    paintFloorGlow(context, width, height, "rgba(255,255,255,0.16)");
    return;
  }

  if (sceneId === "cool") {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#fbfdff");
    gradient.addColorStop(0.62, "#e6eeee");
    gradient.addColorStop(1, "#d7e2e0");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    paintFloorGlow(context, width, height, "rgba(30,109,112,0.18)");
    return;
  }

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, fallbackBackground ?? "#fff7ed");
  gradient.addColorStop(0.6, "#f1dfcb");
  gradient.addColorStop(1, "#e4c8ad");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  paintFloorGlow(context, width, height, "rgba(216,81,54,0.18)");
}

function paintFloorGlow(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string
) {
  const glow = context.createRadialGradient(
    width / 2,
    height * 0.82,
    0,
    width / 2,
    height * 0.82,
    Math.max(width, height) * 0.45
  );
  glow.addColorStop(0, color);
  glow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
}

function paintShadow(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  x: number,
  y: number,
  width: number,
  height: number,
  composition: ExportComposition,
  renderScale = 1
) {
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = width;
  shadowCanvas.height = height;
  const shadowContext = shadowCanvas.getContext("2d");
  if (!shadowContext) return;

  shadowContext.drawImage(bitmap, 0, 0, width, height);
  shadowContext.globalCompositeOperation = "source-in";
  shadowContext.fillStyle = "#000000";
  shadowContext.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = Math.min(0.55, Math.max(0.06, composition.shadowIntensity / 130));
  context.filter = `blur(${Math.max(1, Math.round(composition.shadowBlur * renderScale))}px)`;
  context.drawImage(
    shadowCanvas,
    x,
    y + Math.round(composition.shadowOffset * renderScale),
    width,
    height
  );
  context.restore();
}

function alphaAt(data: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  return data[(y * width + x) * 4 + 3];
}

function paintReviewOverlayPixels(
  source: ImageData,
  overlay: ImageData,
  mode: ReviewOverlayMode,
  width: number,
  height: number
) {
  const input = source.data;
  const output = overlay.data;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = input[index + 3];

      if (mode === "mask") {
        if (alpha > 4) {
          output[index] = 216;
          output[index + 1] = 81;
          output[index + 2] = 54;
          output[index + 3] = Math.max(48, Math.round(alpha * 0.48));
        }
        continue;
      }

      const left = alphaAt(input, width, height, x - 1, y);
      const right = alphaAt(input, width, height, x + 1, y);
      const top = alphaAt(input, width, height, x, y - 1);
      const bottom = alphaAt(input, width, height, x, y + 1);
      const minNeighbor = Math.min(left, right, top, bottom);
      const maxNeighbor = Math.max(left, right, top, bottom);
      const isEdge =
        alpha > 8 &&
        (alpha < 248 || minNeighbor <= 8 || maxNeighbor - minNeighbor > 72);

      if (isEdge) {
        output[index] = 255;
        output[index + 1] = 221;
        output[index + 2] = 87;
        output[index + 3] = 235;
      }
    }
  }
}
