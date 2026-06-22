import { alphamask, removeBackground, type Config } from "@imgly/background-removal";

export type RemovalMode = "balanced" | "fast" | "quality" | "mask";
export type ExecutionDevice = "cpu" | "gpu";

export type RemovalProgress = {
  key: string;
  current: number;
  total: number;
};

export type OutputStats = {
  alphaPixels: number;
  opaquePixels: number;
  totalPixels: number;
};

export type RemovalResult = {
  blob: Blob;
  stats: OutputStats;
  qualityScore: number;
  deviceUsed: ExecutionDevice;
  fallbackReason?: string;
};

type RemovalOptions = {
  device: ExecutionDevice;
  onProgress?: (progress: RemovalProgress) => void;
};

const configuredAssetPath = import.meta.env.VITE_BG_ASSET_PATH ?? "/models/background-removal/";

function getAssetPath(): string {
  return new URL(configuredAssetPath, window.location.href).href;
}

const modelByMode: Record<RemovalMode, Config["model"]> = {
  balanced: "isnet_fp16",
  fast: "isnet_quint8",
  quality: "isnet",
  mask: "isnet_fp16",
};

export async function removeImageBackground(
  file: File,
  mode: RemovalMode,
  options: RemovalOptions
): Promise<RemovalResult> {
  const { device, onProgress } = options;
  const config: Config = {
    publicPath: getAssetPath(),
    device,
    model: modelByMode[mode],
    progress: (key, current, total) => {
      onProgress?.({ key, current, total });
    },
    output: {
      format: "image/png",
      quality: 1,
    },
  };

  if (device === "gpu") {
    try {
      return await runValidatedRemoval(file, mode, config, "gpu", onProgress);
    } catch (error) {
      const cpuConfig: Config = { ...config, device: "cpu" };
      const result = await runValidatedRemoval(file, mode, cpuConfig, "cpu", onProgress);

      return {
        ...result,
        fallbackReason:
          error instanceof Error ? error.message : "GPU processing returned an unusable cutout.",
      };
    }
  }

  return runValidatedRemoval(file, mode, config, "cpu", onProgress);
}

function runRemoval(file: File, mode: RemovalMode, config: Config): Promise<Blob> {
  return mode === "mask" ? alphamask(file, config) : removeBackground(file, config);
}

async function runValidatedRemoval(
  file: File,
  mode: RemovalMode,
  config: Config,
  deviceUsed: ExecutionDevice,
  onProgress?: (progress: RemovalProgress) => void
): Promise<RemovalResult> {
  const blob = await runRemoval(file, mode, config);

  onProgress?.({ key: "validate:inspect", current: 1, total: 1 });
  const stats = await inspectOutput(blob);
  const qualityScore = scoreOutput(stats);

  if (!hasUsableForeground(stats)) {
    throw new Error(
      "The model produced an unusable cutout. Try the Quality model or a larger source image."
    );
  }

  return {
    blob,
    stats,
    qualityScore,
    deviceUsed,
  };
}

async function inspectOutput(blob: Blob): Promise<OutputStats> {
  const bitmap = await createImageBitmap(blob);

  try {
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(bitmap.width, bitmap.height)
        : document.createElement("canvas");

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d", { willReadFrequently: true }) as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!context) {
      throw new Error("Could not inspect the generated cutout.");
    }

    context.drawImage(bitmap, 0, 0);

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let alphaPixels = 0;
    let opaquePixels = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3];
      if (alpha > 8) alphaPixels += 1;
      if (alpha > 160) opaquePixels += 1;
    }

    return {
      alphaPixels,
      opaquePixels,
      totalPixels: bitmap.width * bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}

function hasUsableForeground(stats: OutputStats): boolean {
  const alphaRatio = stats.alphaPixels / stats.totalPixels;
  const opaqueRatio = stats.opaquePixels / stats.totalPixels;

  return alphaRatio >= 0.04 && opaqueRatio >= 0.015;
}

function scoreOutput(stats: OutputStats): number {
  const alphaRatio = stats.alphaPixels / stats.totalPixels;
  const opaqueRatio = stats.opaquePixels / stats.totalPixels;
  const score = alphaRatio * 85 + opaqueRatio * 95;

  return Math.max(1, Math.min(100, Math.round(score)));
}
