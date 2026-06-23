import {
  AlertCircle,
  Cpu,
  Check,
  Download,
  Eraser,
  FileImage,
  Gauge,
  ListFilter,
  ImageIcon,
  Loader2,
  Lock,
  Package,
  Palette,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { Dropzone } from "./components/Dropzone";
import {
  removeImageBackground,
  type ExecutionDevice,
  type OutputStats,
  type RemovalMode,
  type RemovalProgress,
} from "./lib/backgroundRemoval";
import {
  exportPresets,
  exportScenes,
  getExportPreset,
  renderExportPreset,
  type ExportComposition,
  type ExportPresetId,
  type ExportSceneId,
} from "./lib/exportPresets";
import {
  batchZipFilename,
  downloadBlob,
  downloadZip,
  formatBytes,
  outputFilename,
} from "./lib/files";

type JobStatus = "ready" | "processing" | "done" | "error";
type PreviewBackground = "checker" | "white" | "black" | "brand" | "custom";
type QueueFilter = "all" | JobStatus;

type ImageJob = {
  id: string;
  file: File;
  sourceUrl: string;
  outputUrl?: string;
  outputBlob?: Blob;
  status: JobStatus;
  progress?: RemovalProgress;
  qualityScore?: number;
  stats?: OutputStats;
  deviceUsed?: ExecutionDevice;
  fallbackReason?: string;
  error?: string;
};

const modeLabels: Record<RemovalMode, { label: string; detail: string }> = {
  balanced: {
    label: "Balanced",
    detail: "Default quality for product and people photos.",
  },
  fast: {
    label: "Fast",
    detail: "Smaller model for quick drafts and batches.",
  },
  quality: {
    label: "Quality",
    detail: "Larger model for cleaner edges when time matters less.",
  },
  mask: {
    label: "Mask",
    detail: "Export the alpha mask for advanced editing.",
  },
};

const PREVIEW_MAX_DIMENSION = 900;
const PREVIEW_RENDER_DEBOUNCE_MS = 180;
const SETTINGS_STORAGE_KEY = "background-remover-ui-settings-v1";
const DEFAULT_UI_SETTINGS: Required<StoredUISettings> = {
  mode: "balanced",
  executionDevice: "cpu",
  background: "checker",
  customBackground: "#f8fafc",
  exportPresetId: "transparent",
  exportSceneId: "transparent",
  exportShadow: false,
  shadowIntensity: 45,
  shadowBlur: 28,
  shadowOffset: 24,
};

type StoredUISettings = {
  mode?: RemovalMode;
  executionDevice?: ExecutionDevice;
  background?: PreviewBackground;
  customBackground?: string;
  exportPresetId?: ExportPresetId;
  exportSceneId?: ExportSceneId;
  exportShadow?: boolean;
  shadowIntensity?: number;
  shadowBlur?: number;
  shadowOffset?: number;
};

function isRemovalMode(value: unknown): value is RemovalMode {
  return value === "balanced" || value === "fast" || value === "quality" || value === "mask";
}

function isExecutionDevice(value: unknown): value is ExecutionDevice {
  return value === "cpu" || value === "gpu";
}

function isPreviewBackground(value: unknown): value is PreviewBackground {
  return (
    value === "checker" ||
    value === "white" ||
    value === "black" ||
    value === "brand" ||
    value === "custom"
  );
}

function isExportPresetId(value: unknown): value is ExportPresetId {
  return value === "transparent" || value === "marketplace" || value === "avatar" || value === "thumbnail";
}

function isExportSceneId(value: unknown): value is ExportSceneId {
  return value === "transparent" || value === "white" || value === "warm" || value === "cool" || value === "graphite";
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

function clampNumber(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return min;
  const safe = Math.round(value);
  if (safe < min || safe > max) return min;
  return safe;
}

function readPersistedSettings(): StoredUISettings {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const next: StoredUISettings = {};

    if (isRemovalMode(parsed.mode)) next.mode = parsed.mode;
    if (isExecutionDevice(parsed.executionDevice)) next.executionDevice = parsed.executionDevice;
    if (isPreviewBackground(parsed.background)) next.background = parsed.background;
    if (isHexColor(parsed.customBackground)) next.customBackground = parsed.customBackground;
    if (isExportPresetId(parsed.exportPresetId)) next.exportPresetId = parsed.exportPresetId;
    if (isExportSceneId(parsed.exportSceneId)) next.exportSceneId = parsed.exportSceneId;
    if (typeof parsed.exportShadow === "boolean") next.exportShadow = parsed.exportShadow;
    if (typeof parsed.shadowIntensity === "number") {
      next.shadowIntensity = clampNumber(parsed.shadowIntensity, 10, 100);
    }
    if (typeof parsed.shadowBlur === "number") {
      next.shadowBlur = clampNumber(parsed.shadowBlur, 6, 56);
    }
    if (typeof parsed.shadowOffset === "number") {
      next.shadowOffset = clampNumber(parsed.shadowOffset, -20, 80);
    }

    return next;
  } catch {
    return {};
  }
}

function createJob(file: File): ImageJob {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    sourceUrl: URL.createObjectURL(file),
    status: "ready",
  };
}

function revokeObjectUrlSoon(url?: string) {
  if (!url) return;
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function App() {
  const persistedSettings = useMemo(() => readPersistedSettings(), []);

  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [mode, setMode] = useState<RemovalMode>(persistedSettings.mode ?? DEFAULT_UI_SETTINGS.mode);
  const [executionDevice, setExecutionDevice] = useState<ExecutionDevice>(
    persistedSettings.executionDevice ?? DEFAULT_UI_SETTINGS.executionDevice
  );
  const [background, setBackground] = useState<PreviewBackground>(
    persistedSettings.background ?? DEFAULT_UI_SETTINGS.background
  );
  const [customBackground, setCustomBackground] = useState(
    persistedSettings.customBackground ?? DEFAULT_UI_SETTINGS.customBackground
  );
  const [comparePosition, setComparePosition] = useState(50);
  const [isZipping, setIsZipping] = useState(false);
  const [isExportingSelected, setIsExportingSelected] = useState(false);
  const [exportPresetId, setExportPresetId] = useState<ExportPresetId>(
    persistedSettings.exportPresetId ?? DEFAULT_UI_SETTINGS.exportPresetId
  );
  const [exportSceneId, setExportSceneId] = useState<ExportSceneId>(
    persistedSettings.exportSceneId ?? DEFAULT_UI_SETTINGS.exportSceneId
  );
  const [exportShadow, setExportShadow] = useState(
    persistedSettings.exportSceneId === "transparent"
      ? false
      : persistedSettings.exportShadow ?? DEFAULT_UI_SETTINGS.exportShadow
  );
  const [shadowIntensity, setShadowIntensity] = useState(
    persistedSettings.shadowIntensity ?? DEFAULT_UI_SETTINGS.shadowIntensity
  );
  const [shadowBlur, setShadowBlur] = useState(
    persistedSettings.shadowBlur ?? DEFAULT_UI_SETTINGS.shadowBlur
  );
  const [shadowOffset, setShadowOffset] = useState(
    persistedSettings.shadowOffset ?? DEFAULT_UI_SETTINGS.shadowOffset
  );
  const [composedPreviewUrl, setComposedPreviewUrl] = useState<string>();
  const [isComposingPreview, setIsComposingPreview] = useState(false);
  const jobsRef = useRef<ImageJob[]>([]);
  const composedPreviewUrlRef = useRef<string | undefined>(undefined);

  const stats = useMemo(() => {
    const ready = jobs.filter((job) => job.status === "ready").length;
    const done = jobs.filter((job) => job.status === "done").length;
    const error = jobs.filter((job) => job.status === "error").length;
    const processing = jobs.filter((job) => job.status === "processing").length;
    const processable = ready + error;
    return { done, error, processing, processable, ready, total: jobs.length };
  }, [jobs]);

  const visibleJobs = useMemo(() => {
    if (queueFilter === "all") {
      return jobs;
    }

    return jobs.filter((job) => job.status === queueFilter);
  }, [jobs, queueFilter]);

  const visibleCount = visibleJobs.length;
  const selectedJob = useMemo(() => {
    const currentSelection = jobs.find((job) => job.id === selectedId);
    if (currentSelection) {
      return visibleJobs.includes(currentSelection) ? currentSelection : visibleJobs[0];
    }

    return visibleJobs[0] ?? jobs[0] ?? null;
  }, [jobs, selectedId, visibleJobs]);

  useEffect(() => {
    if (stats.total === 0) {
      setQueueFilter("all");
      return;
    }

    if (queueFilter !== "all" && visibleCount === 0) {
      setQueueFilter("all");
    }
  }, [stats.total, queueFilter, visibleCount]);

  const visibleStatsLabel = useMemo(() => {
    const filterLabelMap: Record<QueueFilter, string> = {
      all: "all",
      ready: "ready",
      processing: "processing",
      done: "done",
      error: "failed",
    };

    return `${visibleCount} ${filterLabelMap[queueFilter]} ${visibleCount === 1 ? "item" : "items"} shown`;
  }, [visibleCount, queueFilter]);

  const resolveQueueFilter = (nextJobs: ImageJob[]): QueueFilter => {
    if (nextJobs.some((job) => job.status === "ready")) return "ready";
    if (nextJobs.some((job) => job.status === "error")) return "error";
    if (nextJobs.some((job) => job.status === "processing")) return "processing";
    if (nextJobs.some((job) => job.status === "done")) return "done";
    return "all";
  };

  const exportPreset = getExportPreset(exportPresetId);
  const exportComposition = useMemo<ExportComposition>(
    () => ({
      sceneId: exportSceneId,
      shadow: exportShadow,
      shadowIntensity,
      shadowBlur,
      shadowOffset,
    }),
    [exportSceneId, exportShadow, shadowIntensity, shadowBlur, shadowOffset]
  );
  const [debouncedExportComposition, setDebouncedExportComposition] =
    useState<ExportComposition>(exportComposition);

  useEffect(() => {
    const next: StoredUISettings = {
      mode,
      executionDevice,
      background,
      customBackground,
      exportPresetId,
      exportSceneId,
      exportShadow,
      shadowIntensity,
      shadowBlur,
      shadowOffset,
    };

    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage failures (private mode, quota, etc).
    }
  }, [
    mode,
    executionDevice,
    background,
    customBackground,
    exportPresetId,
    exportSceneId,
    exportShadow,
    shadowIntensity,
    shadowBlur,
    shadowOffset,
  ]);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    composedPreviewUrlRef.current = composedPreviewUrl;
  }, [composedPreviewUrl]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedExportComposition(exportComposition);
    }, PREVIEW_RENDER_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [exportComposition]);

  useEffect(() => {
    return () => {
      jobsRef.current.forEach((job) => {
        URL.revokeObjectURL(job.sourceUrl);
        if (job.outputUrl) URL.revokeObjectURL(job.outputUrl);
      });
      if (composedPreviewUrlRef.current) {
        URL.revokeObjectURL(composedPreviewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedJob?.outputBlob) {
      setComposedPreviewUrl((current) => {
        revokeObjectUrlSoon(current);
        return undefined;
      });
      return;
    }

    let cancelled = false;
    setIsComposingPreview(true);

    renderExportPreset(selectedJob.outputBlob, exportPreset, debouncedExportComposition, {
      maxDimension: PREVIEW_MAX_DIMENSION,
    })
      .then((blob) => {
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(blob);
        setComposedPreviewUrl((current) => {
          revokeObjectUrlSoon(current);
          return nextUrl;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setComposedPreviewUrl((current) => {
            revokeObjectUrlSoon(current);
            return undefined;
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsComposingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedJob?.id,
    selectedJob?.outputBlob,
    selectedJob?.outputUrl,
    exportPreset,
    debouncedExportComposition,
  ]);

  const addFiles = (files: File[]) => {
    if (files.length === 0) return;

    const nextJobs = files.map(createJob);
    setJobs((current) => [...nextJobs, ...current]);
    setSelectedId(nextJobs[0].id);
  };

  const updateJob = (id: string, patch: Partial<ImageJob>) => {
    setJobs((current) =>
      current.map((job) => (job.id === id ? { ...job, ...patch } : job))
    );
  };

  const processJob = async (job: ImageJob) => {
    const previousOutputUrl = job.outputUrl;

    updateJob(job.id, {
      status: "processing",
      outputBlob: undefined,
      outputUrl: undefined,
      progress: undefined,
      qualityScore: undefined,
      stats: undefined,
      deviceUsed: undefined,
      fallbackReason: undefined,
      error: undefined,
    });
    revokeObjectUrlSoon(previousOutputUrl);

    try {
      const result = await removeImageBackground(job.file, mode, {
        device: executionDevice,
        onProgress: (progress) => {
          updateJob(job.id, { progress });
        },
      });
      const { blob } = result;
      const outputUrl = URL.createObjectURL(blob);

      updateJob(job.id, {
        status: "done",
        outputBlob: blob,
        outputUrl,
        qualityScore: result.qualityScore,
        stats: result.stats,
        deviceUsed: result.deviceUsed,
        fallbackReason: result.fallbackReason,
        progress: undefined,
      });
    } catch (error) {
      updateJob(job.id, {
        status: "error",
        progress: undefined,
        error: error instanceof Error ? error.message : "Background removal failed.",
      });
    }
  };

  const processQueuedJobs = async () => {
    const queue = jobs.filter((job) => job.status === "ready" || job.status === "error");

    for (const job of queue) {
      await processJob(job);
    }
  };

  const retryFailedJobs = async () => {
    const queue = jobs.filter((job) => job.status === "error");
    if (queue.length === 0) return;

    setQueueFilter("error");

    for (const job of queue) {
      await processJob(job);
    }
  };

  const clearJobs = () => {
    if (jobs.length === 0) return;
    if (!window.confirm("Clear all items from the queue? This cannot be undone.")) {
      return;
    }

    jobs.forEach((job) => {
      revokeObjectUrlSoon(job.sourceUrl);
      revokeObjectUrlSoon(job.outputUrl);
    });
    setJobs([]);
    setSelectedId(null);
    setQueueFilter("all");
  };

  const downloadSelected = async () => {
    if (!selectedJob?.outputBlob) return;

    setIsExportingSelected(true);
    try {
      const blob = await renderExportPreset(
        selectedJob.outputBlob,
        exportPreset,
        exportComposition
      );
      downloadBlob(blob, outputFilename(selectedJob.file.name, exportPreset.suffix));
    } finally {
      setIsExportingSelected(false);
    }
  };

  const downloadProcessedZip = async () => {
    const doneJobs = jobs.filter((job) => job.outputBlob);

    if (doneJobs.length === 0) return;

    setIsZipping(true);
    try {
      const files = await Promise.all(
        doneJobs.map(async (job) => ({
          blob: await renderExportPreset(
            job.outputBlob as Blob,
            exportPreset,
            exportComposition
          ),
          filename: outputFilename(job.file.name, exportPreset.suffix),
        }))
      );

      await downloadZip(files, batchZipFilename(exportPreset.suffix, files.length));
    } finally {
      setIsZipping(false);
    }
  };

  const removeJobs = (ids: string[], options?: { confirmMessage?: string; keepFilter?: boolean }) => {
    if (ids.length === 0) return;

    if (options?.confirmMessage && !window.confirm(options.confirmMessage)) {
      return;
    }

    const removals = new Set(ids);

    setJobs((current) => {
      const nextJobs = current.filter((job) => {
        if (!removals.has(job.id)) return true;

        revokeObjectUrlSoon(job.sourceUrl);
        revokeObjectUrlSoon(job.outputUrl);
        return false;
      });

      if (!options?.keepFilter) {
        setQueueFilter(resolveQueueFilter(nextJobs));
      }

      setSelectedId((currentId) => {
        if (!currentId || removals.has(currentId)) {
          return nextJobs[0]?.id ?? null;
        }
        return currentId;
      });

      return nextJobs;
    });
  };

  const clearProcessedJobs = () => {
    if (!window.confirm(`Clear all ${stats.done} processed items?`)) {
      return;
    }

    const ids = jobs.filter((job) => job.status === "done").map((job) => job.id);
    removeJobs(ids);
  };

  const clearFailedJobs = () => {
    if (!window.confirm(`Clear all ${stats.error} failed items?`)) {
      return;
    }

    const ids = jobs.filter((job) => job.status === "error").map((job) => job.id);
    removeJobs(ids);
  };

  const removeJob = (id: string) => {
    const job = jobs.find((item) => item.id === id);
    if (!job) return;

    removeJobs([id], {
      confirmMessage: `Remove ${job.file.name} from queue?`,
    });
  };

  const resetPreferences = () => {
    try {
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch {
      // Ignore storage failures so this still works in privacy modes.
    }

    setMode(DEFAULT_UI_SETTINGS.mode);
    setExecutionDevice(DEFAULT_UI_SETTINGS.executionDevice);
    setBackground(DEFAULT_UI_SETTINGS.background);
    setCustomBackground(DEFAULT_UI_SETTINGS.customBackground);
    setExportPresetId(DEFAULT_UI_SETTINGS.exportPresetId);
    setExportSceneId(DEFAULT_UI_SETTINGS.exportSceneId);
    setExportShadow(DEFAULT_UI_SETTINGS.exportShadow);
    setShadowIntensity(DEFAULT_UI_SETTINGS.shadowIntensity);
    setShadowBlur(DEFAULT_UI_SETTINGS.shadowBlur);
    setShadowOffset(DEFAULT_UI_SETTINGS.shadowOffset);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Eraser size={22} />
          </span>
          <span>
            <strong>Background Remover</strong>
            <small>local, open, no credits</small>
          </span>
        </div>
        <nav className="topbar-actions" aria-label="Primary actions">
          <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noreferrer">
            AGPL license
          </a>
          <button className="ghost-button" onClick={resetPreferences} type="button">
            <RefreshCw size={17} />
            Reset preferences
          </button>
          <button className="ghost-button" onClick={clearJobs} disabled={jobs.length === 0}>
            <Trash2 size={17} />
            Clear
          </button>
        </nav>
      </header>

      <section className="workspace">
        <aside className="control-panel" aria-label="Processing controls">
          <div className="intro">
            <h1>Remove image backgrounds without uploading the image.</h1>
            <p>
              Drop a photo, process it in your browser, and export a transparent PNG with
              no watermark.
            </p>
          </div>

          <Dropzone disabled={stats.processing > 0} onFiles={addFiles} />

          <section className="panel-section">
            <h2>Model</h2>
            <div className="mode-grid">
              {(Object.keys(modeLabels) as RemovalMode[]).map((key) => (
                <button
                  className={mode === key ? "mode-card selected" : "mode-card"}
                  key={key}
                  onClick={() => setMode(key)}
                  type="button"
                >
                  <span>{modeLabels[key].label}</span>
                  <small>{modeLabels[key].detail}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="panel-section">
            <h2>Engine</h2>
            <div className="segmented-control" role="group" aria-label="Processing engine">
              <button
                className={executionDevice === "cpu" ? "selected" : ""}
                onClick={() => setExecutionDevice("cpu")}
                type="button"
              >
                <Cpu size={16} />
                Reliable CPU
              </button>
              <button
                className={executionDevice === "gpu" ? "selected" : ""}
                onClick={() => setExecutionDevice("gpu")}
                type="button"
              >
                <Zap size={16} />
                Experimental GPU
              </button>
            </div>
            <p className="section-note">
              GPU can be faster, but weak masks automatically fall back to CPU.
            </p>
          </section>

          <section className="panel-section">
            <h2>Preview background</h2>
            <div className="swatches" role="group" aria-label="Preview background">
              {(["checker", "white", "black", "brand", "custom"] as const).map((option) => (
                <button
                  className={`swatch ${option} ${background === option ? "selected" : ""}`}
                  key={option}
                  onClick={() => setBackground(option)}
                  type="button"
                  aria-label={option}
                  style={option === "custom" ? { background: customBackground } : undefined}
                />
              ))}
            </div>
            <label className="color-field">
              <span>Custom</span>
              <input
                type="color"
                value={customBackground}
                onChange={(event) => {
                  setCustomBackground(event.target.value);
                  setBackground("custom");
                }}
              />
            </label>
          </section>

          <section className="panel-section">
            <h2>Export preset</h2>
            <div className="preset-grid">
              {exportPresets.map((preset) => (
                <button
                  className={exportPresetId === preset.id ? "preset-card selected" : "preset-card"}
                  key={preset.id}
                  onClick={() => setExportPresetId(preset.id)}
                  type="button"
                >
                  <span>
                    <FileImage size={16} />
                    {preset.label}
                  </span>
                  <small>{preset.detail}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="panel-section">
            <h2>Product background</h2>
            <div className="scene-grid">
              {exportScenes.map((scene) => (
                <button
                  className={exportSceneId === scene.id ? "scene-card selected" : "scene-card"}
                  key={scene.id}
                  onClick={() => {
                    setExportSceneId(scene.id);
                    if (scene.id === "transparent") setExportShadow(false);
                  }}
                  type="button"
                >
                  <span className={`scene-swatch ${scene.preview === "checker" ? "checker" : ""}`}>
                    {scene.preview !== "checker" ? (
                      <span style={{ background: scene.preview }} />
                    ) : null}
                  </span>
                  <span>
                    <strong>{scene.label}</strong>
                    <small>{scene.detail}</small>
                  </span>
                </button>
              ))}
            </div>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={exportShadow}
                disabled={exportSceneId === "transparent"}
                onChange={(event) => setExportShadow(event.target.checked)}
              />
              <span>
                <Palette size={16} />
                Product shadow
              </span>
            </label>

            <label className="range-field">
              <span>Shadow strength</span>
              <strong>{shadowIntensity}%</strong>
              <input
                type="range"
                min="10"
                max="100"
                value={shadowIntensity}
                disabled={!exportShadow || exportSceneId === "transparent"}
                onChange={(event) => setShadowIntensity(Number(event.target.value))}
              />
            </label>

            <div className="shadow-tuning-grid">
              <label className="range-field compact">
                <span>Blur</span>
                <strong>{shadowBlur}px</strong>
                <input
                  type="range"
                  min="6"
                  max="56"
                  value={shadowBlur}
                  disabled={!exportShadow || exportSceneId === "transparent"}
                  onChange={(event) => setShadowBlur(Number(event.target.value))}
                />
              </label>
              <label className="range-field compact">
                <span>Offset</span>
                <strong>{shadowOffset}px</strong>
                <input
                  type="range"
                  min="-20"
                  max="80"
                  value={shadowOffset}
                  disabled={!exportShadow || exportSceneId === "transparent"}
                  onChange={(event) => setShadowOffset(Number(event.target.value))}
                />
              </label>
            </div>
          </section>

          <div className="action-row">
            <button
              className="primary-button"
              disabled={stats.processable === 0 || stats.processing > 0}
              onClick={processQueuedJobs}
              type="button"
            >
              {stats.processing > 0 ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
              Remove backgrounds
            </button>
            <button
              className="secondary-button"
              disabled={stats.done === 0 || isZipping || isExportingSelected}
              onClick={downloadProcessedZip}
              type="button"
            >
              {isZipping ? <Loader2 className="spin" size={18} /> : <Package size={18} />}
              Export processed ZIP
            </button>
            <button
              className="ghost-button"
              disabled={stats.error === 0 || stats.processing > 0}
              onClick={retryFailedJobs}
              type="button"
            >
              <RefreshCw size={17} />
              Retry failed
            </button>
          </div>

          <div className="privacy-strip">
            <span>
              <Lock size={15} />
              Browser-local processing
            </span>
            <span>
              <ShieldCheck size={15} />
              Self-hosted model files
            </span>
          </div>
        </aside>

        <section className="preview-area" aria-label="Image preview">
          {selectedJob ? (
            <>
              <div className="preview-toolbar">
                <div>
                  <span className="eyebrow">Current image</span>
                  <h2>{selectedJob.file.name}</h2>
                  <div className="toolbar-metrics">
                    <p>{formatBytes(selectedJob.file.size)}</p>
                    {selectedJob.status === "done" && selectedJob.qualityScore ? (
                      <>
                        <QualityBadge score={selectedJob.qualityScore} />
                        <DeviceBadge
                          device={selectedJob.deviceUsed}
                          fallbackReason={selectedJob.fallbackReason}
                        />
                      </>
                    ) : null}
                  </div>
                </div>
                <button
                  className="secondary-button"
                  disabled={!selectedJob.outputBlob || isExportingSelected || isZipping}
                  onClick={downloadSelected}
                  type="button"
                >
                  {isExportingSelected ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
                  {exportPreset.id === "transparent" ? "PNG" : exportPreset.label}
                </button>
              </div>

              <div
                className={`canvas-stage ${background}`}
                style={{ "--custom-bg": customBackground } as CSSProperties}
              >
                <div className="comparison-shell">
                  <div
                    className="comparison-frame"
                    style={{ "--split": `${comparePosition}%` } as CSSProperties}
                  >
                    {selectedJob.status === "done" && selectedJob.outputUrl ? (
                      <>
                        <img
                          className="comparison-image comparison-output"
                          src={composedPreviewUrl ?? selectedJob.outputUrl}
                          alt=""
                        />
                        {isComposingPreview ? (
                          <div className="preview-rendering">
                            <Loader2 className="spin" size={16} />
                            Updating preview
                          </div>
                        ) : null}
                        <div className="comparison-original-layer">
                          <img
                            className="comparison-image comparison-original"
                            src={selectedJob.sourceUrl}
                            alt=""
                          />
                        </div>
                        <div className="comparison-handle" aria-hidden="true">
                          <span />
                        </div>
                        <div className="comparison-tag original">Original</div>
                        <div className="comparison-tag cutout">Cutout</div>
                      </>
                    ) : (
                      <>
                        <img
                          className="comparison-image source-only"
                          src={selectedJob.sourceUrl}
                          alt=""
                        />
                        <div className="empty-result comparison-overlay">
                          {selectedJob.status === "processing" ? (
                            <>
                              <Loader2 className="spin" size={34} />
                              <strong>Removing background</strong>
                              <small>{progressLabel(selectedJob.progress)}</small>
                            </>
                          ) : selectedJob.status === "error" ? (
                            <>
                              <RotateCcw size={34} />
                              <strong>Could not process image</strong>
                              <small>{selectedJob.error}</small>
                            </>
                          ) : (
                            <>
                              <ImageIcon size={34} />
                              <strong>Ready for cutout</strong>
                              <small>Choose a model and run removal.</small>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="comparison-controls">
                    <SlidersHorizontal size={18} />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={comparePosition}
                      disabled={selectedJob.status !== "done"}
                      onChange={(event) => setComparePosition(Number(event.target.value))}
                      aria-label="Before and after comparison split"
                    />
                  </div>

                  <ProgressTimeline job={selectedJob} />
                </div>
              </div>
            </>
          ) : (
            <div className="empty-workspace">
              <ImageIcon size={42} />
              <h2>No image selected</h2>
              <p>Add one or more images to start a local background-removal batch.</p>
            </div>
          )}
        </section>

        <aside className="queue-panel" aria-label="Image queue">
          <div className="queue-header">
            <h2>Queue</h2>
            <span>
              {visibleStatsLabel}
            </span>
          </div>
          <div className="queue-filters" aria-label="Queue status filter">
            <button
              className={`queue-filter ${queueFilter === "all" ? "selected" : ""}`}
              disabled={stats.total === 0}
              onClick={() => setQueueFilter("all")}
              aria-current={queueFilter === "all" ? "page" : undefined}
              type="button"
            >
              <ListFilter size={13} />
              All
              <span>{stats.total}</span>
            </button>
            <button
              className={`queue-filter ${queueFilter === "ready" ? "selected" : ""}`}
              disabled={stats.ready === 0}
              onClick={() => setQueueFilter("ready")}
              aria-current={queueFilter === "ready" ? "page" : undefined}
              type="button"
            >
              Ready
              <span>{stats.ready}</span>
            </button>
            <button
              className={`queue-filter ${queueFilter === "processing" ? "selected" : ""}`}
              disabled={stats.processing === 0}
              onClick={() => setQueueFilter("processing")}
              aria-current={queueFilter === "processing" ? "page" : undefined}
              type="button"
            >
              Working
              <span>{stats.processing}</span>
            </button>
            <button
              className={`queue-filter ${queueFilter === "done" ? "selected" : ""}`}
              disabled={stats.done === 0}
              onClick={() => setQueueFilter("done")}
              aria-current={queueFilter === "done" ? "page" : undefined}
              type="button"
            >
              Done
              <span>{stats.done}</span>
            </button>
            <button
              className={`queue-filter ${queueFilter === "error" ? "selected" : ""}`}
              disabled={stats.error === 0}
              onClick={() => setQueueFilter("error")}
              aria-current={queueFilter === "error" ? "page" : undefined}
              type="button"
            >
              Failed
              <span>{stats.error}</span>
            </button>
          </div>

          <div className="queue-tools" aria-label="Batch queue controls">
            <button
              className="queue-tool"
              disabled={stats.processable === 0 || stats.processing > 0}
              onClick={processQueuedJobs}
              type="button"
            >
              <Sparkles size={15} />
              To process
              <span>{stats.processable}</span>
            </button>
            <button
              className="queue-tool"
              disabled={stats.error === 0 || stats.processing > 0}
              onClick={retryFailedJobs}
              type="button"
            >
              <AlertCircle size={15} />
              Failed
              <span>{stats.error}</span>
            </button>
            <button
              className="queue-tool"
              disabled={stats.done === 0 || isZipping || isExportingSelected}
              onClick={downloadProcessedZip}
              type="button"
            >
              <Package size={15} />
              Processed
              <span>{stats.done}</span>
            </button>
            <button
              className="queue-tool"
              disabled={stats.done === 0 || isZipping || isExportingSelected || stats.processing > 0}
              onClick={clearProcessedJobs}
              type="button"
            >
              <Check size={15} />
              Clear processed
              <span>{stats.done}</span>
            </button>
            <button
              className="queue-tool"
              disabled={stats.error === 0 || isZipping || isExportingSelected || stats.processing > 0}
              onClick={clearFailedJobs}
              type="button"
              title="Remove failed items from the queue"
            >
              <X size={15} />
              Clear failed
              <span>{stats.error}</span>
            </button>
          </div>

          <div className="queue-list">
            {visibleJobs.length === 0 ? (
              <div className="queue-empty">No items match this view.</div>
            ) : (
              visibleJobs.map((job) => (
                <div
                  className={job.id === selectedJob?.id ? "queue-item selected" : "queue-item"}
                  key={job.id}
                >
                  <button
                    className="queue-select"
                    onClick={() => setSelectedId(job.id)}
                    type="button"
                  >
                    <img src={job.sourceUrl} alt="" />
                    <span>
                      <strong>{job.file.name}</strong>
                      <small>
                        {formatBytes(job.file.size)}
                        {job.qualityScore ? ` - Q${job.qualityScore}` : ""}
                        {job.deviceUsed ? ` - ${job.deviceUsed.toUpperCase()}` : ""}
                      </small>
                    </span>
                    <StatusIcon status={job.status} />
                  </button>
                  <div className="queue-actions">
                    <button
                      className="queue-action"
                      disabled={job.status === "processing"}
                      onClick={() => processJob(job)}
                      title={job.status === "error" ? "Retry image" : "Reprocess image"}
                      type="button"
                    >
                      {job.status === "processing" ? (
                        <Loader2 className="spin" size={17} />
                      ) : (
                        <RefreshCw size={17} />
                      )}
                    </button>
                    <button
                      className="queue-action"
                      disabled={job.status === "processing"}
                      onClick={() => removeJob(job.id)}
                      title="Remove from queue"
                      type="button"
                    >
                      <X size={17} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

const progressSteps = ["Load", "Decode", "Segment", "Encode", "Validate"];

function ProgressTimeline({ job }: { job: ImageJob }) {
  const activeIndex = progressStepIndex(job);

  return (
    <div className="progress-panel" aria-label="Processing timeline">
      <div className="progress-steps">
        {progressSteps.map((step, index) => {
          const state =
            job.status === "done"
              ? "complete"
              : job.status === "error" && index === activeIndex
                ? "error"
                : index < activeIndex
                  ? "complete"
                  : index === activeIndex && job.status === "processing"
                    ? "active"
                    : "pending";

          return (
            <div className={`progress-step ${state}`} key={step}>
              <span />
              <small>{step}</small>
            </div>
          );
        })}
      </div>
      <div className="progress-detail">
        {job.status === "done" && job.stats ? (
          <>
            <Gauge size={16} />
            <span>
              Foreground {percent(job.stats.alphaPixels, job.stats.totalPixels)} - solid{" "}
              {percent(job.stats.opaquePixels, job.stats.totalPixels)}
            </span>
          </>
        ) : job.status === "processing" ? (
          <>
            <Loader2 className="spin" size={16} />
            <span>{progressLabel(job.progress)}</span>
          </>
        ) : job.status === "error" ? (
          <>
            <RotateCcw size={16} />
            <span>{job.error}</span>
          </>
        ) : (
          <>
            <ImageIcon size={16} />
            <span>Waiting for processing.</span>
          </>
        )}
      </div>
    </div>
  );
}

function QualityBadge({ score }: { score: number }) {
  return <span className={`quality-badge ${qualityTone(score)}`}>Q{score}</span>;
}

function DeviceBadge({
  device,
  fallbackReason,
}: {
  device?: ExecutionDevice;
  fallbackReason?: string;
}) {
  if (!device) return null;

  return (
    <span className="device-badge" title={fallbackReason}>
      {device === "cpu" ? <Cpu size={13} /> : <Zap size={13} />}
      {fallbackReason ? "GPU->CPU" : device.toUpperCase()}
    </span>
  );
}

function StatusIcon({ status }: { status: JobStatus }) {
  if (status === "processing") return <Loader2 className="spin status-icon" size={18} />;
  if (status === "done") return <Check className="status-icon done" size={18} />;
  if (status === "error") return <RotateCcw className="status-icon error" size={18} />;
  return <ImageIcon className="status-icon" size={18} />;
}

function progressLabel(progress?: RemovalProgress): string {
  if (!progress) return "Preparing model";

  if (progress.key.startsWith("/") || progress.key.length > 32) {
    return "Loading model assets";
  }

  const labels: Record<string, string> = {
    "compute:decode": "Decoding image",
    "compute:inference": "Segmenting subject",
    "compute:mask": "Applying mask",
    "compute:encode": "Encoding PNG",
    "validate:inspect": "Validating cutout",
  };

  return labels[progress.key] ?? progress.key;
}

function progressStepIndex(job: ImageJob): number {
  if (job.status === "done") return progressSteps.length;
  if (job.status !== "processing" || !job.progress) return 0;

  const key = job.progress.key;
  if (key.includes("decode")) return 1;
  if (key.includes("inference")) return 2;
  if (key.includes("mask")) return 2;
  if (key.includes("encode")) return 3;
  if (key.includes("validate")) return 4;
  return 0;
}

function percent(value: number, total: number): string {
  return `${Math.round((value / total) * 100)}%`;
}

function qualityTone(score: number): "good" | "ok" | "weak" {
  if (score >= 70) return "good";
  if (score >= 40) return "ok";
  return "weak";
}

export default App;
