import JSZip from "jszip";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function outputFilename(inputName: string, suffix = "cutout"): string {
  const dotIndex = inputName.lastIndexOf(".");
  const base = dotIndex > 0 ? inputName.slice(0, dotIndex) : inputName;

  return `${base}-${suffix}.png`;
}

export async function downloadZip(
  files: Array<{ blob: Blob; filename: string }>,
  filename = "background-remover-cutouts.zip"
): Promise<void> {
  const zip = new JSZip();

  files.forEach((file) => {
    zip.file(file.filename, file.blob);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, filename);
}
